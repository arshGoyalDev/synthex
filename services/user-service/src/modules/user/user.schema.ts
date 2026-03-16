import { z } from "zod";

const updateUserSchema = z.object({
  username: z.string().min(2).optional(),
  avatarUrl: z.string().url().optional(),
});

export { updateUserSchema };
