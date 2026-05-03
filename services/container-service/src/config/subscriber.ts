import { ContainerService } from "../modules/container/container.service";
import { pubsub, redis } from "./database";

const containerService = new ContainerService();

interface ProjectData {
  projectId: string;
  projectName: string;
  userId: string;
  type: "raw" | "blank" | "template";
  template: null | string;
  languages: null | string[];
}

const registerSubscribers = async () => {
  await pubsub.subscribe("project:created", async (data) => {
    const { projectId } = data;

    console.log(
      "[container-service] project:created event:",
      data.projectId,
      data.projectName,
    );

    startContainerSetup(data).catch((err) => {
      console.error(
        `[container-service] Unhandled error for ${projectId}:`,
        err.message,
      );
    });
  });

  await pubsub.subscribe("project:start", async (data) => {
    const { projectId, userId } = data;

    console.log(
      "[container-service] project:start event:",
      data.projectId,
      data.projectName,
    );

    startContainerSetup(data).catch((err) => {
      console.error(
        `[container-service] Unhandled error for ${projectId}:`,
        err.message,
      );
    });
  });

  await pubsub.subscribe("project:stop", async (data) => {
    try {
      await containerService
        .stopContainer(data.projectId, data.userId, data.projectName)
        .catch((err) => {
          console.error(
            `[container-service] Unhandled error for ${data.projectId}:`,
            err.message,
          );
        });

      await pubsub.publish("container:status", {
        projectId: data.projectId,
        userId: data.userId,
        status: "stopped",
        message: "Environment stopped",
      });
    } catch (err: any) {
      console.error(
        `[container-service] Failed to stop ${data.projectId}:`,
        err,
      );

      await pubsub.publish("container:status", {
        projectId: data.projectId,
        userId: data.userId,
        status: "error",
        message: err.message,
      });
    }
  });

  await pubsub.subscribe("container:timeout", async (data) => {
    console.log(
      `[container-service] Cleaning up timed out container for ${data.projectId}`,
    );

    await containerService
      .cleanupContainer(data.projectId, data.userId, data.projectName ?? data.projectId)
      .catch((err) => {
      console.error("Cleanup failed:", err);
    });

    await pubsub.publish("container:status", {
      projectId: data.projectId,
      userId: data.userId,
      status: "timeout",
      message: "Container setup timed out. Please try again.",
    });
  });

  await pubsub.subscribe("user:cleanup", async (data) => {
    try {
      await containerService.cleanupUserContainers(data.userId);
      console.log(
        `[container-service] Cleaned up all containers for user ${data.userId}`,
      );
    } catch (err: any) {
      console.error(
        `[container-service] Failed to cleanup containers for user ${data.userId}:`,
        err,
      );
    }
  });

  await pubsub.subscribe("storage:file:mutation", async (data) => {
    try {
      await containerService.applyStorageMutation(data);
    } catch (err: any) {
      console.error(
        `[container-service] Failed to apply storage mutation for ${data.projectId}:`,
        err.message,
      );
    }
  });
};

const startContainerSetup = async (projectData: ProjectData) => {
  const { projectId, userId, projectName, languages, template } = projectData;
  try {
    await pubsub.publish("container:status", {
      projectId,
      userId,
      status: "starting",
      message: "Setting up your environment...",
    });

    await containerService.startProjectContainer(
      projectId,
      projectName,
      userId,
      languages ?? undefined,
      template ?? undefined,
    );

    await redis.del(`container:timeout:${projectId}`);

    await pubsub.publish("container:status", {
      projectId,
      userId,
      status: "ready",
      message: "Environment is ready",
    });
  } catch (err: any) {
    console.error(`[container-service] Failed for ${projectId}:`, err);

    await containerService
      .cleanupContainer(projectId, userId, projectName)
      .catch(() => {});

    await redis.del(`container:timeout:${projectId}`);

    await pubsub.publish("container:status", {
      projectId,
      userId,
      status: "error",
      message: err.message || "Failed to set up environment",
    });
  }
};

export { registerSubscribers };
