import {
  CacheManager,
  createRedisClient,
  getContainerDbClient,
  getContainerRepository,
  PubSubManager,
  type RedisClient,
  createMinioClient,
  FILES_BUCKET,
  SNAPSHOT_BUCKET,
  createRedisSubscriber,
} from "@synthex/database";

const prisma = getContainerDbClient();
export const db = getContainerRepository(prisma);

export const minioClient = createMinioClient();
export { SNAPSHOT_BUCKET, FILES_BUCKET };

export const ensureBuckets = async () => {
  for (const bucket of [SNAPSHOT_BUCKET, FILES_BUCKET]) {
    const exists = await minioClient.bucketExists(bucket);

    if (!exists) {
      await minioClient.makeBucket(bucket);
      console.log(`[minio] Created bucket: ${bucket}`);
    }
  }
};

export const redis: RedisClient = createRedisClient();
export const redisSubscriber: RedisClient = createRedisSubscriber();

redis.on("connect", () => console.log("Redis connected"));
redis.on("ready", () => console.log("Redis ready"));
redis.on("error", (err) => console.error("Redis error:", err.message));

redisSubscriber.on("connect", () => console.log("Redis subscriber connected"));
redisSubscriber.on("ready", () => console.log("Redis subscriber ready"));
redisSubscriber.on("error", (err) => console.error("Redis subscriber error:", err.message));

export const cache = new CacheManager(redis);
export const pubsub = new PubSubManager(redis, redisSubscriber);
