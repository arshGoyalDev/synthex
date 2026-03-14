import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config";
import { redis } from "../config/database";

interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {

  if (req.path === "/health") {
    return next();
  }

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const blacklistAccessToken = await redis.get(`blacklist:${token}`);

  if (blacklistAccessToken) {
    return res.status(401).json({ error: "Token has been blacklisted" });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
    };

    req.headers["x-user-id"] = payload.id;
    req.headers["x-user-email"] = payload.email;

    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export { authMiddleware, AuthRequest };
