import { NextFunction, Request, Response } from "express";
import { createProjectSchema } from "./project.schema";
import { ProjectService } from "./project.service";

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
      const project = await projectService.getProjectById(req.params.id);

      res.json({ data: project });
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
      
      await projectService.startProject(projectId);

      res.json({ message: "Project starting" });
    } catch (err) {
      next(err);
    }
  }

  async stopProject(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.id;
      
      await projectService.stopProject(projectId);

      res.json({ message: "Project stopped" });
    } catch (err) {
      next(err);
    }
  }
}

export { ProjectController };
