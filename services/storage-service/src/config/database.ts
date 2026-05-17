import {
  CacheManager,
  createRedisClient,
  PubSubManager,
  type RedisClient,
  createMinioClient,
  MinioManager,
  getStorageDbClient,
  getStorageRepository,
  createRedisSubscriber,
} from "@synthex/database";

export const prisma = getStorageDbClient();
export const db = getStorageRepository(prisma);

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

export const minioClient = createMinioClient();
export const minioManager = new MinioManager(minioClient);

export { SNAPSHOT_BUCKET, FILES_BUCKET } from "@synthex/database";
