import { Router } from "express";
import { ImportController } from "./import.controller";

const importRoutes: Router = Router();
const controller = new ImportController();

// GitHub import
importRoutes.get("/github/repos", controller.listGithubRepos.bind(controller));
importRoutes.post("/github/detect", controller.detectGithub.bind(controller));
importRoutes.post("/github", controller.importGithub.bind(controller));

// ZIP import
importRoutes.post("/zip/detect", controller.detectZip.bind(controller));
importRoutes.post("/zip", controller.importZip.bind(controller));

export { importRoutes };
