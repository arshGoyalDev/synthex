import jwt from "jsonwebtoken";
import { env } from "../config";
import { redis } from "../config/database";
import type { SignOptions } from "jsonwebtoken";

interface TokenPayload {
  id: string;
  email: string;
}

const generateAccessToken = (payload: TokenPayload) => {
  const expiresIn = env.ACCESS_TOKEN_EXPIRATION as SignOptions["expiresIn"];

  return jwt.sign(payload, env.JWT_SECRET as string, {
    expiresIn,
  });
};

const generateRefreshToken = (payload: TokenPayload) => {
  const expiresIn = env.REFRESH_TOKEN_EXPIRATION as SignOptions["expiresIn"];

  return jwt.sign(payload, env.JWT_SECRET as string, {
    expiresIn,
  });
};

const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET as string) as TokenPayload;
};

const saveRefreshToken = async (userId: string, token: string) => {
  await redis.set(`refresh:${userId}`, token, "EX", 7 * 24 * 60 * 60);
};

const deleteRefreshToken = async (userId: string) => {
  await redis.del(`refresh:${userId}`);
};

const blacklistAccessToken = async (token: string, expiresIn: number) => {
  await redis.set(`blacklist:${token}`, "1", "EX", expiresIn);
};

const isTokenBlacklisted = async (token: string) => {
  return await redis.exists(`blacklist:${token}`);
};

export {
  generateAccessToken,
  verifyToken,
  saveRefreshToken,
  deleteRefreshToken,
  blacklistAccessToken,
  isTokenBlacklisted,
  generateRefreshToken,
};
