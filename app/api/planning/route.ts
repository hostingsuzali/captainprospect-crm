import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { createScheduleAssignmentNotification } from '@/lib/notifications';
import { z } from 'zod';

// ============================================
// GET /api/planning - Get schedule blocks
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sdrId = searchParams.get('sdrId');
    const missionId = searchParams.get('missionId');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (startDate && endDate) {
        where.date = {
            gte: new Date(startDate),
            lte: new Date(endDate),
        };
    } else if (startDate) {
        where.date = { gte: new Date(startDate) };
    } else if (endDate) {
        where.date = { lte: new Date(endDate) };
    }

    if (sdrId) where.sdrId = sdrId;
    if (missionId) where.missionId = missionId;

    const blocks = await prisma.scheduleBlock.findMany({
        where,
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
        orderBy: [
            { date: 'asc' },
            { startTime: 'asc' },
        ],
    });

    return successResponse(blocks);
});

// ============================================
// POST /api/planning - Create schedule block
// ============================================

const createBlockSchema = z.object({
    sdrId: z.string().min(1, 'SDR requis'),
    missionId: z.string().min(1, 'Mission requise'),
    date: z.string().min(1, 'Date requise'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:mm requis'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:mm requis'),
    notes: z.string().optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['MANAGER'], request);
    const data = await validateRequest(request, createBlockSchema);

    // Validate time range
    if (data.startTime >= data.endTime) {
        return errorResponse('L\'heure de début doit être avant l\'heure de fin', 400);
    }

    // Parse date in local timezone to prevent day shifting
    // Input format: "YYYY-MM-DD"
    const [year, month, day] = data.date.split('-').map(Number);
    const blockDate = new Date(year, month - 1, day, 0, 0, 0, 0);

    // Check for overlapping blocks
    const overlapping = await prisma.scheduleBlock.findFirst({
        where: {
            sdrId: data.sdrId,
            date: blockDate,
            status: { not: 'CANCELLED' },
            OR: [
                // New block starts during existing block
                {
                    startTime: { lte: data.startTime },
                    endTime: { gt: data.startTime },
                },
                // New block ends during existing block
                {
                    startTime: { lt: data.endTime },
                    endTime: { gte: data.endTime },
                },
                // New block encompasses existing block
                {
                    startTime: { gte: data.startTime },
                    endTime: { lte: data.endTime },
                },
            ],
        },
    });

    if (overlapping) {
        return errorResponse('Ce créneau chevauche un bloc existant', 409);
    }

    // Verify SDR is assigned to mission
    const assignment = await prisma.sDRAssignment.findFirst({
        where: {
            sdrId: data.sdrId,
            missionId: data.missionId,
        },
    });

    if (!assignment) {
        return errorResponse('Le SDR n\'est pas assigné à cette mission', 400);
    }

    // Create block
    const block = await prisma.scheduleBlock.create({
        data: {
            sdrId: data.sdrId,
            missionId: data.missionId,
            date: blockDate,
            startTime: data.startTime,
            endTime: data.endTime,
            notes: data.notes,
            createdById: session.user.id,
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

    // Send notification to the assigned user
    await createScheduleAssignmentNotification({
        userId: block.sdr.id,
        userRole: block.sdr.role,
        missionName: block.mission.name,
        clientName: block.mission.client.name,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        managerName: block.createdBy.name,
    });

    return successResponse(block, 201);
});
