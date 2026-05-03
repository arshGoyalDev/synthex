import { Router } from "express";
import { FilesController } from "./files.controller";

const filesRoutes: Router = Router();
const controller = new FilesController();

filesRoutes.get(
  "/:projectId/latest-snapshot",
  controller.getLatestSnapshot.bind(controller),
);
filesRoutes.get("/:projectId", controller.listFiles.bind(controller));
filesRoutes.post("/:projectId", controller.saveFile.bind(controller));
filesRoutes.get("/:projectId/*", controller.getFile.bind(controller));
filesRoutes.put("/:projectId/*", controller.renameFile.bind(controller));
filesRoutes.delete("/:projectId/*", controller.deleteFile.bind(controller));

export { filesRoutes };
