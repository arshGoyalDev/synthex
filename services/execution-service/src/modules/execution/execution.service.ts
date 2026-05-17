import { randomUUID } from "crypto";
import { ExecutionRepository } from "./execution.repository";
import { pubsub, redis } from "../../config/database";
import { acquireLock, releaseLock, getLock } from "../../utils/lock";
import { flushBuffer, clearBuffer, readBuffer } from "@synthex/database";
import { AppError } from "../../utils/AppError"
import { StartExecutionDto, StartPreviewDto } from "./execution.schema";
import { TEMPLATES } from "@synthex/templates";

class ExecutionService {
  private repo = new ExecutionRepository();

  async startExecution(userId: string, dto: StartExecutionDto) {
    // check concurrency lock
    const existing = await getLock(dto.projectId);
    if (existing) {
      throw new AppError(
        "Another execution is already running for this project",
        409,
      );
    }

    const executionId = randomUUID();
    const workDir = dto.workDir ?? `/workspace/${dto.projectName}`;

    // create DB record
    await this.repo.create({
      executionId,
      projectId: dto.projectId,
      userId,
      command: dto.command,
      isDevServer: false,
    });

    // set Redis status
    await redis.set(
      `execution:status:${executionId}`,
      "queued",
      "EX",
      20 * 60,
    );

    await redis.set(
      `execution:meta:${executionId}`,
      JSON.stringify({ projectId: dto.projectId, userId, command: dto.command }),
      "EX",
      20 * 60,
    );

    // acquire lock
    const locked = await acquireLock(dto.projectId, executionId, false);
    if (!locked) throw new AppError("Failed to acquire execution lock", 409);

    // publish to container-service
    await pubsub.publish("execution:start", {
      executionId,
      projectId: dto.projectId,
      userId,
      command: dto.command,
      workDir,
      timeoutMs: 30_000,
      isDevServer: false,
    });

    return { executionId, status: "queued" };
  }

  async startPreview(userId: string, dto: StartPreviewDto) {
    // check if already running
    const previewStatus = await redis.get(
      `preview:${dto.projectId}:status`,
    );

    if (previewStatus === "running") {
      const previewUrl = await redis.get(`preview:${dto.projectId}:proxyUrl`);
      return { status: "already_running", previewUrl };
    }

    const workDir = `/workspace/${dto.projectName}`;

    // build base path and env vars for template
    const basePath = `/preview/${dto.projectId}`;
    const envVars = this.buildEnvVars(dto.templateId, dto.projectId, dto.port);

    // publish to container-service
    await pubsub.publish("preview:start", {
      projectId: dto.projectId,
      userId,
      command: dto.command,
      port: dto.port,
      workDir,
      basePath,
      envVars,
    });

    // set status to starting
    await redis.set(`preview:${dto.projectId}:status`, "starting");

    return { status: "starting", projectId: dto.projectId };
  }

  async stopPreview(projectId: string, userId: string) {
    await pubsub.publish("preview:stop", { projectId, userId });
    await redis.del(`preview:${projectId}:status`);
    await redis.del(`preview:${projectId}:port`);
    await redis.del(`preview:${projectId}:pid`);
    await redis.del(`preview:${projectId}:proxyUrl`);
    return { status: "stopped" };
  }

  async killExecution(executionId: string, userId: string) {
    const exec = await this.repo.findByExecutionId(executionId);
    if (!exec) throw new AppError("Execution not found", 404);
    if (exec.userId !== userId) throw new AppError("Forbidden", 403);

    if (!["queued", "running"].includes(exec.status)) {
      throw new AppError("Execution is not running", 400);
    }

    await pubsub.publish("execution:kill", {
      executionId,
      projectId: exec.projectId,
    });

    return { message: "Kill signal sent" };
  }

  async getExecution(executionId: string) {
    const exec = await this.repo.findByExecutionId(executionId);
    if (!exec) throw new AppError("Execution not found", 404);
    return exec;
  }

  async getExecutionHistory(projectId: string) {
    return this.repo.findByProject(projectId);
  }

  async getBufferedOutput(executionId: string, fromSeq = 0) {
    return readBuffer(executionId, fromSeq);
  }

  async handleExecutionDone(data: {
    executionId: string;
    projectId: string;
    exitCode: number;
    durationMs: number;
    timedOut: boolean;
  }) {
    const status = data.timedOut
      ? "timeout"
      : data.exitCode === 0
        ? "completed"
        : "failed";

    // flush buffer to DB
    const output = await flushBuffer(data.executionId);

    await this.repo.updateStatus(data.executionId, {
      status,
      output,
      exitCode: data.exitCode,
      durationMs: data.durationMs,
      completedAt: new Date(),
    });

    // release lock
    await releaseLock(data.projectId);

    // clean Redis immediately
    await clearBuffer(data.executionId);

    return status;
  }

  async handlePreviewReady(data: {
    projectId: string;
    userId: string;
    hostPort: number;
  }) {
    const proxyUrl = `/preview/${data.projectId}/`;

    // store in Redis
    await redis.set(`preview:${data.projectId}:status`, "running");
    await redis.set(
      `preview:${data.projectId}:port`,
      data.hostPort.toString(),
    );
    await redis.set(`preview:${data.projectId}:proxyUrl`, proxyUrl);

    // publish to gateway — frontend receives this
    await pubsub.publish("preview:status", {
      projectId: data.projectId,
      userId: data.userId,
      status: "ready",
      previewUrl: proxyUrl,
      hostPort: data.hostPort,  // gateway needs this to set up proxy
    });
  }

  private buildEnvVars(
    templateId: string | undefined,
    projectId: string,
    port: number,
  ): Record<string, string> {
    if (!templateId) return {};

    const template = TEMPLATES[templateId];
    if (!template) return {};

    const basePath = `/preview/${projectId}`;

    // Vite-based templates
    const viteTemplates = [
      "react", "react_ts", "react_tailwind",
      "svelte", "sveltekit", "vue",
    ];

    // Next.js
    const nextTemplates = ["nextjs"];

    if (viteTemplates.includes(templateId)) {
      return {
        BASE_PATH: `${basePath}/`,
      };
    }

    if (nextTemplates.includes(templateId)) {
      return {
        NEXT_BASE_PATH: basePath,
        NEXT_ASSET_PREFIX: basePath,
      };
    }

    return {};
  }
}

export { ExecutionService };