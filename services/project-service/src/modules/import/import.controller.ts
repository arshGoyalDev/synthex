import { NextFunction, Request, Response } from "express";
import { ImportService } from "./import.service";
import { AppError } from "../../utils/AppError";
import {
  detectGithubSchema,
  importGithubSchema,
  detectZipSchema,
  importZipSchema,
  updateConfigSchema,
} from "./import.schema";

const importService = new ImportService();

class ImportController {
  async listGithubRepos(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) throw new AppError("Unauthorized", 401);

      const result = await importService.listGithubRepos(userId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async detectGithub(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      const { repoUrl } = detectGithubSchema.parse(req.body);
      const result = await importService.detectGithub(repoUrl, userId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async importGithub(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) throw new AppError("Unauthorized", 401);

      const data = importGithubSchema.parse(req.body);
      const project = await importService.importGithub(userId, data);
      res.status(201).json({ data: project });
    } catch (err) {
      next(err);
    }
  }

  async detectZip(req: Request, res: Response, next: NextFunction) {
    try {
      const { filePaths, fileContents } = detectZipSchema.parse(req.body);

      const result = await importService.detectZip(filePaths, fileContents ?? {});
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async importZip(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) throw new AppError("Unauthorized", 401);

      const data = importZipSchema.parse(req.body);
      const project = await importService.importZip(userId, data);
      res.status(201).json({ data: project });
    } catch (err) {
      next(err);
    }
  }

  async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;
      const projectId = req.params.id;

      if (!projectId) throw new AppError("Project ID is required", 400);
      if (!userId) throw new AppError("Unauthorized", 401);

      const data = updateConfigSchema.parse(req.body);
      const project = await importService.updateConfig(projectId, userId, data);
      res.json({ data: project });
    } catch (err) {
      next(err);
    }
  }
}

export { ImportController };
