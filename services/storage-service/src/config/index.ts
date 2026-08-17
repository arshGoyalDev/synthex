import { z } from "zod";

const envScheme = z.object({
  STORAGE_SERVICE_PORT: z.string().default("3005"),
  ORIGIN: z.string().default("http://localhost:5173"),
});

const env = envScheme.parse(process.env);

export { env };
