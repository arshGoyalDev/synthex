// Prisma 7 Configuration
// This file configures the connection URL for Prisma Migrate
// The actual database connection is passed to PrismaClient in src/index.ts

export default {
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/code_ide?schema=public',
  },
};
