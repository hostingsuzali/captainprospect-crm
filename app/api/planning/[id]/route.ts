import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { 
    createScheduleUpdateNotification, 
    createScheduleCancelNotification 
} from '@/lib/notifications';
import { z } from 'zod';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// ============================================
// GET /api/planning/[id] - Get schedule block
// ============================================

export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;

    const block = await prisma.scheduleBlock.findUnique({
        where: { id },
        include: {
            sdr: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            mission: {
                select: {
                    id: true,
                    name: true,
                    channel: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            createdBy: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    if (!block) {
        return errorResponse('Bloc non trouvé', 404);
    }

    return successResponse(block);
});

// ============================================
// PUT /api/planning/[id] - Update schedule block
// ============================================

const updateBlockSchema = z.object({
    missionId: z.string().optional(),
    date: z.string().optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    notes: z.string().optional().nullable(),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;
    const data = await validateRequest(request, updateBlockSchema);

    // Get existing block
    const existingBlock = await prisma.scheduleBlock.findUnique({
        where: { id },
    });

    if (!existingBlock) {
        return errorResponse('Bloc non trouvé', 404);
    }

    const newStartTime = data.startTime || existingBlock.startTime;
    const newEndTime = data.endTime || existingBlock.endTime;
    const newDate = data.date ? new Date(data.date) : existingBlock.date;

    // Validate time range
    if (newStartTime >= newEndTime) {
        return errorResponse('L\'heure de début doit être avant l\'heure de fin', 400);
    }

    // Check for overlapping blocks (excluding current block)
    if (data.startTime || data.endTime || data.date) {
        const overlapping = await prisma.scheduleBlock.findFirst({
            where: {
                id: { not: id },
                sdrId: existingBlock.sdrId,
                date: newDate,
                status: { not: 'CANCELLED' },
                OR: [
                    {
                        startTime: { lte: newStartTime },
                        endTime: { gt: newStartTime },
                    },
                    {
                        startTime: { lt: newEndTime },
                        endTime: { gte: newEndTime },
                    },
                    {
                        startTime: { gte: newStartTime },
                        endTime: { lte: newEndTime },
                    },
                ],
            },
        });

        if (overlapping) {
            return errorResponse('Ce créneau chevauche un bloc existant', 409);
        }
    }

    // Update block
    const block = await prisma.scheduleBlock.update({
        where: { id },
        data: {
            missionId: data.missionId,
            date: data.date ? newDate : undefined,
            startTime: data.startTime,
            endTime: data.endTime,
            notes: data.notes,
            status: data.status,
        },
        include: {
            sdr: {
                select: {
                    id: true,
                    name: true,
                    role: true,
                },
            },
            mission: {
                select: {
                    id: true,
                    name: true,
                    client: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
            createdBy: {
                select: {
                    name: true,
                },
            },
        },
    });

    // Send notification about the update (only if significant changes)
    if (data.date || data.startTime || data.endTime || data.missionId) {
        await createScheduleUpdateNotification({
            userId: block.sdr.id,
            userRole: block.sdr.role,
            missionName: block.mission.name,
            clientName: block.mission.client.name,
            date: block.date.toISOString(),
            startTime: block.startTime,
            endTime: block.endTime,
            managerName: block.createdBy.name,
        });
    }

    return successResponse(block);
});

// ============================================
// DELETE /api/planning/[id] - Delete schedule block
// ============================================

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;

    // Fetch block with related data before deleting
    const block = await prisma.scheduleBlock.findUnique({
        where: { id },
        include: {
            sdr: {
                select: {
                    id: true,
                    name: true,
                    role: true,
                },
            },
            mission: {
                select: {
                    name: true,
                    client: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        },
    });

    if (!block) {
        return errorResponse('Bloc non trouvé', 404);
    }

    // Send notification before deleting
    await createScheduleCancelNotification({
        userId: block.sdr.id,
        userRole: block.sdr.role,
        missionName: block.mission.name,
        clientName: block.mission.client.name,
        date: block.date.toISOString(),
        startTime: block.startTime,
        endTime: block.endTime,
    });

    await prisma.scheduleBlock.delete({
        where: { id },
    });

    return successResponse({ message: 'Bloc supprimé' });
});
