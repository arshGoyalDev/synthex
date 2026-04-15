import { Server as SocketServer, Socket } from "socket.io";
import { TerminalService } from "./terminal.service";

const terminalService = new TerminalService();

const registerTerminalHandlers = (io: SocketServer) => {
  io.on("connection", (socket: Socket) => {
    const projectId = socket.handshake.query.projectId as string;
    const userId = socket.handshake.query.userId as string;
    const terminalId = socket.handshake.query.terminalId as string;

    if (!projectId || !userId || !terminalId) {
      socket.emit("terminal:error", {
        message: "Missing projectId, userId or terminalId",
      });
      socket.disconnect();
      return;
    }

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
