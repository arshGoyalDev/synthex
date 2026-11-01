import Dockerode from "dockerode";
import { Socket } from "socket.io";
import { Duplex } from "stream";

interface TerminalSession {
  stream: Duplex;
  socketId: string;
  projectId: string;
}

class TerminalService {
  private docker = new Dockerode();
  private sessions = new Map<string, TerminalSession>();
  private preparations = new Map<string, Promise<void>>();

  private async prepareWorkspace(container: Dockerode.Container, workingDir: string) {
    const exec = await container.exec({
      User: "root",
      Cmd: ["sh", "-c", `
        set -eu
        chown -R synthex:synthex -- "$1"
        mkdir -p /home/synthex/.cache
        chown -R synthex:synthex /home/synthex
        cat > /etc/synthex-terminal-rc <<'EOF'
synthex_editor_blocked() { printf '%s\\n' 'Use the project editor to edit files.'; return 1; }
vi() { synthex_editor_blocked; }
vim() { synthex_editor_blocked; }
view() { synthex_editor_blocked; }
nano() { synthex_editor_blocked; }
emacs() { synthex_editor_blocked; }
export EDITOR=false VISUAL=false
if [ -x "$PWD/.venv/bin/python" ]; then
  export VIRTUAL_ENV="$PWD/.venv"
  export PATH="$VIRTUAL_ENV/bin:$PATH"
fi
EOF
        chmod 644 /etc/synthex-terminal-rc
      `, "synthex-prepare", workingDir],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ hijack: false, stdin: false });
    await new Promise<void>((resolve, reject) => {
      stream.on("data", () => {});
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    const result = await exec.inspect();
    if (result.ExitCode !== 0) throw new Error("Unable to prepare terminal workspace permissions");
  }

  private async preparePythonEnvironment(container: Dockerode.Container, workingDir: string) {
    const exec = await container.exec({
      User: "synthex",
      WorkingDir: workingDir,
      Env: ["HOME=/home/synthex"],
      Cmd: ["sh", "-c", "if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; fi"],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ hijack: false, stdin: false });
    await new Promise<void>((resolve, reject) => {
      stream.on("data", () => {});
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    const result = await exec.inspect();
    if (result.ExitCode !== 0) throw new Error("Unable to create the project Python environment");
  }

  private async startExecStream(
    exec: Dockerode.Exec,
    projectId: string,
    attemptLabel: string,
  ): Promise<Duplex> {
    const timeoutMs = 10000;
    let startedStream: Duplex | undefined;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        void (async () => {
          // Kill the stream if it was opened before the timeout fired
          if (startedStream) {
            try { startedStream.destroy(); } catch { /* ignore */ }
          }

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
      startedStream = (await Promise.race([
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

  async attach(socket: Socket, projectId: string, terminalId: string) {
    try {
      console.log(
        `[terminal] Attaching socket ${socket.id} to ${projectId} (${terminalId})`,
      );
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
      if (!projectName || projectName === "." || projectName === ".." || projectName.includes("/")) {
        throw new Error("Invalid project workspace name");
      }
      const workingDir = projectName ? `/workspace/${projectName}` : "/workspace";

      const languages = (info.Config?.Labels?.languages ?? "").split(",");
      let preparation = this.preparations.get(projectId);
      if (!preparation) {
        preparation = (async () => {
          await this.prepareWorkspace(container, workingDir);
          if (languages.includes("python") || info.Config?.Image === "synthex/python:latest") {
            await this.preparePythonEnvironment(container, workingDir);
          }
        })();
        this.preparations.set(projectId, preparation);
        void preparation.finally(() => {
          if (this.preparations.get(projectId) === preparation) this.preparations.delete(projectId);
        }).catch(() => {});
      }
      await preparation;

      const attemptLabel = "single shell profile";

      const exec = await container.exec({
        Cmd: ["sh", "-i"],
        User: "synthex",
        WorkingDir: workingDir,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Env: ["TERM=xterm-256color", "HOME=/home/synthex", "ENV=/etc/synthex-terminal-rc"],
      });

      console.log(
        `[terminal] Exec created for ${projectId}, execId=${exec.id}, attempt=${attemptLabel}`,
      );

      const stream = await this.startExecStream(exec, projectId, attemptLabel);
      console.log(
        `[terminal] Exec stream started for ${projectId} using ${attemptLabel}`,
      );

      if (!socket.connected) {
        stream.destroy();
        return;
      }

      this.sessions.set(socket.id, {
        stream,
        socketId: socket.id,
        projectId,
      });

      stream.on("data", (chunk: Buffer) => {
        socket.emit("terminal:output", {
          data: chunk.toString("base64"),
        });
      });

      stream.on("end", () => {
        socket.emit("terminal:exit", {
          message: "Shell exited",
        });

        this.sessions.delete(socket.id);
      });

      stream.on("error", (err) => {
        socket.emit("terminal:error", {
          message: err.message,
        });

        console.error(`[terminal] Stream error for ${projectId}:`, err);

        this.sessions.delete(socket.id);
      });

      socket.on("terminal:input", ({ data }: { data: string }) => {
        const session = this.sessions.get(socket.id);

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
        terminalId,
      });
      console.log(`[terminal] Terminal ready for ${projectId}`);
    } catch (err: any) {
      console.error(`[terminal] Failed to attach to ${projectId}:`, err);
      socket.emit("terminal:error", { message: err.message });
    }
  }

  detach(terminalId: string, socketId: string) {
    const session = this.sessions.get(socketId);

    if (!session) return;

    if (session.socketId == socketId) {
      session.stream.destroy();

      this.sessions.delete(socketId);

      console.log(`[terminal] Session detached from ${session.projectId}`);
    }
  }
}

export { TerminalService };
