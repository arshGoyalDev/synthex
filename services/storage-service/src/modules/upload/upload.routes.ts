import { Router, Request, Response, NextFunction } from "express";
import AdmZip from "adm-zip";
import { createWriteStream, promises as fs } from "fs";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import { v4 as uuid } from "uuid";
import z from "zod";

import { minioClient, minioPresignClient, redis } from "../../config/database";
import { AppError } from "../../utils/AppError";

const ZIP_BUCKET = "project-zips";
const ZIP_OWNER_TTL_SEC = 60 * 60;
const UPLOAD_SESSION_TTL_SEC = 15 * 60;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 10_000;
const MAX_CONFIG_FILE_BYTES = 512 * 1024;
const PRESIGNED_UPLOAD_EXPIRY_SEC = 15 * 60;
const CONFIG_FILES = new Set([
  "package.json",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
]);

const initZipUploadSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  contentType: z.string().optional(),
});

const completeZipUploadSchema = z.object({
  zipKey: z.string().min(1),
});

interface PendingZipUpload {
  userId: string;
  fileName: string;
  originalName: string;
  expectedSize: number;
}

interface ZipManifest {
  filePaths: string[];
  fileContents: Record<string, string>;
}

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

function getPendingZipKey(zipKey: string) {
  return `zip:pending:${zipKey}`;
}

function getZipOwnerKey(zipKey: string) {
  return `zip:owner:${zipKey}`;
}

function normalizeUploadName(fileName: string) {
  return fileName.replace(/^.*[\\/]/, "");
}

function assertZipFilename(fileName: string) {
  if (!fileName.toLowerCase().endsWith(".zip")) {
    throw new AppError("Only .zip files are allowed", 400);
  }
}

async function loadPendingUpload(zipKey: string): Promise<PendingZipUpload> {
  const raw = await redis.get(getPendingZipKey(zipKey));
  if (!raw) {
    throw new AppError("ZIP upload session not found or expired", 404);
  }

  try {
    return JSON.parse(raw) as PendingZipUpload;
  } catch {
    throw new AppError("ZIP upload session is invalid", 500);
  }
}

function normalizeEntryName(entryName: string) {
  const normalized = entryName.replace(/\\/g, "/").replace(/^\/+/, "");

  if (!normalized) {
    return "";
  }

  if (/^[A-Za-z]:\//.test(normalized)) {
    throw new AppError("ZIP contains invalid absolute paths", 400);
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new AppError("ZIP contains invalid relative paths", 400);
  }

  return segments.join("/");
}

async function downloadZipToTempFile(zipKey: string) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "synthex-zip-"));
  const tempFile = path.join(tempDir, `${uuid()}.zip`);

  try {
    const objectStream = await minioClient.getObject(ZIP_BUCKET, zipKey);
    await pipeline(objectStream, createWriteStream(tempFile));
    return { tempDir, tempFile };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function removeUploadedZip(zipKey: string) {
  await minioClient.removeObject(ZIP_BUCKET, zipKey).catch(() => {});
}

function buildZipManifest(zip: AdmZip): ZipManifest {
  const entries = zip.getEntries();

  if (entries.length === 0) {
    throw new AppError("ZIP archive is empty", 400);
  }

  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new AppError("ZIP contains too many files (max 10,000)", 400);
  }

  let uncompressedTotal = 0;
  const normalizedFiles: Array<{
    entry: (typeof entries)[number];
    entryName: string;
    topLevelDir: string;
  }> = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = normalizeEntryName(entry.entryName);
    if (!entryName) continue;

    uncompressedTotal += entry.header.size;
    if (uncompressedTotal > MAX_UNCOMPRESSED_BYTES) {
      throw new AppError(
        "ZIP uncompressed size exceeds limit (max 200 MB)",
        400,
      );
    }

    const [topLevelDir] = entryName.split("/");
    normalizedFiles.push({
      entry,
      entryName,
      topLevelDir: topLevelDir ?? "",
    });
  }

  if (normalizedFiles.length === 0) {
    throw new AppError("ZIP archive does not contain any files", 400);
  }

  const topLevelDirs = new Set(
    normalizedFiles.map((file) => file.topLevelDir).filter(Boolean),
  );
  const prefix = topLevelDirs.size === 1 ? `${normalizedFiles[0]?.topLevelDir}/` : "";

  const filePaths: string[] = [];
  const fileContents: Record<string, string> = {};

  for (const { entry, entryName } of normalizedFiles) {
    const normalizedPath =
      prefix && entryName.startsWith(prefix)
        ? entryName.slice(prefix.length)
        : entryName;

    if (!normalizedPath) continue;

    filePaths.push(normalizedPath);

    const fileName = normalizedPath.split("/").pop() ?? "";
    if (
      CONFIG_FILES.has(fileName) &&
      !(fileName in fileContents) &&
      entry.header.size <= MAX_CONFIG_FILE_BYTES
    ) {
      try {
        fileContents[fileName] = entry.getData().toString("utf-8");
      } catch {
        // Ignore config entries that are not valid UTF-8 text.
      }
    }
  }

  return { filePaths, fileContents };
}

uploadRoutes.post(
  "/zip/init",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { fileName, fileSize, contentType } = initZipUploadSchema.parse(
        req.body,
      );

      const normalizedFileName = normalizeUploadName(fileName);
      assertZipFilename(normalizedFileName);
      await ensureZipBucket();

      const zipKey = `${uuid()}.zip`;
      const originalName = normalizedFileName.replace(/\.zip$/i, "");

      await redis.setex(
        getPendingZipKey(zipKey),
        UPLOAD_SESSION_TTL_SEC,
        JSON.stringify({
          userId,
          fileName: normalizedFileName,
          originalName,
          expectedSize: fileSize,
        } satisfies PendingZipUpload),
      );

      const uploadUrl = await minioPresignClient.presignedPutObject(
        ZIP_BUCKET,
        zipKey,
        PRESIGNED_UPLOAD_EXPIRY_SEC,
      );

      res.json({
        data: {
          zipKey,
          uploadUrl,
          uploadHeaders: {
            "Content-Type": contentType || "application/zip",
          },
          expiresInSeconds: PRESIGNED_UPLOAD_EXPIRY_SEC,
          originalName,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

uploadRoutes.post(
  "/zip/complete",
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = getUserId(req);

    try {
      const { zipKey } = completeZipUploadSchema.parse(req.body);
      const pending = await loadPendingUpload(zipKey);

      if (pending.userId !== userId) {
        throw new AppError("Forbidden", 403);
      }

      await ensureZipBucket();

      const stat = await minioClient
        .statObject(ZIP_BUCKET, zipKey)
        .catch(() => null);
      if (!stat) {
        throw new AppError("Uploaded ZIP not found", 404);
      }

      if (!stat.size || stat.size <= 0) {
        throw new AppError("Uploaded ZIP is empty", 400);
      }

      if (stat.size > MAX_UPLOAD_BYTES) {
        throw new AppError("ZIP file exceeds limit (max 100 MB)", 400);
      }

      if (pending.expectedSize !== stat.size) {
        throw new AppError("Uploaded ZIP size does not match the requested upload", 400);
      }

      const { tempDir, tempFile } = await downloadZipToTempFile(zipKey);

      try {
        const zip = new AdmZip(tempFile);
        const manifest = buildZipManifest(zip);

        await redis.multi()
          .setex(getZipOwnerKey(zipKey), ZIP_OWNER_TTL_SEC, userId)
          .del(getPendingZipKey(zipKey))
          .exec();

        res.json({
          data: {
            zipKey,
            originalName: pending.originalName,
            ...manifest,
          },
        });
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    } catch (err) {
      const zipKey =
        req.body && typeof req.body.zipKey === "string" ? req.body.zipKey : null;

      if (zipKey) {
        await redis.del(getPendingZipKey(zipKey)).catch(() => {});
        await removeUploadedZip(zipKey);
      }

      next(err);
    }
  },
);

export { uploadRoutes, ZIP_BUCKET };
