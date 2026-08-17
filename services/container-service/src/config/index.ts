import { z } from "zod";

const envScheme = z.object({
  CONTAINER_SERVICE_PORT: z.string().default("3003"),
  ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string(),
});

const env = envScheme.parse(process.env);

export { env };
