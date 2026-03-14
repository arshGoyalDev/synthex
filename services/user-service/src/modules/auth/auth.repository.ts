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
}
