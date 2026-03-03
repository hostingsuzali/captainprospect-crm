import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
    prismaDirect: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

/** Uses DIRECT_URL (session mode) for operations requiring transactional consistency (e.g. CSV import).
 * Prevents P2003 FK violations when pooler transaction mode (6543) causes read-your-writes issues. */
export const prismaDirect = globalForPrisma.prismaDirect ?? new PrismaClient({
    datasources: process.env.DIRECT_URL
        ? { db: { url: process.env.DIRECT_URL } }
        : undefined,
});

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
    globalForPrisma.prismaDirect = prismaDirect;
}

export default prisma;
