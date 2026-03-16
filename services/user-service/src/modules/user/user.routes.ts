import { Router } from "express";
import { UserController } from "./user.controller";

const userRoutes = Router();
const controller = new UserController();

userRoutes.get("/me", controller.getMe);
userRoutes.get("/:id", controller.getById);
userRoutes.put("/me", controller.updateMe);
userRoutes.delete("/me", controller.deleteMe);

export { userRoutes };