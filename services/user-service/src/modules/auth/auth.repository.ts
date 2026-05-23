import { db } from "../../config/database";
import { decryptToken, encryptToken } from "../../utils/encryption";

export class AuthRepository {
  async findUserByEmail(email: string) {
    return db.user.findUnique({ where: { email } });
  }

  async findUserById(id: string) {
    return db.user.findUnique({ where: { id } });
  }

  async createUser(data: {
    username: string;
    email: string;
    passwordHash: string;
    avatarUrl?: string;
  }) {
    return db.user.create({ data });
  }

  async findOAuthAccount(provider: string, providerId: string) {
    return db.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
      include: { user: true },
    });
  }

  async createOAuthAccount(
    userId: string,
    provider: string,
    providerId: string,
    accessToken?: string,
    tokenScope?: string,
  ) {
    const encryptedToken = accessToken ? encryptToken(accessToken) : null;
    return db.oAuthAccount.create({
      data: {
        userId,
        provider,
        providerId,
        accessToken: encryptedToken ? JSON.stringify(encryptedToken) : null,
        tokenScope: tokenScope ?? null,
      },
    });
  }

  async updateOAuthAccountToken(
    id: string,
    accessToken: string,
    tokenScope?: string,
  ) {
    const encryptedToken = encryptToken(accessToken);
    return db.oAuthAccount.update({
      where: { id },
      data: {
        accessToken: JSON.stringify(encryptedToken),
        tokenScope: tokenScope ?? null,
      },
    });
  }

  async getOAuthTokenForUser(userId: string, provider: string) {
    const account = await db.oAuthAccount.findFirst({
      where: { userId, provider },
      select: { accessToken: true, tokenScope: true },
    });

    if (!account?.accessToken) return null;

    const parsed = JSON.parse(account.accessToken) as {
      cipher: string;
      iv: string;
      tag: string;
    };

    return {
      accessToken: decryptToken(parsed),
      tokenScope: account.tokenScope ?? undefined,
    };
  }
}
