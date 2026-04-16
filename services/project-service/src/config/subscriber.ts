import { db, pubsub } from "./database";

const registerSubscribers = async () => {
  await pubsub.subscribe("container:status", async (data) => {
    console.log(
      "Received container:status event:",
      data.projectId,
      data.status,
    );

    try {
      await db.project.update({
        where: { id: data.projectId },
        data: { containerStatus: data.status },
      });
    } catch (err) {
      console.error(`[project-service] Failed to update status:`, err);
    }
  });

  await pubsub.subscribe("user:cleanup", async (data) => {
    try {
      await db.project.updateMany({
        where: {
          userId: data.userId,
          containerStatus: { in: ["pending", "starting", "ready"] },
        },
        data: { containerStatus: "stopped" },
      });
    } catch (err) {
      console.error(
        `[project-service] Failed to reconcile user cleanup for ${data.userId}:`,
        err,
      );
    }
  });
};

export { registerSubscribers };
