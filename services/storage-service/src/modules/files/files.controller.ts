import { Request, Response, NextFunction } from "express";
import { FilesService } from "./files.service";
import { z } from "zod";
import { AppError } from "../../utils/AppError";

const filesService = new FilesService();

const saveFileSchema = z.object({
  filePath: z.string().min(1),
  content: z.string(),
});

function getWildcardPath(req: Request): string {
  const wildcard = (req.params as Record<string, string | undefined>)["0"];
  if (!wildcard) {
    throw new AppError("filePath is required", 400);
  }
  return wildcard;
}

class FilesController {
  async listFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.projectId;
      const files = await filesService.listFiles(projectId);

      res.json({ data: files });
    } catch (err) {
      next(err);
    }
  }

  async getLatestSnapshot(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.projectId;
      const key = await filesService.getLatestSnapshotKey(projectId);

      res.json({ data: { snapshotKey: key } });
    } catch (err) {
      next(err);
    }
  }

  async getFile(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.projectId;
      const filePath = getWildcardPath(req);
      const file = await filesService.getFile(projectId, filePath);

      res.json({ data: file });
    } catch (err) {
      next(err);
    }
  }

  async saveFile(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.projectId;
      const userId = req.headers["x-user-id"];
      const { filePath, content } = saveFileSchema.parse(req.body);

      await filesService.saveFile(
        projectId,
        userId,
        filePath,
        content,
      );

      res.json({ message: "File saved" });
    } catch (err) {
      next(err);
    }
  }

  async deleteFile(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = getProjectId(req);
      const filePath = getWildcardPath(req);

      await filesService.deleteFile(projectId, filePath);

      res.json({ message: "File deleted" });
    } catch (err) {
      next(err);
    }
  }
}

export { FilesController };
