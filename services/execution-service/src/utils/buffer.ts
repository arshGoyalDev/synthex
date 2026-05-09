import { redis } from "../config/database";

const MAX_CHUNKS = 1000;
const MAX_CHUNKS_BYTES = 4 * 1024;
const BUFFER_TTL = 20 * 60;

interface OutputChunk {
  seq: number;
  data: string;
  type: "stdout" | "stderr";
  timestamp: number;
}

const sanitizeChunk = (data: string) => {
  const buf = Buffer.from(data, "utf-8");
  if (buf.length <= MAX_CHUNKS_BYTES) return data;

  const truncated = buf.slice(0, MAX_CHUNKS_BYTES);
  const notice = Buffer.from("\n[chunk truncated]\n");
  return Buffer.concat([truncated, notice]).toString("base64");
};

const pushToBuffer = async (executionId: string, chunk: OutputChunk) => {
  const key = `execution:buffer:${executionId}`;
  const serialized = JSON.stringify({
    ...chunk,
    data: sanitizeChunk(chunk.data),
  });

  await redis
    .pipeline()
    .rpush(key, serialized)
    .ltrim(key, -MAX_CHUNKS, -1)
    .expire(key, BUFFER_TTL)
    .exec();
};

const readBuffer = async (executionId: string, fromSeq = 0) => {
  const key = `execution:buffer:${executionId}`;
  const raw = await redis.lrange(key, 0, -1);

  return raw
    .map((r) => JSON.parse(r) as OutputChunk)
    .filter((c) => c.seq >= fromSeq)
    .sort((a, b) => a.seq - b.seq);
};

const flushBuffer = async (executionId: string) => {
  const chunks = await readBuffer(executionId, 0);

  const fullOutput = chunks
    .map((c) => Buffer.from(c.data, "base64").toString("utf8"))
    .join("");

  return fullOutput.slice(0, 1_000_000); // cap at 1MB
};

const clearBuffer = async (executionId: string) => {
  await redis
    .pipeline()
    .del(`execution:buffer:${executionId}`)
    .del(`execution:seq:${executionId}`)
    .del(`execution:status:${executionId}`)
    .del(`execution:meta:${executionId}`)
    .exec();
};

const newSeq = async (executionId: string) => {
  const seq = await redis.incr(`execution:seq:${executionId}`);
  await redis.expire(`execution:seq:${executionId}`, BUFFER_TTL);

  return seq;
}

export type { OutputChunk };
export { pushToBuffer, readBuffer, flushBuffer, clearBuffer, newSeq };