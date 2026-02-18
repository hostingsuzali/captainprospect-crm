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

// ============================================
// POST /api/planning/copy-week - Copy schedule from one week to another
// ============================================

const copyWeekSchema = z.object({
    sourceStartDate: z.string().min(1, 'Date source requise'),
    targetStartDate: z.string().min(1, 'Date cible requise'),
    sdrIds: z.array(z.string()).optional(), // If not provided, copy all
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['MANAGER'], request);
    const data = await validateRequest(request, copyWeekSchema);

    const sourceStart = new Date(data.sourceStartDate);
    const targetStart = new Date(data.targetStartDate);

    // Calculate end of source week (7 days)
    const sourceEnd = new Date(sourceStart);
    sourceEnd.setDate(sourceEnd.getDate() + 7);

    // Build where clause
    const where: Record<string, unknown> = {
        date: {
            gte: sourceStart,
            lt: sourceEnd,
        },
        status: { not: 'CANCELLED' },
    };

    if (data.sdrIds && data.sdrIds.length > 0) {
        where.sdrId = { in: data.sdrIds };
    }

    // Get source blocks
    const sourceBlocks = await prisma.scheduleBlock.findMany({ where });

    if (sourceBlocks.length === 0) {
        return errorResponse('Aucun bloc à copier dans la semaine source', 400);
    }

    // Calculate day offset
    const dayOffset = Math.floor((targetStart.getTime() - sourceStart.getTime()) / (24 * 60 * 60 * 1000));

    // Create new blocks
    const createdBlocks = [];
    const errors = [];

    for (const block of sourceBlocks) {
        const blockDate = new Date(block.date);
        const newDate = new Date(blockDate);
        newDate.setDate(newDate.getDate() + dayOffset);

        // Check for existing block at target
        const existing = await prisma.scheduleBlock.findFirst({
            where: {
                sdrId: block.sdrId,
                date: newDate,
                startTime: block.startTime,
                status: { not: 'CANCELLED' },
            },
        });

        if (existing) {
            errors.push({
                sdrId: block.sdrId,
                date: newDate.toISOString(),
                reason: 'Bloc déjà existant',
            });
            continue;
        }

        // Check for overlaps
        const overlapping = await prisma.scheduleBlock.findFirst({
            where: {
                sdrId: block.sdrId,
                date: newDate,
                status: { not: 'CANCELLED' },
                OR: [
                    {
                        startTime: { lte: block.startTime },
                        endTime: { gt: block.startTime },
                    },
                    {
                        startTime: { lt: block.endTime },
                        endTime: { gte: block.endTime },
                    },
                ],
            },
        });

        if (overlapping) {
            errors.push({
                sdrId: block.sdrId,
                date: newDate.toISOString(),
                reason: 'Chevauchement détecté',
            });
            continue;
        }

        try {
            const newBlock = await prisma.scheduleBlock.create({
                data: {
                    sdrId: block.sdrId,
                    missionId: block.missionId,
                    date: newDate,
                    startTime: block.startTime,
                    endTime: block.endTime,
                    notes: block.notes,
                    createdById: session.user.id,
                },
            });
            createdBlocks.push(newBlock);
        } catch (err) {
            errors.push({
                sdrId: block.sdrId,
                date: newDate.toISOString(),
                reason: 'Erreur de création',
            });
        }
    }

    return successResponse({
        created: createdBlocks.length,
        errors: errors.length,
        errorDetails: errors,
    });
});
