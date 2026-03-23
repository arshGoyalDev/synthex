import { db, pubsub } from "../config/database";

const startTimeoutWatcher = async () => {
  setInterval(async () => {
    const timedOutProjects = await db.project.findMany({
      where: {
        containerStatus: { in: ["pending", "starting"] },
        createdAt: {
          lt: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
    });

    for (const project of timedOutProjects) {
      console.log(`[timeout-watcher] Project ${project.id} timed out`);

      await pubsub.publish("container:timeout", {
        projectId: project.id,
        userId: project.userId,
      });
    }
  }, 30 * 1000);
};

export { startTimeoutWatcher };
