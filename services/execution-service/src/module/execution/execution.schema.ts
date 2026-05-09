import { z } from "zod";

const startExecutionSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  command: z.string().min(1),
  workDir: z.string().optional(),
  isDevServer: z.boolean().default(false),
  port: z.number().optional(), // required if isDevServer
  templateId: z.string().optional(), // for base path injection
});

const startPreviewSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  command: z.string().min(1),
  port: z.number(),
  templateId: z.string().optional(),
});

type StartExecutionDto = z.infer<typeof startExecutionSchema>;
type StartPreviewDto = z.infer<typeof startPreviewSchema>;

export type { StartExecutionDto, StartPreviewDto };
export { startExecutionSchema, startPreviewSchema };
