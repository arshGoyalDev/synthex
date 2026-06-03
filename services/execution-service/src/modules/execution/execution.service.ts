import { randomBytes, randomUUID } from "crypto";
import { ExecutionRepository } from "./execution.repository";
import { pubsub, redis } from "../../config/database";
import { acquireLock, releaseLock } from "../../utils/lock";
import { flushBuffer, clearBuffer, readBuffer } from "@synthex/database";
import { AppError } from "../../utils/AppError";
import { assertProjectOwner } from "../../utils/projectAccess";
import { StartExecutionDto, StartPreviewDto } from "./execution.schema";
import { TEMPLATES } from "@synthex/templates";

class ExecutionService {
  private repo = new ExecutionRepository();
  private readonly previewLockTtlSeconds = 600; // 10 min — deleted immediately on ready/error

  async startExecution(userId: string, dto: StartExecutionDto) {
    await assertProjectOwner(dto.projectId, userId);

    const executionId = randomUUID();
    const workDir = dto.workDir ?? `/workspace/${dto.projectName}`;

    const locked = await acquireLock(dto.projectId, executionId, false);
    if (!locked) {
      throw new AppError(
        "Another execution is already running for this project",
        409,
      );
    }

    try {
      await this.repo.create({
        executionId,
        projectId: dto.projectId,
        userId,
        command: dto.command,
        isDevServer: false,
      });

      await redis.set(
        `execution:status:${executionId}`,
        "queued",
        "EX",
        20 * 60,
      );

      await redis.set(
        `execution:meta:${executionId}`,
        JSON.stringify({
          projectId: dto.projectId,
          userId,
          command: dto.command,
        }),
        "EX",
        20 * 60,
      );

      await pubsub.publish("execution:start", {
      executionId,
      projectId: dto.projectId,
      userId,
      command: dto.command,
      workDir,
      timeoutMs: 30_000,
      isDevServer: false,
      envVars: dto.envVars ?? null,
      });
    } catch (err) {
      await this.repo
        .updateStatus(executionId, {
          status: "failed",
          completedAt: new Date(),
        })
        .catch(() => {});
      await releaseLock(dto.projectId, executionId);
      throw err;
    }

    return { executionId, status: "queued" };
  }

  async startPreview(userId: string, dto: StartPreviewDto) {
    await assertProjectOwner(dto.projectId, userId);

    const previewStatus = await redis.get(`preview:${dto.projectId}:status`);

    if (previewStatus === "running" || previewStatus === "starting") {
      const ownerUserId = await redis.get(
        `preview:${dto.projectId}:ownerUserId`,
      );
      if (ownerUserId && ownerUserId !== userId) {
        throw new AppError("Forbidden", 403);
      }

      return {
        status: previewStatus === "running" ? "already_running" : "starting",
        previewUrl: this.previewPath(dto.projectId),
        previewAccessToken:
          (await redis.get(`preview:${dto.projectId}:token`)) ?? undefined,
        projectId: dto.projectId,
      };
    }

    const locked = await redis.set(
      `preview:${dto.projectId}:lock`,
      userId,
      "EX",
      this.previewLockTtlSeconds,
      "NX",
    );

    if (locked !== "OK") {
      const ownerUserId = await redis.get(
        `preview:${dto.projectId}:ownerUserId`,
      );
      if (ownerUserId && ownerUserId !== userId) {
        throw new AppError("Forbidden", 403);
      }

      return {
        status: "starting",
        previewUrl: this.previewPath(dto.projectId),
        previewAccessToken:
          (await redis.get(`preview:${dto.projectId}:token`)) ?? undefined,
        projectId: dto.projectId,
      };
    }

    const workDir = `/workspace/${dto.projectName}`;

    // build base path and env vars for template
    const basePath = `/preview/${dto.projectId}`;
    const templateEnvVars = this.buildEnvVars(
      dto.templateId,
      dto.projectId,
      dto.port,
    );
    const envVars = { ...templateEnvVars, ...(dto.envVars ?? {}) };
    const previewToken = randomBytes(32).toString("hex");

    await redis
      .pipeline()
      .set(`preview:${dto.projectId}:status`, "starting")
      .set(`preview:${dto.projectId}:ownerUserId`, userId)
      .set(`preview:${dto.projectId}:containerPort`, dto.port.toString())
      .set(`preview:${dto.projectId}:startedAt`, Date.now().toString())
      .set(`preview:${dto.projectId}:token`, previewToken)
      .exec();

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

    return { status: "starting", projectId: dto.projectId };
  }

  async stopPreview(projectId: string, userId: string) {
    await assertProjectOwner(projectId, userId);

    const ownerUserId = await redis.get(`preview:${projectId}:ownerUserId`);
    if (ownerUserId && ownerUserId !== userId) {
      throw new AppError("Forbidden", 403);
    }

    await pubsub.publish("preview:stop", { projectId, userId });
    await redis
      .pipeline()
      .del(`preview:${projectId}:status`)
      .del(`preview:${projectId}:port`)
      .del(`preview:${projectId}:pid`)
      .del(`preview:${projectId}:proxyUrl`)
      .del(`preview:${projectId}:target`)
      .del(`preview:${projectId}:containerPort`)
      .del(`preview:${projectId}:ownerUserId`)
      .del(`preview:${projectId}:startedAt`)
      .del(`preview:${projectId}:token`)
      .del(`preview:${projectId}:lock`)
      .exec();
    await pubsub.publish("preview:status", {
      projectId,
      userId,
      status: "stopped",
      previewUrl: "",
    });
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

  async getExecution(executionId: string, userId: string) {
    const exec = await this.repo.findByExecutionId(executionId);
    if (!exec) throw new AppError("Execution not found", 404);
    if (exec.userId !== userId) throw new AppError("Forbidden", 403);
    return exec;
  }

  async getExecutionHistory(projectId: string, userId: string) {
    await assertProjectOwner(projectId, userId);
    return this.repo.findByProject(projectId);
  }

  async getBufferedOutput(executionId: string, userId: string, fromSeq = 0) {
    const exec = await this.repo.findByExecutionId(executionId);
    if (!exec) throw new AppError("Execution not found", 404);
    if (exec.userId !== userId) throw new AppError("Forbidden", 403);

    return readBuffer(executionId, fromSeq);
  }

  async handleExecutionDone(data: {
    executionId: string;
    projectId: string;
    exitCode: number;
    durationMs: number;
    timedOut: boolean;
    killed?: boolean;
  }) {
    const status = data.killed
      ? "killed"
      : data.timedOut
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

    await releaseLock(data.projectId, data.executionId);

    // clean Redis immediately
    await clearBuffer(data.executionId);

    return status;
  }

  async handlePreviewReady(data: {
    projectId: string;
    userId: string;
    hostPort: number;
  }) {
    const previewAccessToken = await redis.get(
      `preview:${data.projectId}:token`,
    );
    const proxyUrl = this.previewPath(data.projectId);

    await redis.set(`preview:${data.projectId}:status`, "running");
    await redis.set(`preview:${data.projectId}:port`, data.hostPort.toString());
    await redis.set(`preview:${data.projectId}:proxyUrl`, proxyUrl);
    await redis.del(`preview:${data.projectId}:lock`);

    await pubsub.publish("preview:status", {
      projectId: data.projectId,
      userId: data.userId,
      status: "ready",
      previewUrl: proxyUrl,
      previewAccessToken: previewAccessToken ?? undefined,
      hostPort: data.hostPort,
    });
  }

  async handlePreviewError(data: {
    projectId: string;
    userId: string;
    message?: string;
  }) {
    await redis
      .pipeline()
      .set(`preview:${data.projectId}:status`, "error")
      .set(`preview:${data.projectId}:error`, data.message ?? "Preview failed")
      .del(`preview:${data.projectId}:lock`)
      .exec();

    await pubsub.publish("preview:status", {
      projectId: data.projectId,
      userId: data.userId,
      status: "error",
      previewUrl: "",
      message: data.message,
    });
  }

  async deleteProjectExecutions(projectId: string) {
    const executions = await this.repo.findExecutionIdsByProject(projectId);

    await Promise.all(
      executions.map((exec) => clearBuffer(exec.executionId).catch(() => {})),
    );

    await this.repo.deleteByProject(projectId);
    await redis.del(`execution:lock:${projectId}`);

    await redis
      .pipeline()
      .del(`preview:${projectId}:status`)
      .del(`preview:${projectId}:port`)
      .del(`preview:${projectId}:pid`)
      .del(`preview:${projectId}:proxyUrl`)
      .del(`preview:${projectId}:target`)
      .del(`preview:${projectId}:containerPort`)
      .del(`preview:${projectId}:ownerUserId`)
      .del(`preview:${projectId}:startedAt`)
      .del(`preview:${projectId}:token`)
      .del(`preview:${projectId}:lock`)
      .del(`preview:${projectId}:error`)
      .exec();
  }

  private previewPath(projectId: string) {
    return `/preview/${projectId}/`;
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
      "react",
      "react_ts",
      "react_tailwind",
      "svelte",
      "sveltekit",
      "vue",
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
