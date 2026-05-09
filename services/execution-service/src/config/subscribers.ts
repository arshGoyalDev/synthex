import { pubsub } from "./database";

import { ExecutionService } from "../module/execution/execution.service";

const executionService = new ExecutionService();

const registerSubscribers = async () => {
  // container-service finished execution
  await pubsub.subscribe("execution:done", async (data) => {
    console.log(
      `[execution-service] execution:done ${data.executionId} exit=${data.exitCode}`,
    );

    try {
      const status = await executionService.handleExecutionDone(data);
      console.log(
        `[execution-service] Execution ${data.executionId} → ${status}`,
      );
    } catch (err: any) {
      console.error(
        `[execution-service] handleExecutionDone failed:`,
        err.message,
      );
    }
  });

  // container-service preview is ready
  await pubsub.subscribe("preview:ready", async (data) => {
    console.log(
      `[execution-service] preview:ready ${data.projectId} port=${data.hostPort}`,
    );

    try {
      await executionService.handlePreviewReady(data);
    } catch (err: any) {
      console.error(
        `[execution-service] handlePreviewReady failed:`,
        err.message,
      );
    }
  });

  // container-service preview errored
  await pubsub.subscribe("preview:error", async (data) => {
    console.log(`[execution-service] preview:error ${data.projectId}`);

    const { pubsub: pub } = await import("./database.js");
    
    await pub.publish("preview:status", {
      projectId: data.projectId,
      userId: data.userId,
      status: "error",
      previewUrl: "",
      message: data.message,
    });
  });
};

export { registerSubscribers };
