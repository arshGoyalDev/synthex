import jwt from "jsonwebtoken";
import { env } from "../config";
import { redis } from "../config/database";

export type AccessTokenPayload = {
  id: string;
  email: string;
};

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload | null> {
  const blacklisted = await redis.get(`blacklist:${token}`);
  if (blacklisted) return null;

  try {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}
