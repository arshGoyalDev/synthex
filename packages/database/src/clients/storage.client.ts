import { PrismaClient } from "../generated";

let client: PrismaClient | null = null;

export function getStorageDbClient() {
  if (!client) {
    client = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : ["error"],
    });
  }
  return client;
}

export function getStorageRepository(prisma: PrismaClient) {
  return {
    projectFile: prisma.projectFile,
    projectSnapshot: prisma.projectSnapshot,
  };
}