import { Server as SocketServer, Socket } from "socket.io";
import { TerminalService } from "./terminal.service";

const terminalService = new TerminalService();

const registerTerminalHandlers = (io: SocketServer) => {
  io.on("connection", (socket: Socket) => {
    const projectId = socket.handshake.query.projectId as string;
    const userId = socket.handshake.query.userId as string;

    if (!projectId || !userId) {
      socket.emit("terminal:error", { message: "Missing projectId or userId" });
      socket.disconnect();
      return;
    }

    console.log(`[terminal] User ${userId} connected to project ${projectId}`);

    terminalService.attach(socket, projectId);

    socket.on("disconnect", () => {
      console.log(
        `[terminal] User ${userId} disconnected from project ${projectId}`,
      );
      terminalService.detach(projectId, socket.id);
    });
  });
};

export { registerTerminalHandlers };
