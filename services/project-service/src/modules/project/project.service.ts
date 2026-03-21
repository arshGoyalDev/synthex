import { db } from "../../config/database";
import { AppError } from "../../utils/AppError";

class ProjectService {
  async getProjectsMe(userId: string) {
    const projects = await db.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return projects;
  }

  async getProjectById(id: string) {
    if (!id) throw new AppError("Project ID is required", 400);

    const project = await db.project.findUnique({
      where: { id },
    });

    if (!project) throw new AppError("Project not found", 404);

    return project;
  }
}

export { ProjectService };