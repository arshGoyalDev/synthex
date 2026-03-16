import { db } from "../../config/database";

class UserRepository {
  async findById(id: string) {
    return db.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    return db.user.findUnique({
      where: { email },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(id: string, data: { username?: string, avatarUrl?: string }) {
    return db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async delete(id: string) {
    return db.user.delete({
      where: { id },
    });
  }
}

export { UserRepository };
