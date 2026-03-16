import { PrismaClient } from "../generated";

let client: PrismaClient | null = null;

export function getUserDbClient() {
  if (!client) {
    client = new PrismaClient({
      log: process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    });
  }
  return client;
}

export function getUserRepository(prisma: PrismaClient) {
  return {
    user: prisma.user,
    oAuthAccount: prisma.oAuthAccount,
  };
}