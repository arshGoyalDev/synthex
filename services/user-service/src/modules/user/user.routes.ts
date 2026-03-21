import { Router } from "express";
import { UserController } from "./user.controller";

const userRoutes = Router();
const controller = new UserController();

userRoutes.get("/me", controller.getMe.bind(controller));
userRoutes.get("/:id", controller.getById.bind(controller));
userRoutes.put("/me", controller.updateMe.bind(controller));
userRoutes.delete("/me", controller.deleteMe.bind(controller));

export { userRoutes };