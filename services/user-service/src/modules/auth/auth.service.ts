import * as argon2 from "argon2";
import { AuthRepository } from "./auth.repository";
import {
  blacklistAccessToken,
  deleteRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  verifyToken,
} from "../../utils/token";
import { redis } from "../../config/database";

class AuthService {
  private repo = new AuthRepository();

  async signup(username: string, email: string, password: string) {
    const existingUser = await this.repo.findUserByEmail(email);

    if (existingUser) {
      throw new Error("Email already in use");
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.repo.createUser({
      username,
      email,
      passwordHash,
    });

    return this.generateTokenPair(user);
  }

  async login(email: string, password: string) {
    const user = await this.repo.findUserByEmail(email);

    if (!user) {
      throw new Error("No user found with this email");
    }

    const isValid = await argon2.verify(user.passwordHash, password);

    if (!isValid) {
      throw new Error("Wrong password");
    }

    return this.generateTokenPair(user);
  }

  async refresh(refreshToken: string) {
    let payload;

    try {
      payload = verifyToken(refreshToken);
    } catch (error) {
      throw new Error("Invalid refresh token");
    }

    const stored = await redis.get(`refresh:${payload.id}`);

    if (stored !== refreshToken) {
      throw new Error("Refresh token revoked");
    }

    const user = await this.repo.findUserById(payload.id);

    if (!user) {
      throw new Error("User not found");
    }

    return this.generateTokenPair(user);
  }

  async logout(userId: string, accessToken: string) {
    await blacklistAccessToken(accessToken, 15 * 60);
    await deleteRefreshToken(userId);
  }

  private async generateTokenPair(user: { id: string; email: string }) {
    const payload = { id: user.id, email: user.email };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await saveRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken, userId: user.id };
  }
}

export { AuthService };
