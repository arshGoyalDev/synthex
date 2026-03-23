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
};

export { registerSubscribers };
