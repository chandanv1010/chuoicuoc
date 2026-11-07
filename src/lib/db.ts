import { PrismaClient } from "@prisma/client";

// Giu mot PrismaClient duy nhat khi dev (hot reload tao lai module lien tuc).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
