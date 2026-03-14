import z from "zod";

const envSchema = z.object({
  PORT: z.string().default("3001"),

  JWT_SECRET: z.string(),
  ACCESS_TOKEN_EXPIRATION: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRATION: z.string().default("7d"),

  ORIGIN: z.string().default("http://localhost:5173"),
});

const env = envSchema.parse(process.env);

export { env };
