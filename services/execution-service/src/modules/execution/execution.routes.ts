import { Router } from "express";
import { ExecutionController } from "./execution.controller";

const executionRoutes: Router = Router();
const controller = new ExecutionController();

executionRoutes.post("/preview", controller.startPreview.bind(controller));
executionRoutes.delete("/preview/:projectId", controller.stopPreview.bind(controller));
executionRoutes.get("/project/:projectId", controller.getHistory.bind(controller));

executionRoutes.post("/", controller.startExecution.bind(controller));
executionRoutes.get("/:executionId", controller.getExecution.bind(controller));
executionRoutes.get("/:executionId/buffer", controller.getBuffer.bind(controller));
executionRoutes.delete("/:executionId", controller.killExecution.bind(controller));

export { executionRoutes };