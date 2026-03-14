import jwt from "jsonwebtoken";
import { env } from "../config";
import { redis } from "../config/database";

interface TokenPayload {
  id: string;
  email: string;
}

const generateAccessToken = (payload: TokenPayload) => {
  return jwt.sign(payload, env.JWT_SECRET as string, {
    expiresIn: env.ACCESS_TOKEN_EXPIRATION as string,
  });
};

const generateRefreshToken = (payload: TokenPayload) => {
  return jwt.sign(payload, env.JWT_SECRET as string, {
    expiresIn: env.REFRESH_TOKEN_EXPIRATION as string,
  });
};

const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET as string) as TokenPayload;
};

const saveRefreshToken = async (userId: string, token: string) => {
  console.log("saving refresh token for", userId); // ← add this
  await redis.set(`refresh:${userId}`, token, "EX", 7 * 24 * 60 * 60);
  console.log("refresh token saved"); // ← add this
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
