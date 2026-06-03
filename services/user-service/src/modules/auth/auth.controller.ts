import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthService } from "./auth.service";
import { env } from "../../config";
import { loginSchema, signupSchema } from "./auth.schema";

const authService = new AuthService();

const isProd = process.env.NODE_ENV === "production";

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

class AuthController {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, email, password } = signupSchema.parse(req.body);
      const tokens = await authService.signup(username, email, password);
      setRefreshCookie(res, tokens.refreshToken);

      res.status(201).json({accessToken: tokens.accessToken });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const tokens = await authService.login(email, password);
      setRefreshCookie(res, tokens.refreshToken);

      res.json({ accessToken: tokens.accessToken });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ message: "No refresh token provided" });
      }

      const tokens = await authService.refresh(refreshToken);
      setRefreshCookie(res, tokens.refreshToken);

      res.json({ accessToken: tokens.accessToken });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing or invalid Authorization header" });
      }

      const accessToken = authHeader.split(" ")[1] as string;

      let userId: string;
      try {
        const payload = jwt.verify(accessToken, env.JWT_SECRET) as {
          id: string;
        };
        userId = payload.id;
      } catch {
        return res.status(401).json({ message: "Invalid token" });
      }

      await authService.logout(userId, accessToken);

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
      });
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  }

  async getGithubToken(req: Request, res: Response, next: NextFunction) {
    try {
      const internalToken = req.headers["x-internal-token"] as string | undefined;
      if (!internalToken || internalToken !== env.INTERNAL_API_KEY) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = await authService.getGithubToken(userId);
      if (!token) {
        return res.status(404).json({ message: "GitHub token not found" });
      }

      res.json({
        data: {
          accessToken: token.accessToken,
          tokenScope: token.tokenScope ?? null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export { AuthController };
