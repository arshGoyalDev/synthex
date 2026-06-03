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

const releaseLock = async (projectId: string, executionId?: string) => {
  if (!executionId) {
    await redis.del(`execution:lock:${projectId}`);
    return;
  }

  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, `execution:lock:${projectId}`, executionId);
};

const getLock = async (projectId: string) => {
  return redis.get(`execution:lock:${projectId}`);
};

export { acquireLock, releaseLock, getLock };
