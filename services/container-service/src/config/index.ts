import { z } from "zod";

const envScheme = z.object({
  PORT: z.string().default("3003"),

  ORIGIN: z.string().default("http://localhost:5173"),
});

const env = envScheme.parse(process.env);

export { env };
