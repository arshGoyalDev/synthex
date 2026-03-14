import { createRedisClient, CacheManager, PubSubManager, getUserDbClient, getUserRepository } from "@synthex/database";

const prisma = getUserDbClient();
export const db = getUserRepository(prisma);

export const redis = createRedisClient();
export const redisSubscriber = createRedisClient(); 

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("ready", () => console.log("✅ Redis ready"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

export const cache = new CacheManager(redis);
export const pubsub = new PubSubManager(redis, redisSubscriber);