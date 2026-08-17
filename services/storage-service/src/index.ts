import express from "express";
import cors from "cors";
import openapiSpec from "./openapi";

import { filesRoutes } from "./modules/files/files.routes";
import { uploadRoutes } from "./modules/upload/upload.routes";
import { registerSubscribers } from "./config/subscriber";
import { minioClient, SNAPSHOT_BUCKET, FILES_BUCKET } from "./config/database";

import { env } from "./config";

const app = express();

app.use(
  cors({
    credentials: true,
    origin: env.ORIGIN,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "storage-service" }),
);
app.get("/openapi.json", (req, res) => res.json(openapiSpec));
app.use("/files", filesRoutes);
app.use("/upload", uploadRoutes);

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("[storage-service] Error:", err.message);

    if (err.name === "ZodError") {
      const message = err.issues?.[0]?.message ?? "Validation failed";
      return res.status(400).json({ error: message });
    }

    const status = err.statusCode || err.status || 500;
    return res
      .status(status)
      .json({ error: err.message || "Internal server error" });
  },
);

const ensureBuckets = async () => {
  for (const bucket of [SNAPSHOT_BUCKET, FILES_BUCKET]) {
    const exists = await minioClient.bucketExists(bucket);

    if (!exists) {
      await minioClient.makeBucket(bucket);
      console.log(`[minio] Created bucket: ${bucket}`);
    }
  }
};

const start = async () => {
  await ensureBuckets();

  await registerSubscribers();
  console.log("[storage-service] Subscribers registered");

  app.listen(env.STORAGE_SERVICE_PORT, () => {
    console.log(`storage-service running on port ${env.STORAGE_SERVICE_PORT}`);
  });
};

start().catch((err) => {
  console.error("[storage-service] Startup failed:", err.message);
});
