import { Router } from "express";
import { ProjectController } from "./project.controller";
import { ImportController } from "../import/import.controller";
import { importRoutes } from "../import/import.routes";

const projectRoutes: Router = Router();

const controller = new ProjectController();
const importController = new ImportController();

projectRoutes.use("/import", importRoutes);
projectRoutes.put("/:id/config", importController.updateConfig.bind(importController));
projectRoutes.get("/me", controller.getProjectsMe.bind(controller));
projectRoutes.get("/:id/env", controller.getProjectEnvVars.bind(controller));
projectRoutes.get("/:id", controller.getProjectById.bind(controller));
projectRoutes.post("/", controller.createProject.bind(controller));
projectRoutes.patch("/:id", controller.updateProject.bind(controller));
projectRoutes.delete("/:id", controller.deleteProject.bind(controller));
projectRoutes.post("/:id/start", controller.startProject.bind(controller));
projectRoutes.post("/:id/stop", controller.stopProject.bind(controller));

export { projectRoutes };
