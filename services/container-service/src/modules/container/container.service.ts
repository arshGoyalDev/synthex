import Dockerode from "dockerode";
import { LANGUAGES, TEMPLATES } from "@synthex/templates";
import { AppError } from "../../utils/AppError";
import { createSnapshot, getLatestSnapshotKey } from "../../utils/snapshots";
import { restoreSnapshot } from "../../utils/restore";
import { createDockerFrameParser } from "../../utils/dockerStream";
import {
  FILES_BUCKET,
  minioClient,
  pubsub,
  redis,
} from "../../config/database";

type SetupLogType = "info" | "success" | "error" | "command";
type SetupStage = "install" | "setup" | "postSetup" | "done";

const SETUP_BUFFER_TTL_SECONDS = 30 * 60;
const SETUP_BUFFER_MAX_LINES = 2000;
const DEFAULT_SETUP_STAGES = {
  install: "Pulling runtime",
  setup: "Scaffolding project",
  postSetup: "Installing dependencies",
};
const DONE_STAGE_NAME = "Ready";

class ContainerService {
  docker = new Dockerode();
  private readonly DEFAULT_IMAGE = "synthex/base:latest";

  private filesPrefix(userId: string, projectId: string) {
    return `${userId}/${projectId}/files/`;
  }

  private deletesPrefix(userId: string, projectId: string) {
    return `${userId}/${projectId}/deletes/`;
  }

  private normalizeFilePath(filePath: string): string {
    const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const parts = normalized.split("/").filter(Boolean);

    if (
      parts.length === 0 ||
      parts.some((part) => part === "." || part === "..")
    ) {
      throw new AppError("Invalid filePath", 400);
    }

    return parts.join("/");
  }

  async startProjectContainer(
    projectId: string,
    projectName: string,
    userId: string,
    languages?: string[],
    template?: string,
  ) {
    let installCommands: string[] = [];
    let setupCommands: string[] = [];
    let postSetupCommands: string[] = [];
    let selectedTemplate: (typeof TEMPLATES)[string] | null = null;
    let image = this.DEFAULT_IMAGE;
    let setupStages = DEFAULT_SETUP_STAGES;

    if (template) {
      const tmpl = TEMPLATES[template];

      if (!tmpl) throw new AppError(`Unknown Template: ${template}`, 400);
      selectedTemplate = tmpl;
      setupStages = tmpl.setupStages ?? DEFAULT_SETUP_STAGES;

      const { install, setup, postSetup } = tmpl.getCommands(projectName);

      const languageConfig = LANGUAGES[tmpl.language];

      const templateBaseImage = tmpl.baseImage;
      const resolvedBaseImage = templateBaseImage ?? languageConfig?.baseImage;

      if (resolvedBaseImage) {
        image = resolvedBaseImage;
        setupCommands = setup;
        postSetupCommands = postSetup;
      } else {
        installCommands = install;
        setupCommands = setup;
        postSetupCommands = postSetup;
      }
    } else {
      if (!languages || languages.length === 0) {
        throw new AppError("Languages required for blank project", 400);
      }

      if (languages.length === 1) {
        const singleLanguage = languages[0];
        if (!singleLanguage) throw new AppError("Language is required", 400);

        const lang = LANGUAGES[singleLanguage];
        if (!lang)
          throw new AppError(`Unknown language: ${singleLanguage}`, 400);

        if (lang.baseImage) {
          image = lang.baseImage;
          setupCommands = [`mkdir -p /workspace/${projectName}`];
        } else {
          installCommands = lang.installCommands;
          setupCommands = [`mkdir -p /workspace/${projectName}`];
        }
      } else {
        installCommands = languages.flatMap(
          (lang) => LANGUAGES[lang]?.installCommands ?? [],
        );

        setupCommands = [`mkdir -p /workspace/${projectName}`];
      }
    }

    let container: Dockerode.Container;

    try {
      container = this.docker.getContainer(`synthex-${projectId}`);
      const info = await container.inspect();

      if (!info.State.Running) {
        await container.start();

        console.log(`[container-service] Started container for ${projectId}`);
      }

      const snapshotKey = await getLatestSnapshotKey(projectId, userId);

      if (snapshotKey) {
        await restoreSnapshot(container, snapshotKey, projectName);
        await this.applyStoredFileState(
          container,
          projectId,
          userId,
          projectName,
        );
        await this.takeSnapshot(container, projectId, userId, projectName);
      }
    } catch (error: any) {
      if (error.statusCode !== 404) {
        throw error;
      }

      container = await this.docker.createContainer({
        Image: image,
        name: `synthex-${projectId}`,
        WorkingDir: `/workspace/${projectName}`,
        Tty: true,
        OpenStdin: true,
        Labels: {
          projectId,
          userId,
          projectName,
          languages: languages ? languages.join(",") : "",
          ...(template && { template }),
        },
        HostConfig: {
          Memory: 512 * 1024 * 1024,
          CpuPeriod: 100000,
          CpuQuota: 50000,
        },
      });

      await container.start();

      const snapshotKey = await getLatestSnapshotKey(projectId, userId);

      if (snapshotKey) {
        console.log(
          `[container-service] Found existing snapshot, restoring...`,
        );
        await restoreSnapshot(container, snapshotKey, projectName);
        await this.applyStoredFileState(
          container,
          projectId,
          userId,
          projectName,
        );
        await this.takeSnapshot(container, projectId, userId, projectName);
      } else {
        const totalCommands =
          installCommands.length + setupCommands.length + postSetupCommands.length;

        await this.initSetupLogging(projectId);

        if (totalCommands > 0) {
          let commandIndex = 0;

          commandIndex = await this.runSetupStage({
            container,
            commands: installCommands,
            projectId,
            stage: "install",
            stageName: setupStages.install,
            commandIndex,
            totalCommands,
          });

          commandIndex = await this.runSetupStage({
            container,
            commands: setupCommands,
            projectId,
            stage: "setup",
            stageName: setupStages.setup,
            commandIndex,
            totalCommands,
          });

          if (postSetupCommands.length > 0) {
            // Snapshot BEFORE postSetup so the file explorer works when
            // the user opens the editor early ("Install in Background").
            await this.takeSnapshot(container, projectId, userId, projectName);

            await pubsub.publish("container:status", {
              projectId,
              userId,
              status: "installing",
              message: "Installing dependencies...",
            });
          }

          commandIndex = await this.runSetupStage({
            container,
            commands: postSetupCommands,
            projectId,
            stage: "postSetup",
            stageName: setupStages.postSetup,
            commandIndex,
            totalCommands,
          });

          await this.completeSetupLogging(projectId, totalCommands);
        } else {
          await this.completeSetupLogging(projectId, 0);
        }

        await this.takeSnapshot(container, projectId, userId, projectName);
      }
    }

    return {
      containerId: container.id,
      workDir: `/workspace/${projectName}`,
      entryFile: selectedTemplate
        ? selectedTemplate.entryFile(projectName)
        : null,
      runCommand: selectedTemplate ? selectedTemplate.runCommand : null,
    };
  }

  // ── GitHub import ──────────────────────────────────────────────────────────

  async setupGithubImport(
    projectId: string,
    projectName: string,
    userId: string,
    opts: {
      repoUrl: string;
      repoBranch: string;
      installCommand: string | null;
      languages: string[];
    },
  ) {
    const { repoUrl, repoBranch, installCommand, languages } = opts;

    // Pick language image (default to base)
    const primaryLang = languages[0];
    const langConfig = primaryLang ? LANGUAGES[primaryLang] : null;
    const image = langConfig?.baseImage ?? this.DEFAULT_IMAGE;

    // Create the container
    let container: Dockerode.Container;
    try {
      container = this.docker.getContainer(`synthex-${projectId}`);
      const info = await container.inspect();
      if (!info.State.Running) await container.start();
    } catch (err: any) {
      if (err.statusCode !== 404) throw err;

      container = await this.docker.createContainer({
        Image: image,
        name: `synthex-${projectId}`,
        WorkingDir: `/workspace/${projectName}`,
        Tty: true,
        OpenStdin: true,
        Labels: { projectId, userId, projectName },
        HostConfig: {
          Memory: 512 * 1024 * 1024,
          CpuPeriod: 100000,
          CpuQuota: 50000,
        },
      });
      await container.start();
    }

    // git clone (skip if repo already present)
    console.log(`[container-service] Ensuring repo present for ${projectName}`);
    const cloneCommands = [
      `mkdir -p /workspace`,
      `if [ -d "/workspace/${projectName}/.git" ]; then echo "Repo already exists, skipping clone"; else git clone --depth 1 --branch ${repoBranch} ${repoUrl} /workspace/${projectName}; fi`,
    ];
    const totalCommands = cloneCommands.length + (installCommand ? 1 : 0);
    await this.initSetupLogging(projectId);

    let commandIndex = 0;
    commandIndex = await this.runSetupStage({
      container,
      commands: cloneCommands,
      projectId,
      stage: "setup",
      stageName: DEFAULT_SETUP_STAGES.setup,
      commandIndex,
      totalCommands,
    });

    // install dependencies
    if (installCommand) {
      console.log(`[container-service] Running install: ${installCommand}`);
      // Snapshot BEFORE install so files are in storage if user opens editor early.
      await this.takeSnapshot(container, projectId, userId, projectName);
      await pubsub.publish("container:status", {
        projectId,
        userId,
        status: "installing",
        message: "Installing dependencies...",
      });

      commandIndex = await this.runSetupStage({
        container,
        commands: [
          `if [ -f "/workspace/${projectName}/.synthex-installed" ]; then echo "Install already completed, skipping"; else cd /workspace/${projectName} && ${installCommand} && touch /workspace/${projectName}/.synthex-installed; fi`,
        ],
        projectId,
        stage: "postSetup",
        stageName: DEFAULT_SETUP_STAGES.postSetup,
        commandIndex,
        totalCommands,
      });
    }

    await this.completeSetupLogging(projectId, totalCommands);

    await this.takeSnapshot(container, projectId, userId, projectName);

    return { containerId: container.id };
  }

  // ── ZIP import ─────────────────────────────────────────────────────────────

  async setupZipImport(
    projectId: string,
    projectName: string,
    userId: string,
    opts: {
      zipStream: NodeJS.ReadableStream;
      installCommand: string | null;
      languages: string[];
    },
  ) {
    const { zipStream, installCommand, languages } = opts;

    const primaryLang = languages[0];
    const langConfig = primaryLang ? LANGUAGES[primaryLang] : null;
    const image = langConfig?.baseImage ?? this.DEFAULT_IMAGE;

    // Create the container
    let container: Dockerode.Container;
    try {
      container = this.docker.getContainer(`synthex-${projectId}`);
      const info = await container.inspect();
      if (!info.State.Running) await container.start();
    } catch (err: any) {
      if (err.statusCode !== 404) throw err;

      container = await this.docker.createContainer({
        Image: image,
        name: `synthex-${projectId}`,
        WorkingDir: `/workspace/${projectName}`,
        Tty: true,
        OpenStdin: true,
        Labels: { projectId, userId, projectName },
        HostConfig: {
          Memory: 512 * 1024 * 1024,
          CpuPeriod: 100000,
          CpuQuota: 50000,
        },
      });
      await container.start();
    }

    // Create workspace directory
    const createWorkspaceCommands = [`mkdir -p /workspace/${projectName}`];

    // Stream the ZIP directly into the container and unzip after stdin closes.
    console.log(`[container-service] Extracting ZIP for ${projectName}`);

    const totalCommands = createWorkspaceCommands.length + 1 + (installCommand ? 1 : 0);
    await this.initSetupLogging(projectId);

    let commandIndex = 0;
    commandIndex = await this.runSetupStage({
      container,
      commands: createWorkspaceCommands,
      projectId,
      stage: "setup",
      stageName: DEFAULT_SETUP_STAGES.setup,
      commandIndex,
      totalCommands,
    });

    await this.runStreamedSetupCommand({
      container,
      projectId,
      command:
        `cat >/tmp/import.zip && ` +
        `unzip -q -o /tmp/import.zip -d /workspace/${projectName} && ` +
        `rm /tmp/import.zip && ` +
        `cd /workspace/${projectName} && ` +
        `count=$(ls -1A 2>/dev/null | wc -l) && ` +
        `if [ "$count" -eq 1 ]; then ` +
        `dir=$(ls -1A 2>/dev/null); ` +
        `if [ -d "$dir" ]; then ` +
        `mv "$dir"/* . 2>/dev/null || true; ` +
        `mv "$dir"/.[!.]* . 2>/dev/null || true; ` +
        `rmdir "$dir" 2>/dev/null || true; ` +
        `fi; ` +
        `fi`,
      stdinStream: zipStream,
      commandIndex,
      totalCommands,
    });
    commandIndex += 1;

    // Run install
    if (installCommand) {
      console.log(`[container-service] Running install: ${installCommand}`);
      // Snapshot BEFORE install so files are in storage if user opens editor early.
      await this.takeSnapshot(container, projectId, userId, projectName);
      await pubsub.publish("container:status", {
        projectId,
        userId,
        status: "installing",
        message: "Installing dependencies...",
      });

      commandIndex = await this.runSetupStage({
        container,
        commands: [`cd /workspace/${projectName} && ${installCommand}`],
        projectId,
        stage: "postSetup",
        stageName: DEFAULT_SETUP_STAGES.postSetup,
        commandIndex,
        totalCommands,
      });
    }

    await this.completeSetupLogging(projectId, totalCommands);

    await this.takeSnapshot(container, projectId, userId, projectName);

    return { containerId: container.id };
  }

  async stopContainer(projectId: string, userId: string, projectName: string) {
    try {
      const container = this.docker.getContainer(`synthex-${projectId}`);
      const info = await container.inspect();

      if (info.State.Running) {
        await this.takeSnapshot(container, projectId, userId, projectName);
        await container.stop({ t: 10 });

        console.log(`[container-service] Stopped container for ${projectId}`);
      }
    } catch (err: any) {
      if (err.statusCode === 404) {
        console.log(`[container-service] Container not found for ${projectId}`);

        return;
      }

      throw err;
    }
  }

  async cleanupContainer(
    projectId: string,
    userId?: string,
    projectName?: string,
    options: { snapshot?: boolean } = {},
  ) {
    try {
      const container = this.docker.getContainer(`synthex-${projectId}`);
      const info = await container.inspect();
      const labels = info.Config?.Labels ?? {};
      const resolvedUserId = userId ?? labels.userId;
      const resolvedProjectName = projectName ?? labels.projectName;

      const shouldSnapshot = options.snapshot !== false;

      if (info.State.Running) {
        if (resolvedUserId && resolvedProjectName) {
          if (shouldSnapshot) {
            await this.takeSnapshot(
              container,
              projectId,
              resolvedUserId,
              resolvedProjectName,
            );
          }
        }
        await container.stop({ t: 5 });
      }

      await container.remove({ force: true });

      console.log(`[container-service] Cleaned up container for ${projectId}`);
    } catch (err: any) {
      if (err.statusCode === 404) {
        return;
      }

      throw err;
    }
  }

  async cleanupUserContainers(userId: string) {
    const containers = await this.docker.listContainers({
      all: true,
      filters: {
        label: [`userId=${userId}`],
      },
    });

    for (const containerInfo of containers) {
      const container = this.docker.getContainer(containerInfo.Id);

      try {
        if (containerInfo.State === "running") {
          await container.stop({ t: 5 });
        }

        await container.remove({ force: true });
      } catch (err: any) {
        if (err.statusCode === 404) {
          continue;
        }

        throw err;
      }
    }
  }

  async getContainerStatus(projectId: string) {
    try {
      const container = this.docker.getContainer(`synthex-${projectId}`);
      const info = await container.inspect();

      return {
        running: info.State.Running,
        status: info.State.Status,
        startedAt: info.State.StartedAt,
      };
    } catch (err: any) {
      if (err.statusCode === 404) return null;

      throw err;
    }
  }

  private async runSetupStage(options: {
    container: Dockerode.Container;
    commands: string[];
    projectId: string;
    stage: SetupStage;
    stageName: string;
    commandIndex: number;
    totalCommands: number;
  }) {
    const {
      container,
      commands,
      projectId,
      stage,
      stageName,
      totalCommands,
    } = options;
    let { commandIndex } = options;

    if (commands.length === 0) return commandIndex;

    await this.publishSetupStage({
      projectId,
      stage,
      stageName,
      commandIndex: Math.min(commandIndex + 1, totalCommands),
      totalCommands,
    });

    await this.publishSetupLog({
      projectId,
      type: "info",
      text: `⟳ ${stageName}`,
      commandIndex: Math.min(commandIndex + 1, totalCommands),
      totalCommands,
    });

    for (const command of commands) {
      commandIndex += 1;
      await this.runSetupCommand({
        container,
        command,
        projectId,
        commandIndex,
        totalCommands,
      });
      await this.updateSetupProgress(projectId, commandIndex, totalCommands);
    }

    return commandIndex;
  }

  private async runSetupCommand(options: {
    container: Dockerode.Container;
    command: string;
    projectId: string;
    commandIndex: number;
    totalCommands: number;
  }) {
    const { container, command, projectId, commandIndex, totalCommands } = options;
    const startedAt = Date.now();
    const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g; // eslint-disable-line no-control-regex

    await this.publishSetupLog({
      projectId,
      type: "command",
      text: `$ ${command}`,
      commandIndex,
      totalCommands,
    });

    console.log(`[${projectId}] Running: ${command}`);

    const exec = await container.exec({
      Cmd: ["bash", "-c", command],
      AttachStdout: true,
      AttachStderr: true,
    });

    let output = "";
    const lineBuffers: Record<"stdout" | "stderr", string> = {
      stdout: "",
      stderr: "",
    };

    const emitLines = async (type: "stdout" | "stderr", chunk: string) => {
      const cleaned = chunk.replace(ANSI_RE, "").replace(/\r\n/g, "\n");
      const buffer = `${lineBuffers[type]}${cleaned}`;
      const lines = buffer.split(/\n/);
      lineBuffers[type] = lines.pop() ?? "";

      for (const line of lines) {
        const text = line.replace(/\r$/, "");
        if (!text.trim()) continue;
        await this.publishSetupLog({
          projectId,
          type: type === "stderr" ? "error" : "info",
          text,
          commandIndex,
          totalCommands,
        });
      }
    };

    await new Promise<void>((resolve, reject) => {
      exec.start({ hijack: false, stdin: false }, (err, stream) => {
        if (err) return reject(err);

        if (!stream) return resolve();

        let processing = false;
        const pendingFrames: Array<{ type: "stdout" | "stderr"; payload: Buffer }> = [];

        const drainFrames = async () => {
          if (processing || pendingFrames.length === 0) return;
          processing = true;
          (stream as NodeJS.ReadableStream).pause?.();

          while (pendingFrames.length > 0) {
            const batch = pendingFrames.splice(0, 20);

            for (const { type, payload } of batch) {
              const text = payload.toString("utf8");
              output += text;
              await emitLines(type, text);
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

        stream.on("data", parseFrame);
        stream.on("end", async () => {
          while (pendingFrames.length > 0 || processing) {
            await new Promise((wait) => setTimeout(wait, 10));
          }

          await emitLines("stdout", "\n");
          await emitLines("stderr", "\n");

          console.log(`[${projectId}] Command completed`);
          resolve();
        });

        stream.on("error", reject);
      });
    });

    const execInfo = await exec.inspect();
    const exitCode = execInfo.ExitCode ?? 1;
    const durationSeconds = (Date.now() - startedAt) / 1000;

    if (exitCode !== 0) {
      console.log(`[${projectId}] Command failed: ${command}`);
      await this.publishSetupLog({
        projectId,
        type: "error",
        text: `✗ Command failed (exit ${exitCode})`,
        commandIndex,
        totalCommands,
      });
      await this.markSetupFailed(projectId);

      throw new AppError(
        `Setup command failed (exit ${exitCode}): ${command}\n${output.trim()}`,
        500,
      );
    }

    await this.publishSetupLog({
      projectId,
      type: "success",
      text: `✓ Command completed (${durationSeconds.toFixed(1)}s)`,
      commandIndex,
      totalCommands,
    });
  }

  private async runStreamedSetupCommand(options: {
    container: Dockerode.Container;
    command: string;
    stdinStream: NodeJS.ReadableStream;
    projectId: string;
    commandIndex: number;
    totalCommands: number;
  }) {
    const {
      container,
      command,
      stdinStream,
      projectId,
      commandIndex,
      totalCommands,
    } = options;
    const startedAt = Date.now();
    const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g; // eslint-disable-line no-control-regex

    await this.publishSetupLog({
      projectId,
      type: "command",
      text: `$ ${command}`,
      commandIndex,
      totalCommands,
    });

    console.log(`[${projectId}] Running streamed command: ${command}`);

    const exec = await container.exec({
      Cmd: ["bash", "-c", command],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    let output = "";
    const lineBuffers: Record<"stdout" | "stderr", string> = {
      stdout: "",
      stderr: "",
    };

    const emitLines = async (type: "stdout" | "stderr", chunk: string) => {
      const cleaned = chunk.replace(ANSI_RE, "").replace(/\r\n/g, "\n");
      const buffer = `${lineBuffers[type]}${cleaned}`;
      const lines = buffer.split(/\n/);
      lineBuffers[type] = lines.pop() ?? "";

      for (const line of lines) {
        const text = line.replace(/\r$/, "");
        if (!text.trim()) continue;
        await this.publishSetupLog({
          projectId,
          type: type === "stderr" ? "error" : "info",
          text,
          commandIndex,
          totalCommands,
        });
      }
    };

    await new Promise<void>((resolve, reject) => {
      exec.start({ hijack: true, stdin: true }, (err, stream) => {
        if (err) return reject(err);
        if (!stream) return resolve();

        let settled = false;
        let processing = false;
        const pendingFrames: Array<{ type: "stdout" | "stderr"; payload: Buffer }> = [];

        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          stream.destroy();
          reject(error);
        };

        const finish = async () => {
          if (settled) return;
          settled = true;

          while (pendingFrames.length > 0 || processing) {
            await new Promise((wait) => setTimeout(wait, 10));
          }

          await emitLines("stdout", "\n");
          await emitLines("stderr", "\n");
          resolve();
        };

        const drainFrames = async () => {
          if (processing || pendingFrames.length === 0) return;
          processing = true;
          (stream as NodeJS.ReadableStream).pause?.();

          while (pendingFrames.length > 0) {
            const batch = pendingFrames.splice(0, 20);
            for (const { type, payload } of batch) {
              const text = payload.toString("utf8");
              output += text;
              await emitLines(type, text);
            }
          }

          processing = false;
          (stream as NodeJS.ReadableStream).resume?.();
        };

        const parseFrame = createDockerFrameParser(({ type, payload }) => {
          if (payload.length === 0) return;
          pendingFrames.push({ type, payload });
          drainFrames().catch((error) => fail(error as Error));
        });

        stream.on("data", parseFrame);
        stream.on("end", () => {
          finish().catch((error) => fail(error as Error));
        });
        stream.on("error", (error) => fail(error));

        stdinStream.on("error", (error) => fail(error));
        stdinStream.pipe(stream);
      });
    });

    const execInfo = await exec.inspect();
    const exitCode = execInfo.ExitCode ?? 1;
    const durationSeconds = (Date.now() - startedAt) / 1000;

    if (exitCode !== 0) {
      console.log(`[${projectId}] Streamed command failed: ${command}`);
      await this.publishSetupLog({
        projectId,
        type: "error",
        text: `✗ Command failed (exit ${exitCode})`,
        commandIndex,
        totalCommands,
      });
      await this.markSetupFailed(projectId);

      throw new AppError(
        `Setup command failed (exit ${exitCode}): ${command}\n${output.trim()}`,
        500,
      );
    }

    await this.publishSetupLog({
      projectId,
      type: "success",
      text: `✓ Command completed (${durationSeconds.toFixed(1)}s)`,
      commandIndex,
      totalCommands,
    });
  }

  private async initSetupLogging(projectId: string) {
    await redis
      .pipeline()
      .del(`setup:buffer:${projectId}`)
      .del(`setup:seq:${projectId}`)
      .del(`setup:status:${projectId}`)
      .del(`setup:progress:${projectId}`)
      .exec();

    await redis.setex(
      `setup:status:${projectId}`,
      SETUP_BUFFER_TTL_SECONDS,
      "running",
    );
    await redis.setex(
      `setup:progress:${projectId}`,
      SETUP_BUFFER_TTL_SECONDS,
      "0",
    );
  }

  private async markSetupFailed(projectId: string) {
    await redis.setex(
      `setup:status:${projectId}`,
      SETUP_BUFFER_TTL_SECONDS,
      "error",
    );
  }

  private async completeSetupLogging(projectId: string, totalCommands: number) {
    await this.publishSetupStage({
      projectId,
      stage: "done",
      stageName: DONE_STAGE_NAME,
      commandIndex: totalCommands,
      totalCommands,
    });
    await this.updateSetupProgress(projectId, totalCommands, totalCommands);
    await redis.setex(
      `setup:status:${projectId}`,
      SETUP_BUFFER_TTL_SECONDS,
      "completed",
    );
  }

  private async publishSetupStage(options: {
    projectId: string;
    stage: SetupStage;
    stageName: string;
    commandIndex: number;
    totalCommands: number;
  }) {
    const payload = { ...options };
    await pubsub.publish("container:setup:stage", payload);
  }

  private async updateSetupProgress(
    projectId: string,
    commandIndex: number,
    totalCommands: number,
  ) {
    const progress =
      totalCommands > 0
        ? Math.min(100, Math.round((commandIndex / totalCommands) * 100))
        : 100;
    await redis.setex(
      `setup:progress:${projectId}`,
      SETUP_BUFFER_TTL_SECONDS,
      progress.toString(),
    );
  }

  private async nextSetupSeq(projectId: string) {
    const seq = await redis.incr(`setup:seq:${projectId}`);
    await redis.expire(`setup:seq:${projectId}`, SETUP_BUFFER_TTL_SECONDS);
    return seq;
  }

  private async publishSetupLog(options: {
    projectId: string;
    type: SetupLogType;
    text: string;
    commandIndex: number;
    totalCommands: number;
  }) {
    const { projectId } = options;
    const seq = await this.nextSetupSeq(projectId);
    const payload = {
      ...options,
      seq,
      timestamp: Date.now(),
    };

    await redis
      .pipeline()
      .rpush(`setup:buffer:${projectId}`, JSON.stringify(payload))
      .ltrim(`setup:buffer:${projectId}`, -SETUP_BUFFER_MAX_LINES, -1)
      .expire(`setup:buffer:${projectId}`, SETUP_BUFFER_TTL_SECONDS)
      .exec();

    await pubsub.publish("container:setup:log", payload);
  }

  async takeSnapshot(
    container: Dockerode.Container,
    projectId: string,
    userId: string,
    projectName: string,
  ) {
    try {
      const result = await createSnapshot(
        container,
        projectId,
        userId,
        projectName,
      );

      await pubsub.publish("files:snapshot", {
        projectId,
        userId,
        minioKey: result.minioKey,
        sizeBytes: result.sizeBytes,
        fileCount: result.fileCount,
        manifest: result.manifest,
      });

      await this.waitForSnapshotIndex(projectId, result.minioKey);

      console.log(
        `[container-service] Snapshot taken: ${result.fileCount} files`,
      );

      return result;
    } catch (err: any) {
      console.log(`[container-service] Snapshot failed: ${err.message}`);
      throw err;
    }
  }

  async getContainerFile(projectId: string, filePath: string): Promise<string> {
    const container = this.docker.getContainer(`synthex-${projectId}`);
    return this.execInContainer(container, `cat "${filePath}"`);
  }

  async applyStorageMutation(data: {
    projectId: string;
    userId: string;
    event: "change" | "delete" | "rename";
    filePath: string;
    newPath?: string;
    content?: string;
  }) {
    const container = this.docker.getContainer(`synthex-${data.projectId}`);
    let info: Dockerode.ContainerInspectInfo;

    try {
      info = await container.inspect();
    } catch (err: any) {
      if (err.statusCode === 404) return;
      throw err;
    }

    if (!info.State.Running) return;

    const projectName = info.Config?.Labels?.projectName;
    if (!projectName) {
      throw new AppError("Container projectName label is missing", 500);
    }

    let filePath = this.normalizeFilePath(data.filePath);
    if (filePath.startsWith(`${projectName}/`)) {
      filePath = filePath.substring(projectName.length + 1);
    }

    if (data.event === "delete") {
      await this.deleteFileInContainer(container, projectName, filePath);
      return;
    }

    if (data.event === "rename") {
      if (!data.newPath) throw new AppError("newPath is required", 400);
      let newPath = this.normalizeFilePath(data.newPath);
      if (newPath.startsWith(`${projectName}/`)) {
        newPath = newPath.substring(projectName.length + 1);
      }
      await this.renameFileInContainer(
        container,
        projectName,
        filePath,
        newPath,
      );

      if (data.content !== undefined) {
        await this.writeFileToContainer(
          container,
          projectName,
          newPath,
          Buffer.from(data.content, "utf8"),
        );
      }
      return;
    }

    const content =
      data.content !== undefined
        ? Buffer.from(data.content, "utf8")
        : await this.readStoredFile(data.userId, data.projectId, filePath);
    await this.writeFileToContainer(container, projectName, filePath, content);
  }

  private async waitForSnapshotIndex(projectId: string, minioKey: string) {
    const key = `files:snapshot:indexed:${projectId}:${minioKey}`;
    const startedAt = Date.now();
    const timeoutMs = 15000;

    while (Date.now() - startedAt < timeoutMs) {
      const indexed = await redis.get(key);
      if (indexed) {
        await redis.del(key);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    console.warn(
      `[container-service] Timed out waiting for storage to index ${minioKey}`,
    );
  }

  private async applyStoredFileState(
    container: Dockerode.Container,
    projectId: string,
    userId: string,
    projectName: string,
  ) {
    const deletedPaths = await this.listObjectPaths(
      FILES_BUCKET,
      this.deletesPrefix(userId, projectId),
    );
    const filePaths = await this.listObjectPaths(
      FILES_BUCKET,
      this.filesPrefix(userId, projectId),
    );

    for (const rawPath of deletedPaths) {
      let filePath = rawPath;
      if (filePath.startsWith(`${projectName}/`)) {
        filePath = filePath.substring(projectName.length + 1);
      }
      await this.deleteFileInContainer(container, projectName, filePath);
    }

    for (const rawPath of filePaths) {
      if (deletedPaths.has(rawPath)) continue;
      let filePath = rawPath;
      if (filePath.startsWith(`${projectName}/`)) {
        filePath = filePath.substring(projectName.length + 1);
      }
      const content = await this.readStoredFile(userId, projectId, rawPath);
      await this.writeFileToContainer(
        container,
        projectName,
        filePath,
        content,
      );
    }
  }

  private async writeFileToContainer(
    container: Dockerode.Container,
    projectName: string,
    filePath: string,
    content: Buffer,
  ) {
    filePath = this.normalizeFilePath(filePath);
    const dirName = filePath.split("/").slice(0, -1).join("/");
    if (dirName) {
      await this.runShell(
        container,
        projectName,
        `mkdir -p -- ${this.shellQuote(dirName)}`,
      );
    }

    const tarStream = require("tar-stream");
    const pack = tarStream.pack();

    pack.entry({ name: filePath, size: content.length, mode: 0o644 }, content);
    pack.finalize();

    await container.putArchive(pack, {
      path: `/workspace/${projectName}`,
    });
  }

  private async deleteFileInContainer(
    container: Dockerode.Container,
    projectName: string,
    filePath: string,
  ) {
    filePath = this.normalizeFilePath(filePath);
    await this.runShell(
      container,
      projectName,
      `rm -rf -- ${this.shellQuote(filePath)}`,
    );
  }

  private async renameFileInContainer(
    container: Dockerode.Container,
    projectName: string,
    oldPath: string,
    newPath: string,
  ) {
    oldPath = this.normalizeFilePath(oldPath);
    newPath = this.normalizeFilePath(newPath);
    const newDir = newPath.split("/").slice(0, -1).join("/");
    const mkdir = newDir ? `mkdir -p -- ${this.shellQuote(newDir)} && ` : "";
    await this.runShell(
      container,
      projectName,
      `${mkdir}if [ -e ${this.shellQuote(
        oldPath,
      )} ]; then mv -- ${this.shellQuote(oldPath)} ${this.shellQuote(
        newPath,
      )}; fi`,
    );
  }

  private async readStoredFile(
    userId: string,
    projectId: string,
    filePath: string,
  ): Promise<Buffer> {
    const stream = await minioClient.getObject(
      FILES_BUCKET,
      `${this.filesPrefix(userId, projectId)}${filePath}`,
    );

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }

  private async listObjectPaths(bucket: string, prefix: string) {
    return new Promise<Set<string>>((resolve, reject) => {
      const paths = new Set<string>();
      const stream = minioClient.listObjects(bucket, prefix, true);

      stream.on("data", (obj) => {
        if (!obj.name || obj.name === prefix) return;
        const filePath = obj.name.slice(prefix.length);
        if (filePath) paths.add(filePath);
      });
      stream.on("end", () => resolve(paths));
      stream.on("error", reject);
    });
  }

  private async runShell(
    container: Dockerode.Container,
    projectName: string,
    command: string,
  ) {
    const exec = await container.exec({
      Cmd: ["sh", "-lc", command],
      WorkingDir: `/workspace/${projectName}`,
      AttachStdout: true,
      AttachStderr: true,
    });

    await new Promise<void>((resolve, reject) => {
      exec.start({ hijack: false, stdin: false }, (err, stream) => {
        if (err) return reject(err);
        if (!stream) return resolve();
        stream.on("data", () => {});
        stream.on("end", resolve);
        stream.on("error", reject);
      });
    });

    const info = await exec.inspect();
    if ((info.ExitCode ?? 0) !== 0) {
      throw new AppError(`Container command failed: ${command}`, 500);
    }
  }

  private shellQuote(value: string) {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }

  private async execInContainer(
    container: Dockerode.Container,
    command: string,
  ): Promise<string> {
    const exec = await container.exec({
      Cmd: ["bash", "-c", command],
      AttachStdout: true,
      AttachStderr: false,
    });

    return new Promise((resolve, reject) => {
      exec.start({ hijack: false, stdin: false }, (err, stream) => {
        if (err) return reject(err);
        if (!stream) return resolve("");

        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => {
          const output = chunks.map((c) => c.slice(8).toString()).join("");
          resolve(output);
        });
        stream.on("error", reject);
      });
    });
  }
}

export { ContainerService };
