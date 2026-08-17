import express from "express";
import cors from "cors";
import openapiSpec from "./openapi";
import { executionRoutes } from "./modules/execution/execution.routes";
import { registerSubscribers } from "./config/subscribers";
import { startStaleWatcher } from "./jobs/stale.watcher";
import { env } from "./config";

const app = express();

app.use(
  cors({
    credentials: true,
    origin: env.ORIGIN,
  }),
);
app.use(express.json());

app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "execution-service" }),
);
app.get("/openapi.json", (req, res) => res.json(openapiSpec));
app.use("/", executionRoutes);

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("[execution-service] Error:", err.message);
   
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: err.message || "Internal server error" });
  },
);

registerSubscribers().then(() => {
  console.log("[execution-service] Subscribers registered");
});

startStaleWatcher();
console.log("[execution-service] Stale watcher started");

app.listen(env.EXECUTION_SERVICE_PORT, () => {
  console.log(`execution-service running on port ${env.EXECUTION_SERVICE_PORT}`);
});
