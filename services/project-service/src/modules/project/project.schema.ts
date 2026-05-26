import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().default(""),
  template: z.string().optional(),
  languages: z.array(z.string()).min(1).max(5).optional(),
  type: z.enum(["template", "blank", "raw"]).default("template"),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  autoSaveEnabled: z.boolean().optional(),
});

export { createProjectSchema, updateProjectSchema };
