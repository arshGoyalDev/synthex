import { CacheManager, createRedisClient, getContainerDbClient, getContainerRepository, PubSubManager } from "@synthex/database";

const prisma = getContainerDbClient();
export const db = getContainerRepository(prisma);

export const redis = createRedisClient();
export const redisSubscriber = createRedisClient(); 

redis.on("connect", () => console.log("Redis connected"));
redis.on("ready", () => console.log("Redis ready"));
redis.on("error", (err) => console.error("Redis error:", err.message));

export const cache = new CacheManager(redis);
export const pubsub = new PubSubManager(redis, redisSubscriber);