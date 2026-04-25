import Dockerode from "dockerode";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import { minioClient, SNAPSHOT_BUCKET } from "../config/database";
import { shouldIgnore } from "./ignore";
import { getMimeType } from "./mime";
import { computeChecksum } from "./checksum";

export interface FileManifestEntry {
  filePath: string; 
  sizeBytes: number;
  mimeType: string;
  checksum: string;
}

export interface SnapshotResult {
  minioKey: string;
  sizeBytes: number;
  fileCount: number;
  manifest: FileManifestEntry[];
}

export async function createSnapshot(
  container: Dockerode.Container,
  projectId: string,
  userId: string,
  projectName: string,
): Promise<SnapshotResult> {
  const timestamp = Date.now();
  const minioKey = `${userId}/${projectId}/snapshots/${timestamp}.tar.gz`;

  const dockerTarStream = await container.getArchive({
    path: `/workspace/${projectName}`,
  });

  const manifest: FileManifestEntry[] = [];
  const archive = archiver("tar", { gzip: true });
  const passThrough = new PassThrough();

  let totalSize = 0;
  passThrough.on("data", (chunk) => { totalSize += chunk.length; });

  archive.pipe(passThrough);

  await new Promise<void>((resolve, reject) => {
    const tarStream = require("tar-stream");
    const extract = tarStream.extract();
    const gunzip = require("zlib").createGunzip();

    extract.on("entry", (header: any, stream: Readable, next: () => void) => {
      const filePath = header.name;

      if (header.type === "directory" || shouldIgnore(filePath)) {
        stream.resume();
        return next();
      }

      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        const content = Buffer.concat(chunks);

        manifest.push({
          filePath,
          sizeBytes: content.length,
          mimeType: getMimeType(filePath),
          checksum: computeChecksum(content),
        });

        archive.append(content, { name: filePath });
        next();
      });
      stream.on("error", reject);
    });

    extract.on("finish", () => {
      archive.finalize();
      resolve();
    });

    extract.on("error", reject);

    dockerTarStream.pipe(extract);
  });

  await new Promise<void>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const collectStream = new PassThrough();

    passThrough.pipe(collectStream);

    collectStream.on("data", (chunk) => chunks.push(chunk));
    collectStream.on("end", async () => {
      const buffer = Buffer.concat(chunks);
      totalSize = buffer.length;

      await minioClient.putObject(
        SNAPSHOT_BUCKET,
        minioKey,
        buffer,
        buffer.length,
        { "Content-Type": "application/gzip" },
      );

      resolve();
    });
    collectStream.on("error", reject);
  });

  console.log(
    `[snapshot] Created ${minioKey} — ${manifest.length} files, ${(totalSize / 1024).toFixed(1)}KB`,
  );

  return {
    minioKey,
    sizeBytes: totalSize,
    fileCount: manifest.length,
    manifest,
  };
}

export async function getLatestSnapshotKey(
  projectId: string,
  userId: string,
): Promise<string | null> {
  const prefix = `${userId}/${projectId}/snapshots/`;

  return new Promise((resolve, reject) => {
    const objects: { name: string; lastModified: Date }[] = [];
    const stream = minioClient.listObjects(SNAPSHOT_BUCKET, prefix, true);

    stream.on("data", (obj) => {
      if (obj.name) objects.push({ name: obj.name, lastModified: obj.lastModified! });
    });

    stream.on("end", () => {
      if (objects.length === 0) return resolve(null);
      objects.sort((a, b) =>
        b.lastModified.getTime() - a.lastModified.getTime()
      );
      const latest = objects[0];
      if (!latest) return resolve(null);
      resolve(latest.name);
    });

    stream.on("error", reject);
  });
}
