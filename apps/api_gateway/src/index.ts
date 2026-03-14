import express from "express";
import cors from "cors";
import "dotenv/config";
import { env } from "./config";
import { registerProxies } from "./proxy/proxy.middleware";

const app = express();

app.use(cors());

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "gateway" });
});

registerProxies(app);

app.listen(env.API_GATEWAY_PORT, () => {
  console.log(`API Gateway running on port ${env.API_GATEWAY_PORT}`);
});