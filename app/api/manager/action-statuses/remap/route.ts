import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * GET /api/manager/action-statuses/remap
 * Returns action counts grouped by result code, so the manager can see
 * which statuses are in use and how many actions each has.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);

    // Get counts of actions per result code
    const counts = await prisma.action.groupBy({
        by: ["result"],
        _count: { id: true },
    });

    // Get all distinct result codes currently in use
    const resultCodes = counts.map((c) => ({
        code: c.result,
        count: c._count.id,
    }));

    // Also get all global status definitions for reference
    const globalStatuses = await prisma.actionStatusDefinition.findMany({
        where: { scopeType: "GLOBAL", scopeId: "" },
        orderBy: { sortOrder: "asc" },
        select: { code: true, label: true, isActive: true },
    });

    const definedCodes = new Set(globalStatuses.map((s) => s.code));

    // Identify orphan codes (in use but not defined in global config)
    const orphanCodes = resultCodes
        .filter((r) => !definedCodes.has(r.code))
        .map((r) => r.code);

    return successResponse({
        resultCodes: resultCodes.sort((a, b) => b.count - a.count),
        globalStatuses,
        orphanCodes,
        totalActions: counts.reduce((sum, c) => sum + c._count.id, 0),
    });
});

const remapSchema = z.object({
    mappings: z.array(
        z.object({
            fromCode: z.string().min(1),
            toCode: z.string().min(1),
        })
    ).min(1),
});

/**
 * POST /api/manager/action-statuses/remap
 * Bulk remap actions from one result code to another.
 * This updates all Action records matching the fromCode to the toCode.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);

    const body = await request.json();
    const parsed = remapSchema.safeParse(body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Données invalides";
        return errorResponse(msg, 400);
    }
    const { mappings } = parsed.data;

    // Validate that target codes exist as valid ActionResult enum values
    // We use raw SQL to handle the enum cast properly
    const results: Array<{ fromCode: string; toCode: string; updated: number }> = [];

    for (const { fromCode, toCode } of mappings) {
        if (fromCode === toCode) continue;

        try {
            const updated = await prisma.$executeRaw`
                UPDATE "Action"
                SET "result" = ${toCode}::"ActionResult",
                    "updatedAt" = NOW()
                WHERE "result" = ${fromCode}::"ActionResult"
            `;
            results.push({ fromCode, toCode, updated: Number(updated) });
        } catch (err) {
            // If the enum cast fails, return a clear error
            if (err instanceof Prisma.PrismaClientKnownRequestError || String(err).includes("invalid input value")) {
                return errorResponse(
                    `Code "${toCode}" n'est pas un ActionResult valide dans le schéma Prisma. Ajoutez-le d'abord au enum ActionResult.`,
                    400
                );
            }
            throw err;
        }
    }

    return successResponse({
        mappings: results,
        totalUpdated: results.reduce((sum, r) => sum + r.updated, 0),
    });
});
