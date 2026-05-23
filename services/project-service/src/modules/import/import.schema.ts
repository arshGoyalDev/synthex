import z from "zod";

const detectGithubSchema = z.object({
  repoUrl: z.string().url(),
});

const importGithubSchema = z.object({
  repoUrl: z.string().url(),
  repoBranch: z.string().default("main"),
  name: z.string().min(1),
  description: z.string().optional(),
  runCommand: z.string().optional(),
  previewCommand: z.string().optional(),
  previewPort: z.number().int().positive().optional(),
  installCommand: z.string().optional(),
  isPreview: z.boolean().default(false),
  languages: z.array(z.string()).default([]),
  envVars: z.record(z.string()).optional(),
});

const detectZipSchema = z.object({
  filePaths: z.array(z.string()),
  fileContents: z.record(z.string()).optional(),
});

const importZipSchema = z.object({
  zipKey: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  runCommand: z.string().optional(),
  previewCommand: z.string().optional(),
  previewPort: z.number().int().positive().optional(),
  installCommand: z.string().optional(),
  isPreview: z.boolean().default(false),
  languages: z.array(z.string()).default([]),
  envVars: z.record(z.string()).optional(),
});

const updateConfigSchema = z.object({
  runCommand: z.string().nullable().optional(),
  previewCommand: z.string().nullable().optional(),
  previewPort: z.number().int().positive().nullable().optional(),
  installCommand: z.string().nullable().optional(),
  envVars: z.record(z.string()).nullable().optional(),
});

export {
  detectGithubSchema,
  importGithubSchema,
  detectZipSchema,
  importZipSchema,
  updateConfigSchema,
};
