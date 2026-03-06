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
import { recomputeConflicts } from '@/lib/planning/conflictEngine';
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
    // Hide REJECTED suggestions from view
    where.AND = [
        {
            OR: [
                { suggestionStatus: null },
                { suggestionStatus: 'SUGGESTED' },
                { suggestionStatus: 'CONFIRMED' },
            ],
        },
    ];

    const blocks = await prisma.scheduleBlock.findMany({
        where,
        include: {
            sdr: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                },
            },
            mission: {
                select: {
                    id: true,
                    name: true,
                    channel: true,
                    startDate: true,
                    endDate: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            missionPlan: {
                select: {
                    id: true,
                    status: true,
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

    // Only return blocks whose date is within the mission's startDate/endDate
    const missionStart = (m: { startDate: Date } | null) => (m?.startDate ? new Date(m.startDate).getTime() : -Infinity);
    const missionEnd = (m: { endDate: Date } | null) => (m?.endDate ? new Date(m.endDate).getTime() : Infinity);
    const blockDateMs = (b: { date: Date }) => new Date(b.date).setHours(0, 0, 0, 0);
    const filtered = blocks.filter((b) => {
        const m = b.mission as { startDate?: Date; endDate?: Date } | null;
        if (!m) return true;
        const start = missionStart(m);
        const end = missionEnd(m);
        const d = blockDateMs(b);
        return d >= start && d <= end;
    });

    return successResponse(filtered);
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

    // Overlapping blocks are allowed: managers can place the same SDR on multiple missions
    // on the same day/time, and the conflict engine will surface the conflict instead.

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

    // Pre-start validation: block date must be within mission startDate/endDate
    const mission = await prisma.mission.findUnique({
        where: { id: data.missionId },
        select: { startDate: true, endDate: true },
    });

    if (mission) {
        const missionStart = new Date(mission.startDate);
        missionStart.setHours(0, 0, 0, 0);
        const missionEnd = new Date(mission.endDate);
        missionEnd.setHours(23, 59, 59, 999);
        if (blockDate < missionStart || blockDate > missionEnd) {
            return errorResponse(
                'La date du bloc doit être comprise entre le début et la fin de la mission',
                400
            );
        }
    }

    // Create block (manual = CONFIRMED, no mission plan)
    const block = await prisma.scheduleBlock.create({
        data: {
            sdrId: data.sdrId,
            missionId: data.missionId,
            date: blockDate,
            startTime: data.startTime,
            endTime: data.endTime,
            notes: data.notes,
            suggestionStatus: 'CONFIRMED',
            missionPlanId: null,
            allocationId: (data as Record<string, unknown>).allocationId as string | undefined ?? null,
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
                    channel: true,
                    client: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
            missionPlan: { select: { id: true, status: true } },
            createdBy: {
                select: {
                    name: true,
                },
            },
        },
    });

    // Sync scheduledDays counter on the allocation if linked
    if (block.allocationId) {
        await prisma.sdrDayAllocation.update({
            where: { id: block.allocationId },
            data: { scheduledDays: { increment: 1 } },
        });
        // Recompute conflicts for this SDR+month
        const alloc = await prisma.sdrDayAllocation.findUnique({
            where: { id: block.allocationId },
            include: { missionMonthPlan: true },
        });
        if (alloc) {
            await recomputeConflicts({
                sdrId: block.sdrId,
                missionId: alloc.missionMonthPlan.missionId,
                month: alloc.missionMonthPlan.month,
            });
        }
    }

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
