import { db, pubsub, redis } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { safeName } from "../../utils/project";

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

  async createProject(
    userId: string,
    data: {
      name: string;
      description?: string;
      template: string;
      languages: string[];
      type: "template" | "blank" | "raw";
    },
  ) {
    if (!data.name) throw new AppError("Project name is required", 400);

    const project = await db.project.create({
      data: {
        name: data.name,
        folderName: safeName(data.name),
        description: data.description,
        template: data.template,
        languages: data.languages,
        type: data.type,
        userId,
      },
    });

    await pubsub.publish("project:created", {
      projectId: project.id,
      projectName: safeName(data.name),
      userId,
      type: data.type,
      template: data.type === "template" ? data.template : null,
      languages: data.type === "blank" ? data.languages : null,
    });

    await redis.set(
      `container:timeout:${project.id}`,
      JSON.stringify({ projectId: project.id, userId }),
      "EX",
      5 * 60,
    );

    return project;
  }

  async startProject(id: string) {
    const project = await db.project.findUnique({ where: { id } });

    if (!project) throw new AppError("Project not found", 404);

    if (project.containerStatus === "ready") {
      return { alreadyRunning: true, project };
    }

    const startStates = ["pending", "stopped", "error", "timeout"];
    if (!startStates.includes(project.containerStatus)) {
      throw new AppError(
        `Cannot start project from state: ${project.containerStatus}`,
        400,
      );
    }
    await db.project.update({
      where: { id },
      data: { containerStatus: "pending" },
    });

    await pubsub.publish("project:start", {
      projectId: project.id,
      projectName: project.folderName,
      userId: project.userId,
      type: project.type,
      template: project.type === "template" ? project.template : null,
      languages: project.type === "blank" ? project.languages : null,
    });

    await redis.set(
      `container:timeout:${project.id}`,
      JSON.stringify({ projectId: project.id, userId: project.userId }),
      "EX",
      5 * 60, // 5 minutes
    );

    return { alreadyRunning: false, project };
  }

  async stopProject(id: string) {
    const project = await db.project.findUnique({ where: { id } });

    if (!project) throw new AppError("Project not found", 404);

    if (project.containerStatus !== "ready") {
      throw new AppError("Only running projects can be stopped", 400);
    }

    await pubsub.publish("project:stop", {
      projectId: project.id,
      userId: project.userId,
    });
  }
}

export { ProjectService };
