import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { v4 as uuid } from "uuid";
import { minioClient } from "../../config/database";
import { AppError } from "../../utils/AppError";

// Use memory storage — files are streamed directly to MinIO
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/zip" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new AppError("Only .zip files are allowed", 400) as any);
    }
  },
});

const ZIP_BUCKET = "project-zips";

const uploadRoutes: Router = Router();

// Ensure the ZIP bucket exists on first use
let bucketReady = false;
async function ensureZipBucket() {
  if (bucketReady) return;
  const exists = await minioClient.bucketExists(ZIP_BUCKET);
  if (!exists) await minioClient.makeBucket(ZIP_BUCKET);
  bucketReady = true;
}

uploadRoutes.post(
  "/zip",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError("No file uploaded", 400);

      await ensureZipBucket();

      // Parse zip in-memory to extract file tree + key config files
      const zip = new AdmZip(req.file.buffer);
      const entries = zip.getEntries();

      // Security checks
      if (entries.length > 10_000) {
        throw new AppError("ZIP contains too many files (max 10,000)", 400);
      }

      // Collect file paths (strip top-level folder prefix if present)
      let prefix = "";
      const topLevelDirs = new Set<string>();
      for (const entry of entries) {
        const parts = entry.entryName.split("/");
        if (parts[0]) topLevelDirs.add(parts[0]);
      }
      // If all files share one top-level dir, strip it (common zip convention)
      if (topLevelDirs.size === 1) {
        prefix = Array.from(topLevelDirs)[0] + "/";
      }

      const filePaths: string[] = [];
      const fileContents: Record<string, string> = {};
      const CONFIG_FILES = ["package.json", "requirements.txt", "Cargo.toml", "go.mod"];

      for (const entry of entries) {
        if (entry.isDirectory) continue;

        const path = prefix ? entry.entryName.replace(prefix, "") : entry.entryName;
        if (!path) continue;

        // Path traversal prevention
        if (path.includes("..") || path.startsWith("/")) continue;

        filePaths.push(path);

        // Extract key config file contents for detection
        const fileName = path.split("/").pop() ?? "";
        if (CONFIG_FILES.includes(fileName)) {
          try {
            fileContents[fileName] = entry.getData().toString("utf-8");
          } catch {
            /* ignore binary files */
          }
        }
      }

      // Upload raw zip buffer to MinIO
      const zipKey = `${uuid()}.zip`;
      await minioClient.putObject(
        ZIP_BUCKET,
        zipKey,
        req.file.buffer,
        req.file.buffer.length,
        { "Content-Type": "application/zip" },
      );

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
