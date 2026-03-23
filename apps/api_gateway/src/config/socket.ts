import { type Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from ".";

class SocketService {
  public io: Server | null;

  constructor() {
    this.io = null;
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

      socket.join(`user:${userId}`);

      socket.on("disconnect", () => {
        console.log(`[api_gateway] User disconnected: ${userId}`);
      });
    });
  }
}

const socketService = new SocketService();
export { socketService };
