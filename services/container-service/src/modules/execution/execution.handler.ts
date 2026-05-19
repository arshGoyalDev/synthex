import Dockerode from "dockerode";
import { pubsub, redis } from "../../config/database";
import { pushToBuffer, newSeq } from "@synthex/database";
import { createDockerFrameParser } from "../../utils/dockerStream";
import type { Duplex } from "stream";

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
    { pid?: number; containerId: string; stdin?: Duplex }
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
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: workDir,
      Tty: false,
    });

    const stream = await new Promise<Duplex>(
      (resolve, reject) => {
        exec.start({ hijack: true, stdin: true }, (err, s) => {
          if (err) return reject(err);
          resolve(s! as Duplex);
        });
      },
    );

    const startedInfo = await exec.inspect();
    this.activeExecs.set(executionId, {
      containerId: `synthex-${projectId}`,
      pid: startedInfo.Pid,
      stdin: stream,
    });

    // Forward user input from Redis pubsub into the exec stdin
    const inputHandler = async (data: { executionId: string; input: string }) => {
      if (data.executionId !== executionId) return;
      stream.write(data.input);
    };
    await pubsub.subscribe("execution:input", inputHandler);

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

    // ─── Backpressure-safe output processing ─────────────────────────────
    // Instead of chaining .then() indefinitely (which causes unbounded memory
    // growth when output is produced faster than Redis can process it), we
    // pause the raw stream, process one batch, then resume.
    const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g; // eslint-disable-line no-control-regex

    let processing = false;
    const pendingFrames: Array<{ type: "stdout" | "stderr"; payload: Buffer }> = [];

    const drainFrames = async () => {
      if (processing || pendingFrames.length === 0) return;
      processing = true;
      (stream as NodeJS.ReadableStream).pause?.();

      while (pendingFrames.length > 0) {
        // Batch up to 20 frames per Redis round-trip to avoid individual
        // publish overhead while still streaming output to the frontend promptly.
        const batch = pendingFrames.splice(0, 20);

        for (const { type, payload } of batch) {
          const clean = payload.toString("utf8")
            .replace(ANSI_RE, "")         // strip ANSI escape sequences
            .replace(/\r\n/g, "\n")        // normalize to \n first
            .replace(/\n/g, "\r\n");       // then to \r\n for xterm

          if (!clean.trim()) continue;

          const cleanBuf = Buffer.from(clean, "utf8");
          const seq = await newSeq(executionId);
          const outputChunk = {
            seq,
            data: cleanBuf.toString("base64"),
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
        }
      }

      processing = false;
      (stream as NodeJS.ReadableStream).resume?.();
    };

    const parseFrame = createDockerFrameParser(({ type, payload }) => {
      if (payload.length === 0) return;
      pendingFrames.push({ type, payload });
      drainFrames().catch(console.error);
    });

    await new Promise<void>((resolve) => {
      stream.on("data", parseFrame);
      stream.on("end", async () => {
        // Drain any remaining frames before resolving
        while (pendingFrames.length > 0 || processing) {
          await new Promise((r) => setTimeout(r, 10));
        }
        resolve();
      });
      stream.on("error", resolve);
    });

    if (timeoutHandle) clearTimeout(timeoutHandle);

    // Unsubscribe stdin input handler and close the stdin pipe
    await pubsub.unsubscribe("execution:input", inputHandler);
    stream.end();

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
