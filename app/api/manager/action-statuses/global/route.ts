import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { z } from "zod";

const putBodySchema = z.object({
    statuses: z.array(
        z.object({
            code: z.string(),
            resultCategoryCode: z.string().nullable().optional(),
            label: z.string().min(1).optional().nullable(),
            color: z.string().optional().nullable(),
            sortOrder: z.number().int().min(0).optional(),
        })
    ),
});

/**
 * GET /api/manager/action-statuses/global
 * List GLOBAL action status definitions (for status management UI).
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER", "BUSINESS_DEVELOPER"], request);

    const rows = await prisma.actionStatusDefinition.findMany({
        where: { scopeType: "GLOBAL", scopeId: "", isActive: true },
        orderBy: { sortOrder: "asc" },
    });

    return successResponse(
        rows.map((r) => ({
            id: r.id,
            code: r.code,
            label: r.label,
            color: r.color,
            sortOrder: r.sortOrder,
            requiresNote: r.requiresNote,
            priorityLabel: r.priorityLabel,
            priorityOrder: r.priorityOrder,
            triggersOpportunity: r.triggersOpportunity,
            triggersCallback: r.triggersCallback,
            resultCategoryCode: r.resultCategoryCode,
        }))
    );
});

/**
 * PUT /api/manager/action-statuses/global
 * Update GLOBAL action status definitions (resultCategoryCode, label, color, sortOrder only).
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER", "BUSINESS_DEVELOPER"], request);

    const body = await request.json();
    const parsed = putBodySchema.safeParse(body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Données invalides";
        return errorResponse(msg, 400);
    }
    const { statuses } = parsed.data;

    for (const s of statuses) {
        await prisma.actionStatusDefinition.updateMany({
            where: { scopeType: "GLOBAL", scopeId: "", code: s.code },
            data: {
                ...(s.resultCategoryCode !== undefined && { resultCategoryCode: s.resultCategoryCode }),
                ...(s.label !== undefined && { label: s.label }),
                ...(s.color !== undefined && { color: s.color }),
                ...(s.sortOrder !== undefined && { sortOrder: s.sortOrder }),
            },
        });
    }

    const updated = await prisma.actionStatusDefinition.findMany({
        where: { scopeType: "GLOBAL", scopeId: "" },
        orderBy: { sortOrder: "asc" },
    });

    return successResponse(
        updated.map((r) => ({
            id: r.id,
            code: r.code,
            label: r.label,
            color: r.color,
            sortOrder: r.sortOrder,
            resultCategoryCode: r.resultCategoryCode,
        }))
    );
});
