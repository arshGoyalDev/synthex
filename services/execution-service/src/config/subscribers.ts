import { pubsub } from "./database";

import { ExecutionService } from "../modules/execution/execution.service";

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

    await executionService.handlePreviewError(data);
  });

  await pubsub.subscribe("execution:project:delete", async (data) => {
    try {
      await executionService.deleteProjectExecutions(data.projectId);
      console.log(
        `[execution-service] Deleted execution logs for ${data.projectId}`,
      );
    } catch (err: any) {
      console.error(
        `[execution-service] Project execution cleanup failed for ${data.projectId}:`,
        err.message,
      );
    }
  });
};

export { registerSubscribers };
