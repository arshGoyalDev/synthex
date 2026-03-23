import { PrismaClient } from "../generated";

let client: PrismaClient | null = null;

export function getContainerDbClient() {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}

export function getContainerRepository(prisma: PrismaClient) {
  return {
    containerLog: prisma.containerLog,
  };
}