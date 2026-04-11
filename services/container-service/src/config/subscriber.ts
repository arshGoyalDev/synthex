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
      "Received project:created event:",
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
      "Received project:start event:",
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
      await containerService.stopContainer(data.projectId).catch((err) => {
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

    await containerService.cleanupContainer(data.projectId).catch((err) => {
      console.error("Cleanup failed:", err);
    });

    await pubsub.publish("container:status", {
      projectId: data.projectId,
      userId: data.userId,
      status: "timeout",
      message: "Container setup timed out. Please try again.",
    });
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

    // await containerService.createProjectContainer(
    //   projectId,
    //   projectName,
    //   languages ?? undefined,
    //   template ?? undefined,
    // );

    await redis.del(`container:timeout:${projectId}`);

    await pubsub.publish("container:status", {
      projectId,
      userId,
      status: "ready",
      message: "Environment is ready",
    });
  } catch (err: any) {
    console.error(`[container-service] Failed for ${projectId}:`, err);

    await containerService.cleanupContainer(projectId).catch(() => {});

    await redis.del(`container:timeout:${projectId}`);

    await pubsub.publish("container:status", {
      projectId,
      userId,
      status: "error",
      message: "Failed to set up environment",
    });
  }
};

export { registerSubscribers };
