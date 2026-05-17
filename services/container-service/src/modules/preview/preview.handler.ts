import Dockerode from "dockerode";
import { pubsub, redis } from "../../config/database";
import { findFreePort, waitForPort } from "../../utils/ports";

interface PreviewStartData {
  projectId: string;
  userId: string;
  command: string;
  port: number; // container port e.g. 5173
  workDir: string;
  basePath: string; // /preview/{projectId}
  envVars: Record<string, string>;
}

class PreviewHandler {
  private docker = new Dockerode();

  async startPreview(data: PreviewStartData) {
    const { projectId, userId, command, port, workDir, basePath, envVars } =
      data;

    try {
      const container = this.docker.getContainer(`synthex-${projectId}`);
      await container.inspect();

      const hostPort = await findFreePort();

      await redis.set(`preview:${projectId}:port`, hostPort.toString());
      await redis.set(`preview:${projectId}:status`, "starting");

      const exec = await container.exec({
        Cmd: ["bash", "-c", command],
        Env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
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

      const execInfo = await exec.inspect();
      await redis.set(
        `preview:${projectId}:pid`,
        execInfo.Pid?.toString() ?? "",
      );

      stream.on("data", async (chunk: Buffer) => {
        const text = chunk.slice(8).toString();
        if (text.trim()) {
          await pubsub.publish("preview:output", {
            projectId,
            userId,
            data: text,
          });
        }
      });

      console.log(`[preview-handler] Waiting for port ${port} in container...`);

      await this.waitForContainerPort(container, port);

      console.log(
        `[preview-handler] Preview ready for ${projectId} on host:${hostPort}`,
      );

      const containerInfo = await container.inspect();

      const containerIp =
        containerInfo.NetworkSettings.Networks[
          Object.keys(containerInfo.NetworkSettings.Networks)[0]
        ]?.IPAddress;

      await redis.set(
        `preview:${projectId}:target`,
        `http://${containerIp}:${port}`,
      );

      await redis.set(`preview:${projectId}:status`, "running");

      await pubsub.publish("preview:ready", {
        projectId,
        userId,
        hostPort,
        containerIp,
        containerPort: port,
      });

      stream.on("end", async () => {
        await this.cleanupPreview(projectId, userId);
      });
    } catch (err: any) {
      console.error(`[preview-handler] Failed for ${projectId}:`, err.message);

      await redis.set(`preview:${projectId}:status`, "error");

      await pubsub.publish("preview:error", {
        projectId,
        userId,
        message: err.message,
      });
    }
  }

  async stopPreview(projectId: string) {
    try {
      const container = this.docker.getContainer(`synthex-${projectId}`);
      const pid = await redis.get(`preview:${projectId}:pid`);

      if (pid) {
        const exec = await container.exec({
          Cmd: ["bash", "-c", `kill -TERM ${pid} 2>/dev/null || true`],
          AttachStdout: false,
          AttachStderr: false,
        });
        exec.start({ hijack: false, stdin: false }, () => {});
      }

      await this.cleanupPreview(projectId, "");
      console.log(`[preview-handler] Stopped preview for ${projectId}`);
    } catch (err: any) {
      console.error(`[preview-handler] Stop failed:`, err.message);
    }
  }

  private async cleanupPreview(projectId: string, userId: string) {
    await redis
      .pipeline()
      .del(`preview:${projectId}:port`)
      .del(`preview:${projectId}:status`)
      .del(`preview:${projectId}:pid`)
      .del(`preview:${projectId}:target`)
      .del(`preview:${projectId}:proxyUrl`)
      .exec();

    if (userId) {
      await pubsub.publish("preview:status", {
        projectId,
        userId,
        status: "stopped",
        previewUrl: "",
      });
    }
  }

  private async waitForContainerPort(
    container: Dockerode.Container,
    port: number,
    timeoutMs = 60_000,
    intervalMs = 1_000,
  ): Promise<void> {
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const check = async () => {
        try {
          // Use bash built-in /dev/tcp — works without nc/netcat
          const exec = await container.exec({
            Cmd: [
              "bash",
              "-c",
              `(echo > /dev/tcp/localhost/${port}) 2>/dev/null`,
            ],
            AttachStdout: true,
            AttachStderr: true,
          });

          const info: { ExitCode: number | null } = await new Promise(
            (res, rej) => {
              exec.start(
                { hijack: true, stdin: false },
                async (err, stream) => {
                  if (err) return rej(err);
                  // drain the stream so exec can finish
                  stream!.resume();
                  stream!.on("end", async () => {
                    try {
                      const result = await exec.inspect();
                      res({ ExitCode: result.ExitCode });
                    } catch (e) {
                      rej(e);
                    }
                  });
                },
              );
            },
          );

          if (info.ExitCode === 0) {
            resolve();
            return;
          }
        } catch {}

        if (Date.now() - start > timeoutMs) {
          reject(
            new Error(
              `Dev server did not start on port ${port} within ${timeoutMs}ms`,
            ),
          );
          return;
        }

        setTimeout(check, intervalMs);
      };

      check();
    });
  }
}

export { PreviewHandler };
