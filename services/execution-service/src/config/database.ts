import {
  CacheManager,
  createRedisClient,
  getExecutionRepository,
  getExecutionDbClient,
  PubSubManager,
  createRedisSubscriber,
  type RedisClient,
} from "@synthex/database";
``
const prisma = getExecutionDbClient();
export const db = getExecutionRepository(prisma);


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
