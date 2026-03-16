import * as argon2 from "argon2";
import { AuthRepository } from "./auth.repository";
import { AppError } from "../../utils/AppError";
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
      throw new AppError("Email already in use", 409);
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
      throw new AppError("No user found with this email", 404);
    }

    const isValid = await argon2.verify(user.passwordHash, password);

    if (!isValid) {
      throw new AppError("Wrong password", 401);
    }

    return this.generateTokenPair(user);
  }

  async handleOAuthLogin(
    provider: string,
    providerId: string,
    profile: { username: string; email: string; avatarUrl?: string },
  ) {
    let oauthAccount = await this.repo.findOAuthAccount(provider, providerId);

    if (oauthAccount) {
      return this.generateTokenPair(oauthAccount.user);
    }

    let user = await this.repo.findUserByEmail(profile.email);

    if (!user) {
      user = await this.repo.createUser({
        username: profile.username,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        passwordHash: "",
      });
    }

    await this.repo.createOAuthAccount(user.id, provider, providerId);

    return this.generateTokenPair(user);
  }

  async refresh(refreshToken: string) {
    let payload;

    try {
      payload = verifyToken(refreshToken);
    } catch (error) {
      throw new AppError("Invalid refresh token", 401);
    }

    const stored = await redis.get(`refresh:${payload.id}`);

    if (stored !== refreshToken) {
      throw new AppError("Refresh token revoked", 401);
    }

    const user = await this.repo.findUserById(payload.id);

    if (!user) {
      throw new AppError("User not found", 404);
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
