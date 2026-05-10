import { createServer } from "net";

const findFreePort = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        return reject(new Error("Failed to get a free port"));
      }

      const port = address.port;
      server.close(() => resolve(port));
    });

    server.on("error", reject);
  });
};

const waitForPort = (port: number, timeoutMs = 60_000, intervalMs = 1_000) => {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const socket = new (require("net").Socket)();

      socket.setTimeout(1000);
      socket.connect(port, "127.0.0.1", () => {
        socket.destroy();
        resolve();
      });

      socket.on("error", () => {
        socket.destroy();

        if (Date.now() - start >= timeoutMs) {
          reject(
            new Error(
              `Port ${port} did not become available within ${timeoutMs}ms`,
            ),
          );
        } else {
          setTimeout(check, intervalMs);
        }
      });

      socket.on("timeout", () => {
        socket.destroy();

        setTimeout(check, intervalMs);
      });
    };

    check();
  });
};

export { findFreePort, waitForPort };
