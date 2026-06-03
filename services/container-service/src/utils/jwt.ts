import jwt from "jsonwebtoken";
import { redis } from "../config/database";

const JWT_SECRET = process.env.JWT_SECRET;

export type AccessTokenPayload = {
  id: string;
  email: string;
};

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload | null> {
  if (!JWT_SECRET) return null;

  const blacklisted = await redis.get(`blacklist:${token}`);
  if (blacklisted) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}
