import { PrismaClient } from "@prisma/client";
import { dbConfig } from "./config.js";

declare global {
  // Prevent multiple instances of Prisma Client in development during HMR
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: dbConfig.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (dbConfig.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

/**
 * Gracefully close database connection pool on shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
