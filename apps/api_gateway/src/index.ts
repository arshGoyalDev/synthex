import express from "express";
import cors from "cors";

import "dotenv/config";
import { env } from "./config";

import { registerProxies } from "./proxy/proxy.middleware";

import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { socketService } from "./config/socket";
import { registerSubscribers } from "./config/subscriber";

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

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "gateway" });
});

registerProxies(app);

httpServer.listen(env.API_GATEWAY_PORT, () => {
  console.log(`API Gateway running on port ${env.API_GATEWAY_PORT}`);
});
