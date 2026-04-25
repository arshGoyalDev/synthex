import { minioClient, SNAPSHOT_BUCKET, FILES_BUCKET } from "../../config/database";
import { FilesRepository } from "./files.repository";
import { SnapshotRepository } from "../snapshots/snapshot.repository";
import { getMimeType } from "../../utils/mime";
import { AppError } from "../../utils/AppError";
import { Readable } from "stream";

class FilesService {
  private filesRepo = new FilesRepository();
  private snapshotRepo = new SnapshotRepository();

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

    // 2. update file metadata from manifest
    await this.filesRepo.upsertMany(
      data.manifest.map((f) => ({
        projectId: data.projectId,
        filePath: f.filePath,
        fileName: f.filePath.split("/").pop()!,
        minioPath: `${data.userId}/${data.projectId}/files/${f.filePath}`,
        sizeBytes: f.sizeBytes,
        mimeType: f.mimeType,
        content: null,
      })),
    );

    // 3. keep only last 5 snapshots — delete old ones from MinIO too
    const deleted = await this.snapshotRepo.deleteOld(data.projectId, 5);
    for (const snap of deleted) {
      await minioClient.removeObject(SNAPSHOT_BUCKET, snap.minioKey).catch(() => {});
    }

    console.log(
      `[storage-service] Snapshot recorded: ${data.fileCount} files for ${data.projectId}`,
    );
  }

  // ─── List files ──────────────────────────────────────────────────────────

  async listFiles(projectId: string) {
    return this.filesRepo.findByProject(projectId);
  }

  // ─── Get single file content ─────────────────────────────────────────────

  async getFile(projectId: string, filePath: string) {
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
    await this.filesRepo.delete(projectId, filePath);
  }

  async saveFile(
    projectId: string,
    userId: string,
    filePath: string,
    content: string,
  ) {
    const minioPath = `${userId}/${projectId}/files/${filePath}`;
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

    console.log(`[storage-service] Saved file ${filePath} for ${projectId}`);
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

      extract.on("entry", (header: any, entryStream: Readable, next: () => void) => {
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
      });

      extract.on("finish", () => reject(new AppError("File not found in snapshot", 404)));
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
}

export { FilesService };
