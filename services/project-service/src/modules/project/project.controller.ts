import { ProjectService } from "./project.service";

const projectService = new ProjectService();

class ProjectController {
  async getProjectsMe(req: any, res: any, next: any) {
    try {
      const userId = req.headers["x-user-id"];

      const projects = await projectService.getProjectsMe(userId);

      res.json({ data: projects });
    } catch (err) {
      next(err);
    }
  }

  async getProjectById(req: any, res: any, next: any) {
    try {
      const project = await projectService.getProjectById(req.params.id);

      res.json({ data: project });
    } catch (err) {
      next(err);
    }
  }
}

export { ProjectController };
