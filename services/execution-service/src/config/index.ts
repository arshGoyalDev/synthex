import {z} from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3004'),
  ORIGIN: z.string().default("http://localhost:5173"),
})


export const env = envSchema.parse(process.env);
