import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

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

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or revoked token" });
  }

  req.headers["x-user-id"] = payload.id;
  req.headers["x-user-email"] = payload.email;

  next();
};

export { authMiddleware };
export type { AuthRequest };
