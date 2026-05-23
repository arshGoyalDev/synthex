import Dockerode from "dockerode";
import { LANGUAGES, TEMPLATES } from "@synthex/templates";
import { AppError } from "../../utils/AppError";
import { createSnapshot, getLatestSnapshotKey } from "../../utils/snapshots";
import { restoreSnapshot } from "../../utils/restore";
import {
  FILES_BUCKET,
  minioClient,
  pubsub,
  redis,
} from "../../config/database";

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
    let commands: string[] = [];
    let selectedTemplate: (typeof TEMPLATES)[string] | null = null;
    let image = this.DEFAULT_IMAGE;

    if (template) {
      const tmpl = TEMPLATES[template];

      if (!tmpl) throw new AppError(`Unknown Template: ${template}`, 400);
      selectedTemplate = tmpl;

      const { install, setup, postSetup } = tmpl.getCommands(projectName);

      const languageConfig = LANGUAGES[tmpl.language];

      const templateBaseImage = tmpl.baseImage;
      const resolvedBaseImage = templateBaseImage ?? languageConfig?.baseImage;

      if (resolvedBaseImage) {
        image = resolvedBaseImage;
        commands.push(...setup, ...postSetup);
      } else {
        commands.push(...install, ...setup, ...postSetup);
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
          commands = [`mkdir -p /workspace/${projectName}`];
        } else {
          commands = [
            ...lang.installCommands,
            `mkdir -p /workspace/${projectName}`,
          ];
        }
      } else {
        const installCommands = languages.flatMap(
          (lang) => LANGUAGES[lang]?.installCommands ?? [],
        );

        commands = [...installCommands, `mkdir -p /workspace/${projectName}`];
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
        if (commands.length > 0) {
          await this.runSetupCommands(container, commands, projectId);
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

    // git clone
    console.log(`[container-service] Cloning ${repoUrl} into ${projectName}`);
    const cloneCommands = [
      `mkdir -p /workspace`,
      `git clone --depth 1 --branch ${repoBranch} ${repoUrl} /workspace/${projectName}`,
    ];
    await this.runSetupCommands(container, cloneCommands, projectId);

    // install dependencies
    if (installCommand) {
      console.log(`[container-service] Running install: ${installCommand}`);
      await this.runSetupCommands(
        container,
        [`cd /workspace/${projectName} && ${installCommand}`],
        projectId,
      );
    }

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
    await this.runSetupCommands(container, [`mkdir -p /workspace/${projectName}`], projectId);

    // Extract zip into /workspace (Docker's putArchive expects a tar stream,
    // but for .zip we use unzip inside the container via stdin piping)
    // Strategy: stream the zip to MinIO temp, then exec unzip inside container
    console.log(`[container-service] Extracting ZIP for ${projectName}`);

    // Write zip to a temp path inside container via exec + base64
    // This is reliable cross-platform without needing tar conversion
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      zipStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      zipStream.on("end", resolve);
      zipStream.on("error", reject);
    });
    const zipBuffer = Buffer.concat(chunks);
    const b64 = zipBuffer.toString("base64");

    // Write zip to container then unzip
    const extractCmds = [
      `mkdir -p /workspace/${projectName}`,
      `echo '${b64}' | base64 -d > /tmp/import.zip`,
      `unzip -q -o /tmp/import.zip -d /workspace/${projectName} && rm /tmp/import.zip`,
      // Strip single top-level folder if present (common zip convention)
      `cd /workspace/${projectName} && if [ $(ls -1 | wc -l) -eq 1 ] && [ -d "$(ls -1)" ]; then mv "$(ls -1)"/* . 2>/dev/null; mv "$(ls -1)"/.[!.]* . 2>/dev/null; rmdir "$(ls -d */)" 2>/dev/null; fi`,
    ];
    await this.runSetupCommands(container, extractCmds, projectId);

    // Run install
    if (installCommand) {
      console.log(`[container-service] Running install: ${installCommand}`);
      await this.runSetupCommands(
        container,
        [`cd /workspace/${projectName} && ${installCommand}`],
        projectId,
      );
    }

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

  private async runSetupCommands(
    container: Dockerode.Container,
    commands: string[],
    projectId: string,
  ) {
    for (const command of commands) {
      console.log(`[${projectId}] Running: ${command}`);

      const exec = await container.exec({
        Cmd: ["bash", "-c", command],
        AttachStdout: true,
        AttachStderr: true,
      });

      let output = "";

      await new Promise<void>((resolve, reject) => {
        exec.start({ hijack: false, stdin: false }, (err, stream) => {
          if (err) return reject(err);

          if (!stream) return resolve();

          stream.on("data", (chunk: Buffer) => {
            const text = chunk.toString("utf8");
            output += text;
            if (text.trim()) {
              process.stdout.write(`[${projectId}] ${text}`);
            }
          });

          stream.on("end", () => {
            console.log(`[${projectId}] Command completed`);
            resolve();
          });

          stream.on("error", reject);
        });
      });

      const execInfo = await exec.inspect();
      const exitCode = execInfo.ExitCode ?? 1;

      if (exitCode !== 0) {
        console.log(`[${projectId}] Command failed: ${command}`);

        throw new AppError(
          `Setup command failed (exit ${exitCode}): ${command}\n${output.trim()}`,
          500,
        );
      }
    }
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
