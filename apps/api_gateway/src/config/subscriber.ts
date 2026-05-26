import { pubsub, redis } from "./database";
import { Server as SocketServer } from "socket.io";
import {
  registerPreviewProxy,
  removePreviewProxy,
} from "../proxy/preview.proxy";

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
      previewCommand: data.previewCommand,
      previewPort: data.previewPort,
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

  pubsub.subscribe("execution:output", (data) => {
    io.to(`execution:${data.executionId}`).emit("execution:output", {
      executionId: data.executionId,
      seq: data.seq,
      data: data.data,
      type: data.type,
      timestamp: data.timestamp,
    });
  });

  // ─── Execution status → execution room ───────────────────────────────────
  pubsub.subscribe("execution:status", (data) => {
    io.to(`execution:${data.executionId}`).emit("execution:status", {
      executionId: data.executionId,
      status: data.status,
    });
  });

  // ─── Execution done → execution room ─────────────────────────────────────
  pubsub.subscribe("execution:done", (data) => {
    io.to(`execution:${data.executionId}`).emit("execution:done", {
      executionId: data.executionId,
      exitCode: data.exitCode,
      durationMs: data.durationMs,
      timedOut: data.timedOut,
      killed: data.killed,
    });
  });

  // ─── Preview status → user room ──────────────────────────────────────────
  pubsub.subscribe("preview:status", async (data) => {
    if (data.status === "ready") {
      // register dynamic proxy for this project
      const target = await redis.get(`preview:${data.projectId}:target`);
      if (target) {
        registerPreviewProxy(data.projectId, target);
      }
    }

    if (data.status === "stopped" || data.status === "error") {
      removePreviewProxy(data.projectId);
    }

    io.to(`user:${data.userId}`).emit("preview:status", {
      projectId: data.projectId,
      status: data.status,
      previewUrl: data.previewUrl,
      message: data.message,
    });
  });

  // ─── Preview output → preview room ───────────────────────────────────────
  pubsub.subscribe("preview:output", (data) => {
    io.to(`preview:${data.projectId}`).emit("preview:output", {
      projectId: data.projectId,
      data: data.data,
    });
  });
};

export { registerSubscribers };
