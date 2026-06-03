import express from "express";
import cors from "cors";
import { createServer } from "http";
import openapiSpec from "./openapi";

import { env } from "./config";
import { ensureBuckets } from "./config/database";

import { registerSubscribers } from "./config/subscriber";

import {Server as SocketServer} from "socket.io";
import { registerTerminalHandlers } from "./modules/terminal/terminal.handler";

const app = express();
const httpServer = createServer(app);

app.use(
  cors({
    credentials: true,
    origin: env.ORIGIN,
  }),
);

const io = new SocketServer(httpServer, {
  cors: {
    origin: env.ORIGIN,
    credentials: true,
  },
  path: "/terminal/",
  allowRequest: (req, callback) => {
    console.log("[terminal] allowRequest", req.url, req.headers.origin);
    callback(null, true);
  },
});

io.engine.on("connection_error", (err) => {
  console.error(
    "[terminal] engine connection error",
    err.code,
    err.message,
    err.req?.url,
  );
});

io.engine.on("connection", (socket) => {
  console.log("[terminal] engine connected", socket.id, socket.transport.name);
});

httpServer.on("upgrade", (req) => {
  if (req.url?.startsWith("/terminal")) {
    console.log("[terminal] raw upgrade", req.url, req.headers.origin);
  }
});

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/openapi.json", (req, res) => {
  res.json(openapiSpec);
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("[container-service] Error:", err.message);

    if (err.name === "ZodError") {
      const message = err.issues?.[0]?.message ?? "Validation failed";
      return res.status(400).json({ error: message });
    }

    const status = err.statusCode || err.status || 500;
    res.status(status).json({ error: err.message || "Internal server error" });
  },
);

registerTerminalHandlers(io);

const start = async () => {
  await ensureBuckets();

  await registerSubscribers();
  console.log("[container-service] Subscribers registered");

  httpServer.listen(env.PORT, () => {
    console.log(`container-service running on port ${env.PORT}`);
  });
};

start().catch((err) => {
  console.error("[container-service] Startup failed:", err.message);
});
