import express from "express";
import cors from "cors";

import "dotenv/config";
import { env } from "./config";

import { registerProxies } from "./proxy/proxy.middleware";

import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { socketService } from "./config/socket";
import { registerSubscribers } from "./config/subscriber";
import { createProxyMiddleware } from "http-proxy-middleware";
import { initPreviewProxy, restorePreviewProxies } from "./proxy/preview.proxy";

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
});

socketService.init(io);

registerSubscribers(io).then(() => {
  console.log("[api_gateway] Subscribers registered");
});

const terminalProxy = createProxyMiddleware("/terminal", {
  target: env.CONTAINER_SERVICE_URL,
  changeOrigin: true,
  ws: true,
  logLevel: "debug",
  onError: (err, req) => {
    console.error("[terminal-proxy] HTTP proxy error", req.url, err.message);
  },
  onProxyReqWs: (_proxyReq, req) => {
    console.log("[terminal-proxy] WS upgrade", req.url);
  },
});

app.use(terminalProxy);
httpServer.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/terminal") && terminalProxy.upgrade) {
    terminalProxy.upgrade(req as any, socket as any, head);
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "gateway" });
});

registerProxies(app);

initPreviewProxy(app, httpServer);
restorePreviewProxies().catch((err) => {
  console.error("[preview-proxy] Failed to restore previews:", err.message);
});

httpServer.listen(env.API_GATEWAY_PORT, () => {
  console.log(`API Gateway running on port ${env.API_GATEWAY_PORT}`);
});
