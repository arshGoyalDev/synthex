import express from "express";
import cors from "cors";

import { env } from "./config";

import { projectRoutes } from "./modules/project/project.routes";

import { registerSubscribers } from "./config/subscriber";
import { startTimeoutWatcher } from "./jobs/timeout.watcher";

const app = express();

app.use(
  cors({
    credentials: true,
    origin: env.ORIGIN,
  }),
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/", projectRoutes);

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Error:", err.message);

    if (err.name === "ZodError") {
      const message = err.issues?.[0]?.message ?? "Validation failed";
      return res.status(400).json({ error: message });
    }

    const status = err.statusCode || err.status || 500;
    res.status(status).json({ error: err.message || "Internal server error" });
  },
);

registerSubscribers().then(() => {
  console.log("[project-service] Subscribers registered");
});

startTimeoutWatcher();

const server = app.listen(env.PORT, () => {
  console.log(`project-service running on port ${env.PORT}`);
});
