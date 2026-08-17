import { ContainerService } from "../modules/container/container.service";
import { ExecutionHandler } from "../modules/execution/execution.handler";
import { PreviewHandler } from "../modules/preview/preview.handler";

import { pubsub, redis, minioClient, FILES_BUCKET } from "./database";
import { LANGUAGES, TEMPLATES, PREVIEW_TEMPLATE_IDS } from "@synthex/templates";
import { randomUUID } from "crypto";

const containerService = new ContainerService();
const executionHandler = new ExecutionHandler();
const previewHandler = new PreviewHandler();

const ZIP_BUCKET = "project-zips";
const SETUP_LEASE_TTL_SECONDS = 20 * 60;

interface ProjectData {
  projectId: string;
  projectName: string;
  userId: string;
  type: "raw" | "blank" | "template";
  template: null | string;
  languages: null | string[];
  // import fields
  importSource?: "github" | "zip" | null;
  repoUrl?: string | null;
  repoBranch?: string | null;
  zipKey?: string | null;
  installCommand?: string | null;
  runCommand?: string | null;
  previewCommand?: string | null;
  previewPort?: number | null;
  envVars?: Record<string, string> | null;
}

const registerSubscribers = async () => {
  await pubsub.subscribe("project:created", async (data) => {
    console.log(
      "[container-service] project:created event:",
      data.projectId,
      data.projectName,
    );

    startContainerSetup(data).catch((err) => {
      console.error(
        `[container-service] Unhandled error for ${data.projectId}:`,
        err.message,
      );
    });
  });

  await pubsub.subscribe("project:start", async (data) => {
    console.log(
      "[container-service] project:start event:",
      data.projectId,
      data.projectName,
    );

    startContainerSetup(data).catch((err) => {
      console.error(
        `[container-service] Unhandled error for ${data.projectId}:`,
        err.message,
      );
    });
  });

  await pubsub.subscribe("project:stop", async (data) => {
    try {
      await invalidateSetup(data.projectId);
      await containerService
        .stopContainer(data.projectId, data.userId, data.projectName)
        .catch((err) => {
          console.error(
            `[container-service] Unhandled error for ${data.projectId}:`,
            err.message,
          );
        });

      await pubsub.publish("container:status", {
        projectId: data.projectId,
        userId: data.userId,
        status: "stopped",
        message: "Environment stopped",
      });
    } catch (err: any) {
      console.error(
        `[container-service] Failed to stop ${data.projectId}:`,
        err,
      );

      await pubsub.publish("container:status", {
        projectId: data.projectId,
        userId: data.userId,
        status: "error",
        message: err.message,
      });
    }
  });

  await pubsub.subscribe("project:delete", async (data) => {
    try {
      await invalidateSetup(data.projectId);
      await containerService.cleanupContainer(
        data.projectId,
        data.userId,
        data.projectName,
        { snapshot: false },
      );
      await redis.del(`container:timeout:${data.projectId}`);
      console.log(
        `[container-service] Deleted container for project ${data.projectId}`,
      );
    } catch (err: any) {
      console.error(
        `[container-service] Failed to delete container for ${data.projectId}:`,
        err.message,
      );
    }
  });

  await pubsub.subscribe("container:timeout", async (data) => {
    console.log(
      `[container-service] Cleaning up timed out container for ${data.projectId}`,
    );

    await invalidateSetup(data.projectId);
    await containerService
      .cleanupContainer(
        data.projectId,
        data.userId,
        data.projectName ?? data.projectId,
      )
      .catch((err) => {
        console.error("Cleanup failed:", err);
      });

    await pubsub.publish("container:status", {
      projectId: data.projectId,
      userId: data.userId,
      status: "timeout",
      message: "Container setup timed out. Please try again.",
    });
  });

  await pubsub.subscribe("user:cleanup", async (data) => {
    try {
      await containerService.cleanupUserContainers(data.userId);
      console.log(
        `[container-service] Cleaned up all containers for user ${data.userId}`,
      );
    } catch (err: any) {
      console.error(
        `[container-service] Failed to cleanup containers for user ${data.userId}:`,
        err,
      );
    }
  });

  await pubsub.subscribe("storage:file:mutation", async (data) => {
    console.log(
      `[container-service] Received storage:file:mutation — event=${data.event}, project=${data.projectId}, file=${data.filePath}`,
    );
    try {
      await containerService.applyStorageMutation(data);
      console.log(
        `[container-service] Applied mutation: ${data.event} ${data.filePath}`,
      );
    } catch (err: any) {
      console.error(
        `[container-service] Failed to apply storage mutation for ${data.projectId}:`,
        err.message,
        err.stack,
      );
    }
  });

  await pubsub.subscribe("execution:start", async (data) => {
    console.log(`[container-service] execution:start ${data.executionId}`);

    // fire and forget — streaming is async
    executionHandler.startExecution(data).catch(async (err) => {
      console.error(`[container-service] Execution failed:`, err.message);
      await pubsub.publish("execution:done", {
        executionId: data.executionId,
        projectId: data.projectId,
        userId: data.userId,
        exitCode: -1,
        durationMs: 0,
        timedOut: false,
        error: err.message,
      });
    });
  });

  await pubsub.subscribe("execution:kill", async (data) => {
    console.log(`[container-service] execution:kill ${data.executionId}`);
    await executionHandler
      .killExecution(data.executionId, data.projectId)
      .catch((err) => console.error(`Kill failed:`, err.message));
  });

  await pubsub.subscribe("preview:start", async (data) => {
    console.log(`[container-service] preview:start ${data.projectId}`);

    previewHandler.startPreview(data).catch(async (err) => {
      console.error(`[container-service] Preview failed:`, err.message);
      await pubsub.publish("preview:error", {
        projectId: data.projectId,
        userId: data.userId,
        message: err.message,
      });
    });
  });

  await pubsub.subscribe("preview:stop", async (data) => {
    console.log(`[container-service] preview:stop ${data.projectId}`);
    await previewHandler
      .stopPreview(data.projectId)
      .catch((err) => console.error(`Preview stop failed:`, err.message));
  });
};

const startContainerSetup = async (projectData: ProjectData) => {
  const { projectId, userId, projectName, languages, template, importSource } =
    projectData;
  const attemptId = randomUUID();
  const acquired = await redis.set(
    `project:setup:${projectId}:lease`,
    attemptId,
    "EX",
    SETUP_LEASE_TTL_SECONDS,
    "NX",
  );
  if (acquired !== "OK") {
    console.log(
      `[container-service] Coalesced duplicate setup for ${projectId}`,
    );
    return;
  }

  await redis.set(
    `project:setup:${projectId}:attempt`,
    JSON.stringify({ attemptId, status: "starting", startedAt: Date.now() }),
    "EX",
    SETUP_LEASE_TTL_SECONDS,
  );
  const renewal = setInterval(() => {
    void renewSetupLease(projectId, attemptId);
  }, 60_000);

  try {
    if (!(await ownsSetupLease(projectId, attemptId))) {
      await containerService
        .cleanupContainer(projectId, userId, projectName, { snapshot: false })
        .catch(() => {});
      return;
    }
    await pubsub.publish("container:status", {
      projectId,
      userId,
      status: "starting",
      message: "Setting up your environment...",
    });

    if (importSource === "github") {
      // ── GitHub import ────────────────────────────────────────────────────
      await containerService.setupGithubImport(projectId, projectName, userId, {
        repoUrl: projectData.repoUrl!,
        repoBranch: projectData.repoBranch ?? "main",
        installCommand: projectData.installCommand ?? null,
        languages: projectData.languages ?? [],
      });
    } else if (importSource === "zip") {
      // ── ZIP import ───────────────────────────────────────────────────────
      const zipStream = await minioClient.getObject(
        ZIP_BUCKET,
        projectData.zipKey!,
      );
      await containerService.setupZipImport(projectId, projectName, userId, {
        zipStream,
        installCommand: projectData.installCommand ?? null,
        languages: projectData.languages ?? [],
      });
    } else {
      // ── Normal template / blank / raw ────────────────────────────────────
      await containerService.startProjectContainer(
        projectId,
        projectName,
        userId,
        languages ?? undefined,
        template ?? undefined,
      );
    }

    // Runtime config: stored values take priority for imports, template-derived for normal
    const runtimeConfig = importSource
      ? {
          runCommand: projectData.runCommand ?? null,
          previewCommand: projectData.previewCommand ?? null,
          previewPort: projectData.previewPort ?? null,
        }
      : getRuntimeConfig(template, languages);

    await redis.del(`container:timeout:${projectId}`);

    if (!(await ownsSetupLease(projectId, attemptId))) {
      await containerService
        .cleanupContainer(projectId, userId, projectName, { snapshot: false })
        .catch(() => {});
      return;
    }
    await pubsub.publish("container:status", {
      projectId,
      userId,
      status: "ready",
      message: "Environment is ready",
      ...runtimeConfig,
    });
  } catch (err: any) {
    console.error(`[container-service] Failed for ${projectId}:`, err);

    await containerService
      .cleanupContainer(projectId, userId, projectName)
      .catch(() => {});

    await redis.del(`container:timeout:${projectId}`);

    if (await ownsSetupLease(projectId, attemptId)) {
      await pubsub.publish("container:status", {
        projectId,
        userId,
        status: "error",
        message: err.message || "Failed to set up environment",
      });
    }
  } finally {
    clearInterval(renewal);
    await releaseSetupLease(projectId, attemptId);
  }
};

async function ownsSetupLease(projectId: string, attemptId: string) {
  return (await redis.get(`project:setup:${projectId}:lease`)) === attemptId;
}

async function renewSetupLease(projectId: string, attemptId: string) {
  if (await ownsSetupLease(projectId, attemptId)) {
    await redis.expire(
      `project:setup:${projectId}:lease`,
      SETUP_LEASE_TTL_SECONDS,
    );
    await redis.expire(
      `project:setup:${projectId}:attempt`,
      SETUP_LEASE_TTL_SECONDS,
    );
  }
}

async function releaseSetupLease(projectId: string, attemptId: string) {
  const leaseKey = `project:setup:${projectId}:lease`;
  const attemptKey = `project:setup:${projectId}:attempt`;
  await redis.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1], KEYS[2]) end return 0",
    2,
    leaseKey,
    attemptKey,
    attemptId,
  );
}

async function invalidateSetup(projectId: string) {
  await redis.del(
    `project:setup:${projectId}:lease`,
    `project:setup:${projectId}:attempt`,
  );
}

const getRuntimeConfig = (
  templateId: string | null,
  languages: string[] | null,
) => {
  if (!templateId) {
    const primaryLanguage = languages?.[0];
    const language = primaryLanguage ? LANGUAGES[primaryLanguage] : null;

    return {
      runCommand: language?.runCommand ?? null,
      previewCommand: null,
      previewPort: null,
    };
  }

  const template = TEMPLATES[templateId];
  if (!template) {
    return {
      runCommand: null,
      previewCommand: null,
      previewPort: null,
    };
  }

  const isPreviewTemplate = PREVIEW_TEMPLATE_IDS.has(templateId);
  return {
    runCommand: isPreviewTemplate ? null : template.runCommand,
    previewCommand: isPreviewTemplate ? template.runCommand : null,
    previewPort: isPreviewTemplate ? (template.defaultPort ?? null) : null,
  };
};

export { registerSubscribers };
