import {
  CacheManager,
  createRedisClient,
  getExecutionDbClient,
  getExecutionRepository,
  getProjectDbClient,
  getProjectRepository,
  PubSubManager,
  scanKeys,
  type RedisClient,
} from "@synthex/database";

const prisma = getProjectDbClient();
export const db = getProjectRepository(prisma);
const executionPrisma = getExecutionDbClient();
export const executionDb = getExecutionRepository(executionPrisma);

export const redis: RedisClient = createRedisClient();
export const redisSubscriber: RedisClient = createRedisClient();

redis.on("connect", () => console.log("Redis connected"));
redis.on("ready", () => console.log("Redis ready"));
redis.on("error", (err) => console.error("Redis error:", err.message));

export const cache = new CacheManager(redis);
export const pubsub = new PubSubManager(redis, redisSubscriber);
export { scanKeys };
