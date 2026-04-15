import Dockerode from "dockerode";
import { Socket } from "socket.io";
import { Duplex } from "stream";

interface TerminalSession {
  stream: Duplex;
  socketId: string;
}

class TerminalService {
  private docker = new Dockerode();
  private sessions = new Map<string, TerminalSession>();

  private async startExecStream(
    exec: Dockerode.Exec,
    projectId: string,
    attemptLabel: string,
  ): Promise<Duplex> {
    const timeoutMs = 10000;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        void (async () => {
          try {
            const details = await exec.inspect();
            reject(
              new Error(
                `Timed out starting terminal shell (${attemptLabel}). Exec ${exec.id} status: running=${details.Running}, exitCode=${details.ExitCode ?? "n/a"}, pid=${details.Pid ?? "n/a"}`,
              ),
            );
          } catch (inspectErr: any) {
            reject(
              new Error(
                `Timed out starting terminal shell (${attemptLabel}). Exec ${exec.id} inspect failed: ${inspectErr?.message ?? "unknown error"}`,
              ),
            );
          }
        })();
      }, timeoutMs);
    });

    try {
      const startedStream = (await Promise.race([
        exec.start({
          hijack: true,
          stdin: true,
          Tty: true,
        }) as Promise<Duplex>,
        timeoutPromise,
      ])) as Duplex;

      if (!startedStream) {
        throw new Error(
          `Terminal shell did not return a stream (${attemptLabel})`,
        );
      }

      return startedStream;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  async attach(socket: Socket, projectId: string) {
    try {
      console.log(`[terminal] Attaching socket ${socket.id} to ${projectId}`);
      const container = this.docker.getContainer(`synthex-${projectId}`);
      const info = await container.inspect();
      console.log(
        `[terminal] Container ${projectId} state: ${info.State.Status}, running=${info.State.Running}`,
      );

      if (!info.State.Running) {
        socket.emit("terminal:error", {
          message: "Container is not running",
        });
        console.log(`[terminal] Container ${projectId} is not running`);
        return;
      }

      const projectName = info.Config?.Labels?.projectName;
      const workingDir = projectName
        ? `/workspace/${projectName}`
        : "/workspace";

      const attemptLabel = "single shell profile";

      const exec = await container.exec({
        Cmd: ["sh", "-i"],
        User: "synthex",
        WorkingDir: workingDir,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Env: ["TERM=xterm-256color"],
      });

      console.log(
        `[terminal] Exec created for ${projectId}, execId=${exec.id}, attempt=${attemptLabel}`,
      );

      const stream = await this.startExecStream(exec, projectId, attemptLabel);
      console.log(
        `[terminal] Exec stream started for ${projectId} using ${attemptLabel}`,
      );

      this.sessions.set(projectId, { stream, socketId: socket.id });

      stream.on("data", (chunk: Buffer) => {
        socket.emit("terminal:output", {
          data: chunk.toString("base64"),
        });
      });

      stream.on("end", () => {
        socket.emit("terminal:exit", {
          message: "Shell exited",
        });

        this.sessions.delete(projectId);
      });

      stream.on("error", (err) => {
        socket.emit("terminal:error", {
          message: err.message,
        });

        console.error(`[terminal] Stream error for ${projectId}:`, err);

        this.sessions.delete(projectId);
      });

      socket.on("terminal:input", ({ data }: { data: string }) => {
        const session = this.sessions.get(projectId);

        if (session?.stream.writable) {
          session.stream.write(Buffer.from(data, "base64"));
        }
      });

      socket.on(
        "terminal:resize",
        ({ rows, cols }: { rows: number; cols: number }) => {
          exec.resize({ h: rows, w: cols }).catch(() => {});
        },
      );

      socket.emit("terminal:ready", {
        message: "Terminal ready",
        projectId,
      });
      console.log(`[terminal] Terminal ready for ${projectId}`);
    } catch (err: any) {
      console.error(`[terminal] Failed to attach to ${projectId}:`, err);
      socket.emit("terminal:error", { message: err.message });
    }
  }

  detach(projectId: string, socketId: string) {
    const session = this.sessions.get(projectId);

    if (!session) return;

    if (session.socketId == socketId) {
      session.stream.destroy();

      this.sessions.delete(projectId);

      console.log(`[terminal] Session detached from ${projectId}`);
    }
  }
}

export { TerminalService };
