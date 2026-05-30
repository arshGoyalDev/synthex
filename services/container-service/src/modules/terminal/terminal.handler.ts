import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { TerminalService } from "./terminal.service";
import { db } from "../../config/database";

const terminalService = new TerminalService();

const JWT_SECRET = process.env.JWT_SECRET;

interface TokenPayload {
  id: string;
  email: string;
}

function verifyToken(token: string): TokenPayload | null {
  if (!JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

const registerTerminalHandlers = (io: SocketServer) => {
  io.on("connection", async (socket: Socket) => {
    // ── 1. Authenticate via JWT ─────────────────────────────────────────────
    const rawToken =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization as string | undefined)?.replace(
        /^Bearer\s+/i,
        "",
      );

    if (!rawToken) {
      socket.emit("terminal:error", { message: "Unauthorized: missing token" });
      socket.disconnect();
      return;
    }

    const payload = verifyToken(rawToken);
    if (!payload) {
      socket.emit("terminal:error", { message: "Unauthorized: invalid token" });
      socket.disconnect();
      return;
    }

    const userId = payload.id; // always from verified token, never from query

    // ── 2. Validate required query params ────────────────────────────────────
    const projectId = socket.handshake.query.projectId as string;
    const terminalId = socket.handshake.query.terminalId as string;

    if (!projectId || !terminalId) {
      socket.emit("terminal:error", {
        message: "Missing projectId or terminalId",
      });
      socket.disconnect();
      return;
    }

    // ── 3. Verify project ownership ──────────────────────────────────────────
    try {
      const project = await db.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true },
      });

      if (!project) {
        socket.emit("terminal:error", {
          message: "Forbidden: project does not belong to you",
        });
        socket.disconnect();
        return;
      }
    } catch (err: any) {
      console.error("[terminal] Ownership check failed:", err.message);
      socket.emit("terminal:error", { message: "Internal error during auth" });
      socket.disconnect();
      return;
    }

    // ── 4. Attach terminal ───────────────────────────────────────────────────
    console.log(
      `[terminal] User ${userId} connected to project ${projectId} (${terminalId})`,
    );

    terminalService.attach(socket, projectId, terminalId);

    socket.on("disconnect", () => {
      console.log(
        `[terminal] User ${userId} disconnected from project ${projectId} (${terminalId})`,
      );
      terminalService.detach(terminalId, socket.id);
    });
  });
};

export { registerTerminalHandlers };
