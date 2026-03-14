import z from "zod";

const envSchema = z.object({
  API_GATEWAY_PORT: z.string().default("3000"),
  JWT_SECRET: z.string(),

  USER_SERVICE_URL: z.string().default("http://localhost:3001"),
  PROJECT_SERVICE_URL: z.string().default("http://localhost:3002"),
  CONTAINER_SERVICE_URL: z.string().default("http://localhost:3003"),
  EXECUTION_SERVICE_URL: z.string().default("http://localhost:3004"),
  STORAGE_SERVICE_URL: z.string().default("http://localhost:3005"),
});

const env = envSchema.parse(process.env);

export { env };
