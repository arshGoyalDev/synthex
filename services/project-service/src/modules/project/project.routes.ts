import { Router } from "express";
import { ProjectController } from "./project.controller";

const projectRoutes = Router();

const controller = new ProjectController();

projectRoutes.get("/me", controller.getProjectsMe.bind(controller));
projectRoutes.get("/:id", controller.getProjectById.bind(controller));
projectRoutes.post("/", controller.createProject.bind(controller));
projectRoutes.post("/:id/start", controller.startProject.bind(controller));
projectRoutes.post("/:id/stop", controller.stopProject.bind(controller));

export { projectRoutes };