import { db, pubsub, redis } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { safeName } from "../../utils/project";
import { LANGUAGES, TEMPLATES, PREVIEW_TEMPLATE_IDS } from "@synthex/templates";


class ProjectService {
  async getProjectsMe(userId: string) {
    const projects = await db.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return projects.map((project) => this.withRuntimeConfig(project));
  }

  async getProjectById(id: string) {
    if (!id) throw new AppError("Project ID is required", 400);

    const project = await db.project.findUnique({
      where: { id },
    });

    if (!project) throw new AppError("Project not found", 404);

    return this.withRuntimeConfig(project);
  }

  async getProjectEnvVars(projectId: string, userId: string) {
    if (!projectId) throw new AppError("Project ID is required", 400);
    if (!userId) throw new AppError("User ID is required", 400);

    const project = await db.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new AppError("Project not found", 404);

    return {
      envVars: (project.envVars as Record<string, string> | null) ?? null,
    };
  }

  async updateProject(
    id: string,
    userId: string,
    data: {
      name: string;
      description?: string | null;
      autoSaveEnabled?: boolean;
    },
  ) {
    if (!id) throw new AppError("Project ID is required", 400);
    if (!data.name) throw new AppError("Project name is required", 400);

    const project = await db.project.findFirst({
      where: { id, userId },
    });

    if (!project) throw new AppError("Project not found", 404);

    const updated = await db.project.update({
      where: { id },
      data: {
        name: data.name,
        folderName: safeName(data.name),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.autoSaveEnabled !== undefined && {
          autoSaveEnabled: data.autoSaveEnabled,
        }),
      },
    });

    return this.withRuntimeConfig(updated);
  }

  async deleteProject(id: string, userId: string) {
    if (!id) throw new AppError("Project ID is required", 400);

    const project = await db.project.findFirst({
      where: { id, userId },
    });

    if (!project) throw new AppError("Project not found", 404);

    await pubsub.publish("project:delete", {
      projectId: project.id,
      projectName: project.folderName,
      userId: project.userId,
    });

    await pubsub.publish("storage:project:delete", {
      projectId: project.id,
      userId: project.userId,
    });

    await pubsub.publish("execution:project:delete", {
      projectId: project.id,
      userId: project.userId,
    });

    await redis.del(`container:timeout:${project.id}`);

    await db.project.delete({
      where: { id },
    });

    return;
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

    const createdType = project.importSource ? "blank" : data.type;
    const createdLanguages = project.importSource
      ? data.languages
      : data.type === "blank"
        ? data.languages
        : null;

    await pubsub.publish("project:created", {
      projectId: project.id,
      projectName: safeName(data.name),
      userId,
      importSource: project.importSource ?? null,
      repoUrl: project.repoUrl ?? null,
      repoBranch: project.repoBranch ?? null,
      zipKey: project.zipKey ?? null,
      installCommand: project.installCommand ?? null,
      runCommand: project.runCommand ?? null,
      previewCommand: project.previewCommand ?? null,
      previewPort: project.previewPort ?? null,
      envVars: (project.envVars as Record<string, string> | null) ?? null,
      type: createdType,
      template: createdType === "template" ? data.template : null,
      languages: createdLanguages,
    });

    await redis.set(
      `container:timeout:${project.id}`,
      JSON.stringify({ projectId: project.id, userId }),
      "EX",
      5 * 60,
    );

    return this.withRuntimeConfig(project);
  }

  async startProject(id: string) {
    const project = await db.project.findUnique({ where: { id } });

    if (!project) throw new AppError("Project not found", 404);

    if (project.containerStatus === "ready") {
      return { alreadyRunning: true, project: this.withRuntimeConfig(project) };
    }

    if (
      project.containerStatus === "pending" ||
      project.containerStatus === "starting" ||
      project.containerStatus === "installing"
    ) {
      return {
        alreadyRunning: false,
        alreadyStarting: true,
        project: this.withRuntimeConfig(project),
      };
    }

    const startStates = ["stopped", "error", "timeout"];
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

    const startType = project.importSource ? "blank" : project.type;
    const startLanguages = project.importSource
      ? project.languages
      : project.type === "blank"
        ? project.languages
        : null;

    await pubsub.publish("project:start", {
      projectId: project.id,
      projectName: project.folderName,
      userId: project.userId,
      importSource: project.importSource ?? null,
      repoUrl: project.repoUrl ?? null,
      repoBranch: project.repoBranch ?? null,
      zipKey: project.zipKey ?? null,
      installCommand: project.installCommand ?? null,
      runCommand: project.runCommand ?? null,
      previewCommand: project.previewCommand ?? null,
      previewPort: project.previewPort ?? null,
      envVars: (project.envVars as Record<string, string> | null) ?? null,
      type: startType,
      template: startType === "template" ? project.template : null,
      languages: startLanguages,
    });

    await redis.set(
      `container:timeout:${project.id}`,
      JSON.stringify({ projectId: project.id, userId: project.userId }),
      "EX",
      5 * 60,
    );

    return { alreadyRunning: false, project: this.withRuntimeConfig(project) };
  }

  async stopProject(id: string) {
    const project = await db.project.findUnique({ where: { id } });

    if (!project) throw new AppError("Project not found", 404);

    if (
      project.containerStatus === "ready" ||
      project.containerStatus === "pending" ||
      project.containerStatus === "starting" ||
      project.containerStatus === "installing" ||
      project.containerStatus === "stopping"
    ) {
      await db.project.update({
        where: { id },
        data: { containerStatus: "stopping" },
      });

      await pubsub.publish("project:stop", {
        projectId: project.id,
        userId: project.userId,
      });
      return { wasRunning: true };
    }

    return { wasRunning: false };
  }

  private withRuntimeConfig(project: any) {
    // Imported projects use their stored runtime config directly
    if (project.importSource) {
      return {
        ...project,
        runCommand: project.runCommand ?? null,
        previewCommand: project.previewCommand ?? null,
        previewPort: project.previewPort ?? null,
      };
    }

    const runtimeConfig = this.getRuntimeConfig(project);
    return {
      ...project,
      runCommand: runtimeConfig.runCommand,
      previewCommand: runtimeConfig.previewCommand,
      previewPort: runtimeConfig.previewPort,
    };
  }

  private getRuntimeConfig(project: {
    type: "template" | "blank" | "raw";
    template: string | null;
    languages: string[];
  }) {
    if (project.type === "template" && project.template) {
      const template = TEMPLATES[project.template];
      if (!template) {
        return { runCommand: null, previewCommand: null, previewPort: null };
      }

      const isPreviewTemplate = PREVIEW_TEMPLATE_IDS.has(project.template);
      return {
        runCommand: isPreviewTemplate ? null : template.runCommand,
        previewCommand: isPreviewTemplate ? template.runCommand : null,
        previewPort: isPreviewTemplate ? (template.defaultPort ?? null) : null,
      };
    }

    const primaryLanguage = project.languages?.[0];
    const language = primaryLanguage ? LANGUAGES[primaryLanguage] : null;

    return {
      runCommand: language?.runCommand ?? null,
      previewCommand: null,
      previewPort: null,
    };
  }
}

export { ProjectService };
