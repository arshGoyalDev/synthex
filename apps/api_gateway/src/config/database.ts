import {
  CacheManager,
  createRedisClient,
  PubSubManager,
  type RedisClient,
} from "@synthex/database";

export const redis: RedisClient = createRedisClient();
export const redisSubscriber: RedisClient = createRedisClient();

redis.on("connect", () => console.log("Redis connected"));
redis.on("ready", () => console.log("Redis ready"));
redis.on("error", (err) => console.error("Redis error:", err.message));

export const cache = new CacheManager(redis);
export const pubsub = new PubSubManager(redis, redisSubscriber);
