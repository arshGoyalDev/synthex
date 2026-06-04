import { Client as MinioClient } from "minio";

import type { Readable } from "stream";

function createClientFromConfig(options?: {
  endPoint?: string;
  port?: number;
  useSSL?: boolean;
}) {
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;

  if (
    process.env.NODE_ENV === "production" &&
    (!accessKey?.trim() || !secretKey?.trim())
  ) {
    throw new Error(
      "MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be set in production",
    );
  }

  return new MinioClient({
    endPoint: options?.endPoint ?? (process.env.MINIO_ENDPOINT || "localhost"),
    port: options?.port ?? parseInt(process.env.MINIO_PORT || "9000"),
    useSSL: options?.useSSL ?? process.env.MINIO_USE_SSL === "true",
    accessKey: accessKey || "minioadmin",
    secretKey: secretKey || "minioadmin123",
  });
}

export function createMinioClient() {
  return createClientFromConfig();
}

export function createPresignedMinioClient() {
  const publicUrl = process.env.MINIO_PUBLIC_URL?.trim();

  if (!publicUrl) {
    return createClientFromConfig();
  }

  const parsed = new URL(publicUrl);
  return createClientFromConfig({
    endPoint: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port) : parsed.protocol === "https:" ? 443 : 80,
    useSSL: parsed.protocol === "https:",
  });
}

export class MinioManager {
  constructor(private client: MinioClient) {
    this.client = client;
  }

  async upload(bucket: string, key: string, stream: Buffer | Readable, size?: number, metadata?: Record<string, string>) {
    await this.client.putObject(bucket, key, stream, size, metadata);
  }

  async download(bucket: string, key: string): Promise<Readable> {
    return this.client.getObject(bucket, key);
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.client.statObject(bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async presignedUrl(bucket: string, key: string, expiry = 3600): Promise<string> {
    return this.client.presignedGetObject(bucket, key, expiry);
  }

  async list(bucket: string, prefix?: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const objects: any[] = [];
      const stream = this.client.listObjects(bucket, prefix, true);
      stream.on("data", (obj) => objects.push(obj));
      stream.on("error", reject);
      stream.on("end", () => resolve(objects));
    });
  }
}

export const SNAPSHOT_BUCKET = "project-snapshots";
export const FILES_BUCKET = "project-files";
