import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { env } from "../config";

const ALGORITHM = "aes-256-gcm";

const getKey = () => {
  return createHash("sha256").update(env.GITHUB_TOKEN_SECRET).digest();
}

const encryptToken = (plain: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipher: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

const decryptToken = (payload: { cipher: string; iv: string; tag: string }) => {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.cipher, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export { encryptToken, decryptToken, getKey };