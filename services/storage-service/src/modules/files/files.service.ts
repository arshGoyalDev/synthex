import {
  minioClient,
  pubsub,
  redis,
  SNAPSHOT_BUCKET,
  FILES_BUCKET,
} from "../../config/database";
import { FilesRepository } from "./files.repository";
import { SnapshotRepository } from "../snapshots/snapshot.repository";
import { getMimeType } from "../../utils/mime";
import { AppError } from "../../utils/AppError";
import { Readable } from "stream";

class FilesService {
  private filesRepo = new FilesRepository();
  private snapshotRepo = new SnapshotRepository();

  private filesPrefix(userId: string, projectId: string) {
    return `${userId}/${projectId}/files/`;
  }

  private deletesPrefix(userId: string, projectId: string) {
    return `${userId}/${projectId}/deletes/`;
  }

  normalizeFilePath(filePath: string): string {
    const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const parts = normalized.split("/").filter(Boolean);

    if (
      parts.length === 0 ||
      parts.some((part) => part === "." || part === "..")
    ) {
      throw new AppError("Invalid filePath", 400);
    }

    return parts.join("/");
  }

  // ─── Called when container-service publishes "files:snapshot" ─────────────

  async handleSnapshot(data: {
    projectId: string;
    userId: string;
    minioKey: string;
    sizeBytes: number;
    fileCount: number;
    manifest: Array<{
      filePath: string;
      sizeBytes: number;
      mimeType: string;
      checksum: string;
    }>;
  }) {
    // 1. save snapshot record
    await this.snapshotRepo.create({
      projectId: data.projectId,
      userId: data.userId,
      minioKey: data.minioKey,
      sizeBytes: data.sizeBytes,
      fileCount: data.fileCount,
    });

    await this.reconcileFileIndex(
      data.projectId,
      data.userId,
      data.manifest,
    );

    await redis.setex(
      `files:snapshot:indexed:${data.projectId}:${data.minioKey}`,
      300,
      "1",
    );

    // 3. keep only last 5 snapshots — delete old ones from MinIO too
    const deleted = await this.snapshotRepo.deleteOld(data.projectId, 5);
    for (const snap of deleted) {
      await minioClient
        .removeObject(SNAPSHOT_BUCKET, snap.minioKey)
        .catch(() => {});
    }

    console.log(
      `[storage-service] Snapshot recorded: ${data.fileCount} files for ${data.projectId}`,
    );
  }

  // ─── List files ──────────────────────────────────────────────────────────

  async listFiles(projectId: string) {
    const existing = await this.filesRepo.findByProject(projectId);
    if (existing.length > 0) {
      return existing;
    }

    const latestSnapshot = await this.snapshotRepo.getLatest(projectId);
    if (!latestSnapshot) {
      return existing;
    }

    const manifest = await this.extractManifestFromSnapshot(latestSnapshot.minioKey);
    if (manifest.length === 0) {
      return existing;
    }

    await this.reconcileFileIndex(projectId, latestSnapshot.userId, manifest);

    return this.filesRepo.findByProject(projectId);
  }

  private async reconcileFileIndex(
    projectId: string,
    userId: string,
    manifestInput: Array<{
      filePath: string;
      sizeBytes: number;
      mimeType: string;
      checksum: string;
    }>,
  ) {
    const deletedPaths = await this.listMarkedDeletedPaths(
      userId,
      projectId,
    );
    const savedObjectPaths = await this.listSavedObjectPaths(
      userId,
      projectId,
    );
    const manifest = manifestInput.filter((f) => !deletedPaths.has(f.filePath));
    const manifestPaths = new Set(manifest.map((f) => f.filePath));
    const savedOnlyPaths = [...savedObjectPaths].filter(
      (filePath) => !manifestPaths.has(filePath) && !deletedPaths.has(filePath),
    );

    // 2. update file metadata from manifest
    await this.filesRepo.upsertMany(
      [
        ...manifest.map((f) => ({
          projectId,
          filePath: f.filePath,
          fileName: f.filePath.split("/").pop()!,
          minioPath: `${this.filesPrefix(userId, projectId)}${
            f.filePath
          }`,
          sizeBytes: f.sizeBytes,
          mimeType: f.mimeType,
          content: null,
        })),
        ...(await Promise.all(
          savedOnlyPaths.map(async (filePath) => {
            const minioPath = `${this.filesPrefix(userId, projectId)}${filePath}`;
            const stat = await minioClient.statObject(FILES_BUCKET, minioPath);

            return {
              projectId,
              filePath,
              fileName: filePath.split("/").pop() ?? filePath,
              minioPath,
              sizeBytes: stat.size,
              mimeType: getMimeType(filePath),
              content: null,
            };
          }),
        )),
      ],
    );

    const keepFilePaths = new Set<string>([
      ...manifest.map((f) => f.filePath),
      ...savedObjectPaths,
    ]);
    for (const deletedPath of deletedPaths) {
      keepFilePaths.delete(deletedPath);
    }
    await this.filesRepo.deleteMissing(projectId, [...keepFilePaths]);

    await pubsub.publish("storage:file:list-changed", {
      projectId,
      userId,
    });
  }

  // ─── Get single file content ─────────────────────────────────────────────

  async getFile(projectId: string, filePath: string) {
    filePath = this.normalizeFilePath(filePath);
    const file = await this.filesRepo.findByPath(projectId, filePath);
    if (!file) throw new AppError("File not found", 404);

    const fileObjectKey = file.minioPath;
    const hasFileObject = await this.objectExists(FILES_BUCKET, fileObjectKey);

    if (hasFileObject) {
      const content = await this.readObjectAsUtf8(FILES_BUCKET, fileObjectKey);
      return { ...file, content };
    }

    const snapshot = await this.snapshotRepo.getLatest(projectId);
    if (!snapshot) throw new AppError("No snapshot found", 404);

    const content = await this.extractFileFromSnapshot(
      snapshot.minioKey,
      filePath,
    );

    return { ...file, content };
  }

  // ─── Get latest snapshot key (for container-service restore) ─────────────

  async getLatestSnapshotKey(projectId: string) {
    const snapshot = await this.snapshotRepo.getLatest(projectId);
    return snapshot?.minioKey ?? null;
  }

  // ─── Delete file from manifest ───────────────────────────────────────────

  async deleteFile(projectId: string, filePath: string) {
    filePath = this.normalizeFilePath(filePath);
    await this.filesRepo.delete(projectId, filePath);
  }

  async saveFile(
    projectId: string,
    userId: string,
    filePath: string,
    content: string,
    options: { publish?: boolean } = {},
  ) {
    filePath = this.normalizeFilePath(filePath);
    const minioPath = `${this.filesPrefix(userId, projectId)}${filePath}`;
    const buffer = Buffer.from(content, "utf8");
    const mimeType = getMimeType(filePath);

    await minioClient.putObject(
      FILES_BUCKET,
      minioPath,
      buffer,
      buffer.length,
      { "Content-Type": mimeType },
    );

    await this.filesRepo.upsertMany([
      {
        projectId,
        filePath,
        fileName: filePath.split("/").pop() ?? filePath,
        minioPath,
        sizeBytes: buffer.length,
        mimeType,
        content,
      },
    ]);

    await this.removeDeleteMarker(userId, projectId, filePath);

    if (options.publish !== false) {
      await pubsub.publish("storage:file:mutation", {
        projectId,
        userId,
        event: "change",
        filePath,
        content,
      });
    }

    console.log(`[storage-service] Saved file ${filePath} for ${projectId}`);
  }

  async deleteStoredFile(projectId: string, userId: string, filePath: string) {
    filePath = this.normalizeFilePath(filePath);
    await this.filesRepo.delete(projectId, filePath);

    await minioClient
      .removeObject(
        FILES_BUCKET,
        `${this.filesPrefix(userId, projectId)}${filePath}`,
      )
      .catch(() => {});
    await this.putDeleteMarker(userId, projectId, filePath);

    await pubsub.publish("storage:file:mutation", {
      projectId,
      userId,
      event: "delete",
      filePath,
    });
  }

  async renameFile(
    projectId: string,
    userId: string,
    oldPath: string,
    newPath: string,
  ) {
    oldPath = this.normalizeFilePath(oldPath);
    newPath = this.normalizeFilePath(newPath);

    if (oldPath === newPath) return;

    const file = await this.getFile(projectId, oldPath);
    const content = file.content ?? "";
    const oldObjectKey = `${this.filesPrefix(userId, projectId)}${oldPath}`;

    await this.saveFile(projectId, userId, newPath, content, {
      publish: false,
    });
    await this.filesRepo.delete(projectId, oldPath);
    await minioClient.removeObject(FILES_BUCKET, oldObjectKey).catch(() => {});
    await this.putDeleteMarker(userId, projectId, oldPath);
    await this.removeDeleteMarker(userId, projectId, newPath);

    await pubsub.publish("storage:file:mutation", {
      projectId,
      userId,
      event: "rename",
      filePath: oldPath,
      newPath,
      content,
    });
  }

  // ─── Extract single file from tar.gz snapshot ────────────────────────────

  private async extractFileFromSnapshot(
    snapshotKey: string,
    targetFilePath: string,
  ): Promise<string> {
    const stream = await minioClient.getObject(SNAPSHOT_BUCKET, snapshotKey);

    return new Promise((resolve, reject) => {
      const tarStream = require("tar-stream");
      const zlib = require("zlib");
      const extract = tarStream.extract();
      const gunzip = zlib.createGunzip();

      extract.on(
        "entry",
        (header: any, entryStream: Readable, next: () => void) => {
          if (header.name === targetFilePath) {
            const chunks: Buffer[] = [];
            entryStream.on("data", (chunk) => chunks.push(chunk));
            entryStream.on("end", () => {
              resolve(Buffer.concat(chunks).toString("utf8"));
            });
            entryStream.on("error", reject);
          } else {
            entryStream.resume();
            next();
          }
        },
      );

      extract.on("finish", () =>
        reject(new AppError("File not found in snapshot", 404)),
      );
      extract.on("error", reject);

      stream.pipe(gunzip).pipe(extract);
    });
  }

  private async extractManifestFromSnapshot(snapshotKey: string) {
    const stream = await minioClient.getObject(SNAPSHOT_BUCKET, snapshotKey);

    return new Promise<
      Array<{
        filePath: string;
        sizeBytes: number;
        mimeType: string;
        checksum: string;
      }>
    >((resolve, reject) => {
      const tarStream = require("tar-stream");
      const zlib = require("zlib");
      const extract = tarStream.extract();
      const gunzip = zlib.createGunzip();
      const manifest: Array<{
        filePath: string;
        sizeBytes: number;
        mimeType: string;
        checksum: string;
      }> = [];

      extract.on(
        "entry",
        (header: any, entryStream: Readable, next: () => void) => {
          const filePath = String(header.name ?? "");
          if (!filePath || header.type === "directory") {
            entryStream.resume();
            next();
            return;
          }

          manifest.push({
            filePath,
            sizeBytes: Number(header.size ?? 0),
            mimeType: getMimeType(filePath),
            checksum: "",
          });

          entryStream.resume();
          entryStream.on("end", next);
          entryStream.on("error", reject);
        },
      );
      extract.on("finish", () => resolve(manifest));
      extract.on("error", reject);

      stream.pipe(gunzip).pipe(extract);
    });
  }

  private async objectExists(bucket: string, key: string): Promise<boolean> {
    try {
      await minioClient.statObject(bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  private async readObjectAsUtf8(bucket: string, key: string): Promise<string> {
    const stream = await minioClient.getObject(bucket, key);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      stream.on("error", reject);
    });
  }

  private async putDeleteMarker(
    userId: string,
    projectId: string,
    filePath: string,
  ) {
    await minioClient.putObject(
      FILES_BUCKET,
      `${this.deletesPrefix(userId, projectId)}${filePath}`,
      Buffer.alloc(0),
      0,
    );
  }

  private async removeDeleteMarker(
    userId: string,
    projectId: string,
    filePath: string,
  ) {
    await minioClient
      .removeObject(
        FILES_BUCKET,
        `${this.deletesPrefix(userId, projectId)}${filePath}`,
      )
      .catch(() => {});
  }

  private async listMarkedDeletedPaths(userId: string, projectId: string) {
    return this.listObjectPaths(
      FILES_BUCKET,
      this.deletesPrefix(userId, projectId),
    );
  }

  private async listSavedObjectPaths(userId: string, projectId: string) {
    return this.listObjectPaths(
      FILES_BUCKET,
      this.filesPrefix(userId, projectId),
    );
  }

  private async listObjectPaths(bucket: string, prefix: string) {
    return new Promise<Set<string>>((resolve, reject) => {
      const paths = new Set<string>();
      const stream = minioClient.listObjects(bucket, prefix, true);

      stream.on("data", (obj) => {
        if (!obj.name || obj.name === prefix) return;
        const filePath = obj.name.slice(prefix.length);
        if (filePath) paths.add(filePath);
      });
      stream.on("end", () => resolve(paths));
      stream.on("error", reject);
    });
  }
}

export { FilesService };
