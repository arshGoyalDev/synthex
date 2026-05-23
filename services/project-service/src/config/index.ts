import { z } from "zod";

const envScheme = z.object({
  PORT: z.string().default("3002"),

  ORIGIN: z.string().default("http://localhost:5173"),
  USER_SERVICE_URL: z.string().default("http://localhost:3001"),
  INTERNAL_API_KEY: z.string(),
});

const env = envScheme.parse(process.env);

export { env };
