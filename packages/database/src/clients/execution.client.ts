import { PrismaClient } from "../generated";

let client: PrismaClient | null = null;

export function getExecutionDbClient() {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}

export function getExecutionRepository(prisma: PrismaClient) {
  return {
    executionLog: prisma.executionLog,
    containerLog: prisma.containerLog,
  };
}