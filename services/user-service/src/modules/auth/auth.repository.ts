import { db } from "../../config/database";

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
  ) {
    return db.oAuthAccount.create({
      data: { userId, provider, providerId },
    });
  }
}
