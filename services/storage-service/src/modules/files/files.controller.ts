import { Request, Response, NextFunction } from "express";
import { FilesService } from "./files.service";
import { z } from "zod";
import { AppError } from "../../utils/AppError";

const filesService = new FilesService();

const saveFileSchema = z.object({
  filePath: z.string().min(1),
  content: z.string(),
});

const renameFileSchema = z.object({
  newPath: z.string().min(1),
});

function getProjectId(req: Request): string {
  const projectId = req.params.projectId;
  if (!projectId) {
    throw new AppError("projectId is required", 400);
  }
  return projectId;
}

function getUserId(req: Request): string {
  const userId = req.headers["x-user-id"];
  if (typeof userId !== "string" || !userId) {
    throw new AppError("userId is required", 401);
  }
  return userId;
}

function getWildcardPath(req: Request): string {
  const wildcard = (req.params as Record<string, string | undefined>)["0"];
  if (!wildcard) {
    throw new AppError("filePath is required", 400);
  }
  return filesService.normalizeFilePath(wildcard);
}

class FilesController {
  async listFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = getProjectId(req);
      const userId = getUserId(req);
      const files = await filesService.listFiles(projectId, userId);

      res.json({ data: files });
    } catch (err) {
      next(err);
    }
  }

  async getLatestSnapshot(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = getProjectId(req);
      const userId = getUserId(req);
      const key = await filesService.getLatestSnapshotKey(projectId, userId);

      res.json({ data: { snapshotKey: key } });
    } catch (err) {
      next(err);
    }
  }

  async getFile(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = getProjectId(req);
      const userId = getUserId(req);
      const filePath = getWildcardPath(req);
      const file = await filesService.getFile(projectId, filePath, userId);

      res.json({ data: file });
    } catch (err) {
      next(err);
    }
  }

  async saveFile(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = getProjectId(req);
      const userId = getUserId(req);
      const { filePath, content } = saveFileSchema.parse(req.body);
      const normalizedPath = filesService.normalizeFilePath(filePath);

      const file = await filesService.saveFile(
        projectId,
        userId,
        normalizedPath,
        content,
      );

      res.json({ data: file });
    } catch (err) {
      next(err);
    }
  }

  async deleteFile(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = getProjectId(req);
      const userId = getUserId(req);
      const filePath = getWildcardPath(req);

      await filesService.deleteStoredFile(projectId, userId, filePath);

      res.json({ message: "File deleted" });
    } catch (err) {
      next(err);
    }
  }

  async renameFile(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = getProjectId(req);
      const userId = getUserId(req);
      const filePath = getWildcardPath(req);
      const { newPath } = renameFileSchema.parse(req.body);

      await filesService.renameFile(projectId, userId, filePath, newPath);

      res.json({ message: "File renamed" });
    } catch (err) {
      next(err);
    }
  }
}

export { FilesController };
