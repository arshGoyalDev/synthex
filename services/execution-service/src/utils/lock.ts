import { redis } from "../config/database";

const LOCK_TTL = {
  script: 30,
  devServer: 2 * 3600,
};

const acquireLock = async (
  projectId: string,
  executionId: string,
  isDevServer: boolean,
) => {
  const ttl = isDevServer ? LOCK_TTL.devServer : LOCK_TTL.script;

  const result = await redis.set(
    `execution:lock:${projectId}`,
    executionId,
    "EX",
    ttl,
    "NX",
  );

  return result === "OK";
};

const releaseLock = async (projectId: string) => {
  await redis.del(`execution:lock:${projectId}`);
};

const getLock = async (projectId: string) => {
  return redis.get(`execution:lock:${projectId}`);
};

export { acquireLock, releaseLock, getLock };
