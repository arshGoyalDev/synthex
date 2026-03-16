import { UserRepository } from "./user.repository";
import { AppError } from "../../utils/AppError";

class UserService {
  private repo = new UserRepository();

  async getMe(userId: string) {
    const user = await this.repo.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }

  async getById(id: string) {
    const user = await this.repo.findById(id);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }

  async updateMe(
    userId: string,
    data: { username?: string; avatarUrl?: string },
  ) {
    const user = await this.repo.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return this.repo.update(userId, data);
  }

  async deleteMe(userId: string) {
    const user = await this.repo.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    await this.repo.delete(userId);
  }
}

export { UserService };
