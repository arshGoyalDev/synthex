import { Response, Request, NextFunction } from "express";

import { UserService } from "./user.service";
import { updateUserSchema } from "./user.schema";

const userService = new UserService();

class UserController {
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;

      const user = await userService.getMe(userId);

      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.getById(req.params.id);

      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  }

  async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;

      const data = updateUserSchema.parse(req.body);

      const user = await userService.updateMe(userId, data);

      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  }

  async deleteMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;

      await userService.deleteMe(userId);

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export { UserController };
