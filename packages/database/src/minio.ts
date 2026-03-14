import { Client as MinioClient } from "minio";

import type { Readable } from "stream";

export function createMinioClient() {
  return new MinioClient({
    endPoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000"),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin123",
  });
}

export class MinioManager {
  constructor(private client: MinioClient) {}

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