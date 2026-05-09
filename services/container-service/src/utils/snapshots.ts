import Dockerode from "dockerode";
import archiver from "archiver";
import { Readable } from "stream";
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

  // Collect all archive output chunks in a single array.
  // We must start collecting BEFORE piping docker entries into the archive,
  // otherwise data is emitted and lost.
  const archiveChunks: Buffer[] = [];
  const archiveReady = new Promise<Buffer>((resolve, reject) => {
    archive.on("data", (chunk: Buffer) => archiveChunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(archiveChunks)));
    archive.on("error", reject);
  });

  // Extract entries from Docker's tar stream and re-pack into our archive
  await new Promise<void>((resolve, reject) => {
    const tarStream = require("tar-stream");
    const extract = tarStream.extract();

    extract.on("entry", (header: any, stream: Readable, next: () => void) => {
      const rawPath: string = header.name;

      // Docker's getArchive includes the base directory name as a prefix
      // (e.g. "testing-2/src/App.css"). Strip it so paths are relative to
      // the project root (e.g. "src/App.css").
      const prefixPattern = new RegExp(`^${projectName}/?`);
      const filePath = rawPath.replace(prefixPattern, "");

      if (!filePath || header.type === "directory" || shouldIgnore(filePath)) {
        stream.resume();
        return next();
      }

      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
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

  // Wait for the archive to finish writing all data, then upload
  const buffer = await archiveReady;
  const totalSize = buffer.length;

  await minioClient.putObject(
    SNAPSHOT_BUCKET,
    minioKey,
    buffer,
    buffer.length,
    { "Content-Type": "application/gzip" },
  );

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
