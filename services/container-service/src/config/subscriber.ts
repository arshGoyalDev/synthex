import { ContainerService } from "../modules/container/container.service";
import { pubsub, redis } from "./database";

const containerService = new ContainerService();

const registerSubscribers = async () => {
  await pubsub.subscribe("project:created", async (data) => {
    const { projectId, userId } = data;

    console.log(
      "Received project:created event:",
      data.projectId,
      data.projectName,
    );

    startContainerSetup(projectId, userId).catch((err) => {
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

    startContainerSetup(projectId, userId).catch((err) => {
      console.error(
        `[container-service] Unhandled error for ${projectId}:`,
        err.message,
      );
    });
  });

  await pubsub.subscribe("project:stop", async (data) => {
    try {
      // containerService.stopContainer

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

    // await containerService.cleanupContainer(data.projectId)

    await pubsub.publish("container:status", {
      projectId: data.projectId,
      userId: data.userId,
      status: "timeout",
      message: "Container setup timed out. Please try again.",
    });
  });
};

const startContainerSetup = async (projectId: string, userId: string) => {
  try {
    await pubsub.publish("container:status", {
      projectId,
      userId,
      status: "starting",
      message: "Setting up your environment...",
    });

    // containerService.startContainer

    await redis.del(`container:timeout:${projectId}`);

    await pubsub.publish("container:status", {
      projectId,
      userId,
      status: "ready",
      message: "Environment is ready",
    });
  } catch (err: any) {
    console.error(`[container-service] Failed for ${projectId}:`, err);

    // containerService.cleanupContainer()

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
