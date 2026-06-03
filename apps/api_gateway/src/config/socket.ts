import { type Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";
import { db, executionDb, pubsub, redis } from "./database";

const USER_CLEANUP_DELAY_MS = 10 * 60 * 1000;

class SocketService {
  public io: Server | null;
  private activeSocketsByUser: Map<string, number>;
  private cleanupTimersByUser: Map<string, NodeJS.Timeout>;

  constructor() {
    this.io = null;
    this.activeSocketsByUser = new Map();
    this.cleanupTimersByUser = new Map();
  }

  private incrementUserSockets(userId: string) {
    const current = this.activeSocketsByUser.get(userId) ?? 0;
    this.activeSocketsByUser.set(userId, current + 1);
  }

  private decrementUserSockets(userId: string) {
    const current = this.activeSocketsByUser.get(userId) ?? 0;
    const next = Math.max(0, current - 1);

    if (next === 0) {
      this.activeSocketsByUser.delete(userId);
      return 0;
    }

    this.activeSocketsByUser.set(userId, next);
    return next;
  }

  private cancelUserCleanup(userId: string) {
    const existingTimer = this.cleanupTimersByUser.get(userId);
    if (!existingTimer) return;

    clearTimeout(existingTimer);
    this.cleanupTimersByUser.delete(userId);

    console.log(`[api_gateway] Cleanup cancelled for user ${userId}`);
  }

  private scheduleUserCleanup(userId: string) {
    this.cancelUserCleanup(userId);

    const timer = setTimeout(async () => {
      const stillActive = this.activeSocketsByUser.get(userId) ?? 0;
      if (stillActive > 0) {
        return;
      }

      await pubsub.publish("user:cleanup", { userId });
      this.cleanupTimersByUser.delete(userId);

      console.log(
        `[api_gateway] Cleanup completed for disconnected user ${userId}`,
      );
    }, USER_CLEANUP_DELAY_MS);

    this.cleanupTimersByUser.set(userId, timer);
  }

  public init(io: Server) {
    this.io = io;

    io.use(async (socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("No token"));

      const payload = await verifyAccessToken(token);
      if (!payload) return next(new Error("Invalid or revoked token"));

      socket.data.userId = payload.id;
      next();
    });

    io.on("connection", (socket) => {
      const userId = socket.data.userId;
      console.log(`[api_gateway] User connected: ${userId}`);

      this.incrementUserSockets(userId);
      this.cancelUserCleanup(userId);

      socket.join(`user:${userId}`);

      socket.on("execution:join", async ({ executionId, fromSeq = 0 }) => {
        const canJoin = await canJoinExecution(userId, executionId);
        if (!canJoin) {
          socket.emit("execution:error", {
            executionId,
            message: "Execution access denied",
          });
          return;
        }

        socket.join(`execution:${executionId}`);
        console.log(`[gateway] ${userId} joined execution:${executionId}`);

        // replay buffered output for reconnect
        if (fromSeq > 0) {
          const buffered = await redis.lrange(
            `execution:buffer:${executionId}`,
            0,
            -1,
          );

          const chunks = buffered
            .map((r) => {
              try {
                return JSON.parse(r);
              } catch {
                return null;
              }
            })
            .filter((c) => c !== null && c.seq >= fromSeq)
            .sort((a: any, b: any) => a.seq - b.seq);

          for (const chunk of chunks) {
            socket.emit("execution:output", {
              executionId,
              ...chunk,
            });
          }
        }
      });

      socket.on("execution:leave", ({ executionId }) => {
        socket.leave(`execution:${executionId}`);
      });

      socket.on("execution:input", async ({ executionId, input }) => {
        if (!executionId || typeof input !== "string") return;
        const canSend = await canJoinExecution(userId, executionId);
        if (!canSend) return;
        await pubsub.publish("execution:input", { executionId, input });
      });

      socket.on("preview:join", async ({ projectId }) => {
        const canJoin = await canJoinProject(userId, projectId);
        if (!canJoin) {
          socket.emit("preview:status", {
            projectId,
            status: "error",
            message: "Preview access denied",
          });
          return;
        }

        socket.join(`preview:${projectId}`);
        console.log(`[gateway] ${userId} joined preview:${projectId}`);
      });

      socket.on("preview:leave", ({ projectId }) => {
        socket.leave(`preview:${projectId}`);
      });

      // ─── Setup log room ──────────────────────────────────────────────────
      socket.on("setup:join", async ({ projectId, fromSeq = 0 }) => {
        const canJoin = await canJoinProject(userId, projectId);
        if (!canJoin) {
          socket.emit("setup:error", {
            projectId,
            message: "Setup access denied",
          });
          return;
        }

        socket.join(`setup:${projectId}`);
        console.log(`[gateway] ${userId} joined setup:${projectId}`);

        // Replay buffered lines for reconnect
        const buffered = await redis.lrange(`setup:buffer:${projectId}`, 0, -1);
        const lines = buffered
          .map((r) => { try { return JSON.parse(r); } catch { return null; } })
          .filter((c) => c !== null && (fromSeq === 0 || c.seq >= fromSeq))
          .sort((a: any, b: any) => a.seq - b.seq);

        for (const line of lines) {
          socket.emit("setup:log", { projectId, ...line });
        }

        // Send current status and progress so the UI can reconstruct state
        const [status, progressStr] = await Promise.all([
          redis.get(`setup:status:${projectId}`),
          redis.get(`setup:progress:${projectId}`),
        ]);
        if (status) {
          socket.emit("setup:status", {
            projectId,
            status,
            progress: progressStr ? parseInt(progressStr, 10) : 0,
          });
        }
      });

      socket.on("setup:leave", ({ projectId }) => {
        socket.leave(`setup:${projectId}`);
      });

      socket.on("disconnect", () => {
        console.log(`[gateway] User disconnected: ${userId}`);

        const activeCount = this.decrementUserSockets(userId);

        if (activeCount === 0) {
          console.log(
            `[gateway] Scheduling cleanup for disconnected user ${userId}`,
          );

          this.scheduleUserCleanup(userId);
        }
      });
    });
  }
}

const socketService = new SocketService();
export { socketService };

async function canJoinProject(userId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  return !!project;
}

async function canJoinExecution(userId: string, executionId: string) {
  const meta = await redis.get(`execution:meta:${executionId}`);
  if (meta) {
    try {
      return JSON.parse(meta).userId === userId;
    } catch {
      return false;
    }
  }

  const execution = await executionDb.executionLog.findFirst({
    where: { executionId, userId },
    select: { executionId: true },
  });

  return !!execution;
}
