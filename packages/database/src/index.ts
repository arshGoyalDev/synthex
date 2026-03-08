import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Client as MinioClient } from 'minio';

// ============================================
// PRISMA CLIENT
// ============================================
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/code_ide?schema=public',
  },
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ============================================
// REDIS CLIENT
// ============================================
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis = globalForRedis.redis ?? new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// ============================================
// MINIO CLIENT
// ============================================
export const minioClient = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

// ============================================
// RE-EXPORT PRISMA TYPES
// ============================================
export * from '@prisma/client';

// ============================================
// SESSION MANAGER
// ============================================
export class SessionManager {
  private redis: Redis;

  constructor(redisClient: Redis = redis) {
    this.redis = redisClient;
  }

  async create(userId: string, sessionData: Record<string, any> = {}): Promise<string> {
    const sessionId = crypto.randomUUID();
    const ttl = parseInt(process.env.SESSION_TTL || '86400');
    
    await this.redis.setex(
      `session:${sessionId}`,
      ttl,
      JSON.stringify({ userId, ...sessionData, createdAt: Date.now() })
    );
    
    return sessionId;
  }

  async get(sessionId: string): Promise<any | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async destroy(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  async refresh(sessionId: string): Promise<void> {
    const ttl = parseInt(process.env.SESSION_TTL || '86400');
    await this.redis.expire(`session:${sessionId}`, ttl);
  }

  async update(sessionId: string, data: Record<string, any>): Promise<void> {
    const current = await this.get(sessionId);
    if (current) {
      const ttl = parseInt(process.env.SESSION_TTL || '86400');
      await this.redis.setex(
        `session:${sessionId}`,
        ttl,
        JSON.stringify({ ...current, ...data })
      );
    }
  }
}

// ============================================
// CACHE MANAGER
// ============================================
export class CacheManager {
  private redis: Redis;

  constructor(redisClient: Redis = redis) {
    this.redis = redisClient;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// ============================================
// PUBSUB MANAGER (for real-time collaboration)
// ============================================
export class PubSubManager {
  private publisher: Redis;
  private subscriber: Redis;

  constructor() {
    this.publisher = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async publish(channel: string, message: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(msg));
        } catch (e) {
          callback(msg);
        }
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }
}

// ============================================
// MINIO HELPER
// ============================================
export class MinioManager {
  private client: MinioClient;

  constructor(client: MinioClient = minioClient) {
    this.client = client;
  }

  async uploadFile(
    bucket: string,
    objectName: string,
    stream: Buffer | import('stream').Readable,
    size?: number,
    metadata?: Record<string, string>
  ): Promise<void> {
    await this.client.putObject(bucket, objectName, stream, size, metadata);
  }

  async downloadFile(bucket: string, objectName: string): Promise<import('stream').Readable> {
    return await this.client.getObject(bucket, objectName);
  }

  async deleteFile(bucket: string, objectName: string): Promise<void> {
    await this.client.removeObject(bucket, objectName);
  }

  async listFiles(bucket: string, prefix?: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const objects: any[] = [];
      const stream = this.client.listObjects(bucket, prefix, true);
      
      stream.on('data', (obj) => objects.push(obj));
      stream.on('error', reject);
      stream.on('end', () => resolve(objects));
    });
  }

  async fileExists(bucket: string, objectName: string): Promise<boolean> {
    try {
      await this.client.statObject(bucket, objectName);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getPresignedUrl(
    bucket: string,
    objectName: string,
    expiry: number = 3600
  ): Promise<string> {
    return await this.client.presignedGetObject(bucket, objectName, expiry);
  }
}

// ============================================
// SEARCH HELPER
// ============================================
export async function searchFiles(query: string, projectId?: string) {
  if (projectId) {
    return prisma.$queryRaw`
      SELECT 
        pf.id, 
        pf.project_id, 
        pf.file_path, 
        pf.file_name,
        pf.content,
        ts_rank(
          to_tsvector('english', coalesce(pf.file_name, '') || ' ' || coalesce(pf.content, '')),
          plainto_tsquery('english', ${query})
        ) as rank
      FROM project_files pf
      WHERE to_tsvector('english', coalesce(pf.file_name, '') || ' ' || coalesce(pf.content, '')) 
            @@ plainto_tsquery('english', ${query})
            AND pf.project_id = ${projectId}::uuid
      ORDER BY rank DESC
      LIMIT 50
    `;
  }
  
  return prisma.$queryRaw`
    SELECT 
      pf.id, 
      pf.project_id, 
      pf.file_path, 
      pf.file_name,
      pf.content,
      ts_rank(
        to_tsvector('english', coalesce(pf.file_name, '') || ' ' || coalesce(pf.content, '')),
        plainto_tsquery('english', ${query})
      ) as rank
    FROM project_files pf
    WHERE to_tsvector('english', coalesce(pf.file_name, '') || ' ' || coalesce(pf.content, '')) 
          @@ plainto_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT 50
  `;
}

// ============================================
// EXPORT INSTANCES
// ============================================
export const sessionManager = new SessionManager();
export const cacheManager = new CacheManager();
export const pubSubManager = new PubSubManager();
export const minioManager = new MinioManager();