import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().default(""),
  template: z.string().optional(),
  languages: z.array(z.string()).min(1).max(5).optional(),
  type: z.enum(["template", "blank", "raw"]).default("template"),
});

export { createProjectSchema };