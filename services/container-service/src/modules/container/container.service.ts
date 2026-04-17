import Dockerode from "dockerode";
import { LANGUAGES, TEMPLATES } from "@synthex/templates";
import { AppError } from "../../utils/AppError";

class ContainerService {
  docker = new Dockerode();
  private readonly DEFAULT_IMAGE = "synthex/base:latest";

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
      console.log(container);
      const info = await container.inspect();

      if (!info.State.Running) {
        await container.start();

        console.log(`[container-service] Started container for ${projectId}`);
      }
    } catch (error) {
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

      await this.runSetupCommands(container, commands, projectId);
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

  async stopContainer(projectId: string) {
    try {
      const container = this.docker.getContainer(`synthex-${projectId}`);
      const info = await container.inspect();

      if (info.State.Running) {
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

  async cleanupContainer(projectId: string) {
    try {
      const container = this.docker.getContainer(`synthex-${projectId}`);
      const info = await container.inspect();

      if (info.State.Running) {
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
}

export { ContainerService };
