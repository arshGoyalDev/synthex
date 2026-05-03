import express from "express";
import cors from "cors";

import { filesRoutes } from "./modules/files/files.routes";
import { registerSubscribers } from "./config/subscriber";
import { minioClient, SNAPSHOT_BUCKET, FILES_BUCKET } from "./config/database";

import { env } from "./config";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/files", filesRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err.message);
  if (err.name === "ZodError") {
    const message = err.issues?.[0]?.message ?? "Validation failed";
    return res.status(400).json({ error: message });
  }

  const status = err.statusCode || err.status || 500;
  return res.status(status).json({ error: err.message || "Internal server error" });
});

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

  app.listen(env.PORT, () => {
    console.log(`storage-service running on port ${env.PORT}`);
  });
};

start().catch((err) => {
  console.error("[storage-service] Startup failed:", err.message);
});
