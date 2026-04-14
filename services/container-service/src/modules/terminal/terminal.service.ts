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

      const exec = await container.exec({
        Cmd: ["/bin/bash", "-lc", "export TERM=xterm-256color; exec /bin/bash -l"],
        User: "synthex",
        WorkingDir: "/workspace",
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
      });
      console.log(`[terminal] Exec created for ${projectId}`);

      const stream = await new Promise<Duplex>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out starting terminal shell"));
        }, 10000);

        exec.start(
          {
            hijack: true,
            stdin: true,
          },
          (err, startedStream) => {
            clearTimeout(timeout);

            if (err) {
              reject(err);
              return;
            }

            if (!startedStream) {
              reject(new Error("Terminal shell did not return a stream"));
              return;
            }

            resolve(startedStream as Duplex);
          },
        );
      });
      console.log(`[terminal] Exec stream started for ${projectId}`);

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
      console.error(
        `[terminal] Failed to attach to ${projectId}:`,
        err,
      );
      socket.emit("terminal:error", { message: err.message });
    }
  }

  detach(projectId: string, socketId: string) {
    const session = this.sessions.get(projectId);

    if (session.socketId == socketId) {
      session.stream.destroy();

      this.sessions.delete(projectId);

      console.log(`[terminal] Session detached from ${projectId}`);
    }
  }
}

export { TerminalService };
