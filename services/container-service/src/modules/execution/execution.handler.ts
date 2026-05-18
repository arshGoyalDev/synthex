import Dockerode from "dockerode";
import { pubsub, redis } from "../../config/database";
import { pushToBuffer, newSeq } from "@synthex/database";
import { createDockerFrameParser } from "../../utils/dockerStream";

interface ExecutionStartData {
  executionId: string;
  projectId: string;
  userId: string;
  command: string;
  workDir: string;
  timeoutMs: number;
  isDevServer: boolean;
}

class ExecutionHandler {
  private docker = new Dockerode();
  private activeExecs = new Map<
    string,
    { pid?: number; containerId: string }
  >();

  async startExecution(data: ExecutionStartData) {
    const {
      executionId,
      projectId,
      userId,
      command,
      workDir,
      timeoutMs,
      isDevServer,
    } = data;

    await redis.set(
      `execution:status:${executionId}`,
      "running",
      "EX",
      20 * 60,
    );

    await pubsub.publish("execution:status", {
      executionId,
      projectId,
      userId,
      status: "running",
    });

    let container: Dockerode.Container;

    try {
      container = this.docker.getContainer(`synthex-${projectId}`);
      await container.inspect(); // verify exists
    } catch {
      await this.publishDone(
        executionId,
        projectId,
        userId,
        -1,
        0,
        false,
        "Container not found",
      );
      return;
    }

    const exec = await container.exec({
      Cmd: ["bash", "-c", command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: workDir,
      Tty: false,
    });

    const stream = await new Promise<NodeJS.ReadableStream>(
      (resolve, reject) => {
        exec.start({ hijack: true, stdin: false }, (err, s) => {
          if (err) return reject(err);
          resolve(s!);
        });
      },
    );

    const startedInfo = await exec.inspect();
    this.activeExecs.set(executionId, {
      containerId: `synthex-${projectId}`,
      pid: startedInfo.Pid,
    });

    const startTime = Date.now();
    let timedOut = false;

    // timeout for scripts
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(async () => {
        timedOut = true;
        await this.killExecution(executionId, projectId);
      }, timeoutMs);
    }

    let outputQueue = Promise.resolve();
    const parseFrame = createDockerFrameParser(({ type, payload }) => {
      outputQueue = outputQueue.then(async () => {
        if (payload.length === 0) return;

        const seq = await newSeq(executionId);
        const outputChunk = {
          seq,
          data: payload.toString("base64"),
          type,
          timestamp: Date.now(),
        };

        await pushToBuffer(executionId, outputChunk);
        await pubsub.publish("execution:output", {
          executionId,
          projectId,
          userId,
          ...outputChunk,
        });
      });
    });

    await new Promise<void>((resolve) => {
      stream.on("data", parseFrame);
      stream.on("end", resolve);
      stream.on("error", resolve); // resolve on error too — exec.inspect gets exit code
    });

    await outputQueue;

    if (timeoutHandle) clearTimeout(timeoutHandle);

    const execInfo = await exec.inspect();
    const exitCode = execInfo.ExitCode ?? -1;
    const durationMs = Date.now() - startTime;

    this.activeExecs.delete(executionId);

    await this.publishDone(
      executionId,
      projectId,
      userId,
      exitCode,
      durationMs,
      timedOut,
    );
  }

  async killExecution(executionId: string, projectId: string) {
    try {
      const container = this.docker.getContainer(`synthex-${projectId}`);
      const active = this.activeExecs.get(executionId);

      if (!active?.pid) {
        console.log(`[execution-handler] No active pid for ${executionId}`);
        return;
      }

      const exec = await container.exec({
        Cmd: [
          "bash",
          "-lc",
          `kill -TERM -${active.pid} 2>/dev/null || kill -TERM ${active.pid} 2>/dev/null || true`,
        ],
        AttachStdout: false,
        AttachStderr: false,
      });

      await exec.start({ hijack: false, stdin: false }, () => {});

      this.activeExecs.delete(executionId);

      console.log(`[execution-handler] Killed execution ${executionId}`);
    } catch (err: any) {
      console.error(`[execution-handler] Kill failed:`, err.message);
    }
  }

  private async publishDone(
    executionId: string,
    projectId: string,
    userId: string,
    exitCode: number,
    durationMs: number,
    timedOut: boolean,
    error?: string,
  ) {
    await pubsub.publish("execution:done", {
      executionId,
      projectId,
      userId,
      exitCode,
      durationMs,
      timedOut,
      error,
    });
  }
}

export { ExecutionHandler };
