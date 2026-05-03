import { pubsub } from "./database";
import { Server as SocketServer } from "socket.io";

const registerSubscribers = async (io: SocketServer) => {
  pubsub.subscribe("container:status", (data) => {
    console.log(`[api_gateway] container:status for project ${data.projectId}`);

    io.to(`user:${data.userId}`).emit("container:status", {
      projectId: data.projectId,
      status: data.status,
      containerId: data.containerId,
      workDir: data.workDir,
      entryFile: data.entryFile,
      runCommand: data.runCommand,
      message: data.message,
    });
  });

  pubsub.subscribe("storage:file:mutation", (data) => {
    io.to(`user:${data.userId}`).emit("container:fs:change", {
      projectId: data.projectId,
      event: data.event,
      filePath: data.filePath,
      newPath: data.newPath,
      isFolder: false,
    });
  });

  pubsub.subscribe("storage:file:list-changed", (data) => {
    io.to(`user:${data.userId}`).emit("container:fs:refresh", {
      projectId: data.projectId,
    });
  });
};

export { registerSubscribers };
