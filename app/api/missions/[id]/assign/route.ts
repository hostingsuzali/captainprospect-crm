import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// ============================================
// PATCH /api/missions/[id]/assign - Assign SDR to mission
// ============================================

const assignSchema = z.object({
    sdrId: z.string().min(1, 'SDR requis'),
});

export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);
    const { id } = await params;
    const data = await validateRequest(request, assignSchema);

    // Check if mission exists
    const mission = await prisma.mission.findUnique({
        where: { id },
    });

    if (!mission) {
        return errorResponse('Mission non trouvée', 404);
    }

    // Check if SDR exists
    const sdr = await prisma.user.findUnique({
        where: { id: data.sdrId },
    });

    if (!sdr) {
        return errorResponse('SDR non trouvé', 404);
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.sDRAssignment.findFirst({
        where: {
            missionId: id,
            sdrId: data.sdrId,
        },
    });

    if (existingAssignment) {
        return errorResponse('Ce SDR est déjà assigné à cette mission', 400);
    }

    // Create assignment
    const assignment = await prisma.sDRAssignment.create({
        data: {
            missionId: id,
            sdrId: data.sdrId,
        },
        include: {
            sdr: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    return successResponse(assignment, 201);
});

// ============================================
// DELETE /api/missions/[id]/assign - Remove SDR from mission
// ============================================

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sdrId = searchParams.get('sdrId');

    if (!sdrId) {
        return errorResponse('SDR ID requis', 400);
    }

    const assignment = await prisma.sDRAssignment.findFirst({
        where: {
            missionId: id,
            sdrId,
        },
    });

    if (!assignment) {
        return errorResponse('Assignation non trouvée', 404);
    }

    await prisma.$transaction([
        prisma.sDRAssignment.delete({
            where: { id: assignment.id },
        }),
        // Clear team lead if the removed user was the team lead
        prisma.mission.updateMany({
            where: { id, teamLeadSdrId: sdrId },
            data: { teamLeadSdrId: null },
        }),
    ]);

    return successResponse({ message: 'SDR retiré de la mission' });
});
