import { NextFunction, Request, Response } from "express";
import { createProjectSchema, updateProjectSchema } from "./project.schema";
import { ProjectService } from "./project.service";
import { AppError } from "../../utils/AppError";

const projectService = new ProjectService();

class ProjectController {
  async getProjectsMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;

      const projects = await projectService.getProjectsMe(userId);

      res.json({ data: projects });
    } catch (err) {
      next(err);
    }
  }

  async getProjectById(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id;

      if (!projectId) {
        throw new AppError("Project ID is required", 400);
      }

      const project = await projectService.getProjectById(projectId);

      res.json({ data: project });
    } catch (err) {
      next(err);
    }
  }

  async getProjectEnvVars(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;
      const projectId = req.params.id;

      if (!projectId) {
        throw new AppError("Project ID is required", 400);
      }
      if (!userId) throw new AppError("Unauthorized", 401);

      const result = await projectService.getProjectEnvVars(projectId, userId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateProject(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;
      const projectId = req.params.id;

      if (!projectId) {
        throw new AppError("Project ID is required", 400);
      }

      const { name, description, autoSaveEnabled } = updateProjectSchema.parse(
        req.body,
      );
      const project = await projectService.updateProject(projectId, userId, {
        name,
        description,
        autoSaveEnabled,
      });

      res.json({ data: project });
    } catch (err) {
      next(err);
    }
  }

  async deleteProject(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;
      const projectId = req.params.id;

      if (!projectId) {
        throw new AppError("Project ID is required", 400);
      }

      await projectService.deleteProject(projectId, userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async createProject(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;
      const { name, description, template, languages, type } =
        createProjectSchema.parse(req.body);

      const project = await projectService.createProject(userId, {
        name,
        description,
        template: template ?? "",
        languages: languages ?? [],
        type,
      });

      res.json({ data: project });
    } catch (err) {
      next(err);
    }
  }

  async startProject(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id;

      if (!projectId) {
        throw new AppError("Project ID is required", 400);
      }

      const result = await projectService.startProject(projectId);

      if (result.alreadyRunning) {
        return res.json({
          status: "ready",
          message: "Container already running",
          runCommand: result.project.runCommand,
          previewCommand: result.project.previewCommand,
          previewPort: result.project.previewPort,
        });
      }

      if (result.alreadyStarting) {
        return res.json({
          status: "starting",
          message: "Project already starting",
          runCommand: result.project.runCommand,
          previewCommand: result.project.previewCommand,
          previewPort: result.project.previewPort,
        });
      }

      res.json({
        message: "Project starting",
        status: "starting",
        runCommand: result.project.runCommand,
        previewCommand: result.project.previewCommand,
        previewPort: result.project.previewPort,
      });
    } catch (err) {
      next(err);
    }
  }

  async stopProject(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id;

      if (!projectId) {
        throw new AppError("Project ID is required", 400);
      }

      const result = await projectService.stopProject(projectId);

      if (!result.wasRunning) {
        return res.json({ message: "Project already stopped" });
      }

      res.json({ message: "Project stopping", status: "stopping" });
    } catch (err) {
      next(err);
    }
  }
}

export { ProjectController };
