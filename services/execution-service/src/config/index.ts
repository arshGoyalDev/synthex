import {z} from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3000'),
})
