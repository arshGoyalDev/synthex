import { Router } from "express";
import { AuthController } from "./auth.controller";

const authRoutes = Router();

const controller = new AuthController();

authRoutes.post("/signup", controller.signup.bind(controller));
authRoutes.post("/login", controller.login.bind(controller));
authRoutes.post("/refresh", controller.refresh.bind(controller));
authRoutes.post("/logout", controller.logout.bind(controller));

export { authRoutes };
