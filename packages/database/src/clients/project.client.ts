import { PrismaClient } from "../generated";

let client: PrismaClient | null = null;

export function getProjectDbClient() {
  if (!client) {
    client = new PrismaClient({
      log: process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    });
  }
  return client;
}

export function getProjectRepository(prisma: PrismaClient) {
  return {
    project: prisma.project,
    projectFile: prisma.projectFile,
  };
}