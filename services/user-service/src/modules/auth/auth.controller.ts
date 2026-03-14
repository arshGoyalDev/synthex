import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { loginSchema, signupSchema } from "./auth.schema";

const authService = new AuthService();

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
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
      const accessToken = req.headers.authorization?.split(" ")[1]!;

      await authService.logout(req.headers["x-user-id"] as string, accessToken);

      res.clearCookie("refreshToken");
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export { AuthController };
