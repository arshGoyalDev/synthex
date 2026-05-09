import { db } from "../config/database";
import { releaseLock } from "../utils/lock";
import { clearBuffer } from "../utils/buffer";

const STALE_THRESHOLD_MS = 35 * 60 * 1000; // 35 minutes

const startStaleWatcher = () => {
  setInterval(
    async () => {
      try {
        const stale = await db.executionLog.findMany({
          where: {
            status: { in: ["queued", "running"] },
            isDevServer: false,
            createdAt: { lt: new Date(Date.now() - STALE_THRESHOLD_MS) },
          },
        });

        for (const exec of stale) {
          console.log(`[stale-watcher] Marking ${exec.executionId} as failed`);

          await db.executionLog.update({
            where: { executionId: exec.executionId },
            data: { status: "failed", completedAt: new Date() },
          });

          await releaseLock(exec.projectId);
          await clearBuffer(exec.executionId);
        }

        if (stale.length > 0) {
          console.log(
            `[stale-watcher] Cleaned ${stale.length} stale executions`,
          );
        }
      } catch (err: any) {
        console.error(`[stale-watcher] Error:`, err.message);
      }
    },
    5 * 60 * 1000,
  ); // every 5 minutes
};

export { startStaleWatcher };
