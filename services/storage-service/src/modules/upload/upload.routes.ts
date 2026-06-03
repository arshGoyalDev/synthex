import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { v4 as uuid } from "uuid";
import { minioClient, redis } from "../../config/database";
import { AppError } from "../../utils/AppError";

const ZIP_BUCKET = "project-zips";
const ZIP_OWNER_TTL_SEC = 60 * 60; // 1 hour
const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024; // 200 MB total extracted

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/zip" ||
      file.originalname.endsWith(".zip")
    ) {
      cb(null, true);
    } else {
      cb(new AppError("Only .zip files are allowed", 400) as any);
    }
  },
});

const uploadRoutes: Router = Router();

let bucketReady = false;
async function ensureZipBucket() {
  if (bucketReady) return;
  const exists = await minioClient.bucketExists(ZIP_BUCKET);
  if (!exists) await minioClient.makeBucket(ZIP_BUCKET);
  bucketReady = true;
}

function getUserId(req: Request): string {
  const userId = req.headers["x-user-id"];
  if (typeof userId !== "string" || !userId) {
    throw new AppError("Unauthorized", 401);
  }
  return userId;
}

uploadRoutes.post(
  "/zip",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError("No file uploaded", 400);

      const userId = getUserId(req);
      await ensureZipBucket();

      const zip = new AdmZip(req.file.buffer);
      const entries = zip.getEntries();

      if (entries.length > 10_000) {
        throw new AppError("ZIP contains too many files (max 10,000)", 400);
      }

      let uncompressedTotal = 0;
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        uncompressedTotal += entry.header.size;
        if (uncompressedTotal > MAX_UNCOMPRESSED_BYTES) {
          throw new AppError(
            "ZIP uncompressed size exceeds limit (max 200 MB)",
            400,
          );
        }
      }

      let prefix = "";
      const topLevelDirs = new Set<string>();
      for (const entry of entries) {
        const parts = entry.entryName.split("/");
        if (parts[0]) topLevelDirs.add(parts[0]);
      }
      if (topLevelDirs.size === 1) {
        prefix = Array.from(topLevelDirs)[0] + "/";
      }

      const filePaths: string[] = [];
      const fileContents: Record<string, string> = {};
      const CONFIG_FILES = [
        "package.json",
        "requirements.txt",
        "Cargo.toml",
        "go.mod",
      ];

      for (const entry of entries) {
        if (entry.isDirectory) continue;

        const path = prefix
          ? entry.entryName.replace(prefix, "")
          : entry.entryName;
        if (!path) continue;

        if (path.includes("..") || path.startsWith("/")) continue;

        filePaths.push(path);

        const fileName = path.split("/").pop() ?? "";
        if (CONFIG_FILES.includes(fileName)) {
          try {
            fileContents[fileName] = entry.getData().toString("utf-8");
          } catch {
            /* ignore binary files */
          }
        }
      }

      const zipKey = `${uuid()}.zip`;
      await minioClient.putObject(
        ZIP_BUCKET,
        zipKey,
        req.file.buffer,
        req.file.buffer.length,
        { "Content-Type": "application/zip" },
      );

      await redis.setex(`zip:owner:${zipKey}`, ZIP_OWNER_TTL_SEC, userId);

      res.json({
        data: {
          zipKey,
          filePaths,
          fileContents,
          originalName: req.file.originalname.replace(/\.zip$/i, ""),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export { uploadRoutes, ZIP_BUCKET };
