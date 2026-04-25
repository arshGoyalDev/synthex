import { createHash } from "crypto";

export function computeChecksum(content: string | Buffer): string {
  return createHash("md5").update(content).digest("hex");
}
