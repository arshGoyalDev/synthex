import Dockerode from "dockerode";
import { LANGUAGES, TEMPLATES } from "@synthex/templates";
import { AppError } from "../../utils/AppError";

class ContainerService {
  docker = new Dockerode();

  async createProjectContainer(
    projectId: string,
    projectName: string,
    languages?: string[],
    template?: string,
  ) {
    let commands: string[] = [];
    let selectedTemplate: (typeof TEMPLATES)[string] | null = null;

    if (template) {
      const tmpl = TEMPLATES[template];
      if (!tmpl) throw new AppError(`Unknown Template: ${template}`, 400);
      selectedTemplate = tmpl;

      const { install, setup, postSetup } = tmpl.getCommands(projectName);

      commands.push(...install, ...setup, ...postSetup);
    } else {
      if (!languages || languages.length === 0) {
        throw new AppError("Languages required for blank project", 400);
      }

      const installCommands = languages.flatMap(
        (lang) => LANGUAGES[lang]?.installCommands ?? [],
      );

      commands = [...installCommands, `mkdir -p /workspace/${projectName}`];
    }

    const container = await this.docker.createContainer({
      Image: "synthex/base:latest",
      name: `synthex-${projectId}`,
      WorkingDir: "/workspace",
      Tty: true,
      OpenStdin: true,
      Labels: {
        projectId,
        projectName,
        languages: languages ? languages.join(",") : "",
        ...(template && { template }),
      },
      HostConfig: {
        Memory: 512 * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: 50000,
        // NetworkMode: "host",
      },
    });

    await container.start();

    await this.runSetupCommands(container, commands, projectId);

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

      await new Promise<void>((resolve, reject) => {
        exec.start({ hijack: false, stdin: false }, (err, stream) => {
          if (err) return reject(err);

          if (!stream) return resolve();

          let output = "";

          stream.on("data", (chunk: Buffer) => {
            const text = chunk.slice(8).toString();
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
    }
  }
}

export { ContainerService };
