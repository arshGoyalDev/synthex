import { type Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from ".";
import { pubsub } from "./database";

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
    console.log("incremented");
  }

  private decrementUserSockets(userId: string) {
    const current = this.activeSocketsByUser.get(userId) ?? 0;
    const next = Math.max(0, current - 1);
    console.log("decremented");

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

    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("No token"));

      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as {
          id: string;
          email: string;
        };
        socket.data.userId = payload.id;
        next();
      } catch {
        next(new Error("Invalid token"));
      }
    });

    io.on("connection", (socket) => {
      const userId = socket.data.userId;
      console.log(`[api_gateway] User connected: ${userId}`);

      this.incrementUserSockets(userId);
      this.cancelUserCleanup(userId);

      socket.join(`user:${userId}`);

      socket.on("disconnect", () => {
        console.log(`[api_gateway] User disconnected: ${userId}`);

        const activeCount = this.decrementUserSockets(userId);

        if (activeCount === 0) {
          console.log(
            `[api_gateway] Scheduling cleanup for disconnected user ${userId}`,
          );

          this.scheduleUserCleanup(userId);
        }
      });
    });
  }
}

const socketService = new SocketService();
export { socketService };
