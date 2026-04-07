import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    errorResponse,
    requireRole,
    successResponse,
    withErrorHandler,
} from "@/lib/api-utils";

const createFeedbackSchema = z.object({
    score: z.number().int().min(1).max(5),
    review: z.string().trim().min(3).max(4000),
    objections: z.string().trim().max(4000).optional().nullable(),
    missionComment: z.string().trim().max(4000).optional().nullable(),
    missionIds: z.array(z.string().trim().min(1)).min(1).max(20),
    pagePath: z.string().trim().max(255).optional().nullable(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["SDR"], request);
    const body = await request.json();
    const parsed = createFeedbackSchema.safeParse(body);

    if (!parsed.success) {
        return errorResponse("Données invalides", 400);
    }

    const data = parsed.data;
    const missionIds = Array.from(new Set(data.missionIds));

    const assignments = await prisma.sDRAssignment.findMany({
        where: {
            missionId: { in: missionIds },
            sdrId: session.user.id,
        },
        select: { missionId: true },
    });
    const assignedMissionIds = new Set(assignments.map((row) => row.missionId));
    const unauthorizedMission = missionIds.find((id) => !assignedMissionIds.has(id));
    if (unauthorizedMission) {
        return errorResponse("Mission non accessible", 403);
    }

    const created = await prisma.sdrDailyFeedback.create({
        data: {
            sdrId: session.user.id,
            missionId: missionIds[0] ?? null,
            score: data.score,
            review: data.review,
            objections: data.objections?.trim() || null,
            missionComment: data.missionComment?.trim() || null,
            pagePath: data.pagePath?.trim() || null,
            missions: {
                create: missionIds.map((missionId) => ({ missionId })),
            },
        },
        select: {
            id: true,
            submittedAt: true,
        },
    });

    return successResponse(created, 201);
});
