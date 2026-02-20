import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
} from '@/lib/api-utils';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export const PATCH = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;

    const block = await prisma.scheduleBlock.findUnique({
        where: { id },
    });

    if (!block) {
        throw new NotFoundError('Créneau introuvable');
    }

    if (block.suggestionStatus !== 'SUGGESTED') {
        return errorResponse('Ce créneau n\'est pas une suggestion', 400);
    }

    const overlappingSuggested = await prisma.scheduleBlock.findMany({
        where: {
            id: { not: id },
            sdrId: block.sdrId,
            date: block.date,
            suggestionStatus: 'SUGGESTED',
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
                {
                    startTime: { gte: block.startTime },
                    endTime: { lte: block.endTime },
                },
            ],
        },
    });

    await prisma.$transaction([
        prisma.scheduleBlock.update({
            where: { id },
            data: { suggestionStatus: 'CONFIRMED' },
        }),
        ...overlappingSuggested.map((b) =>
            prisma.scheduleBlock.update({
                where: { id: b.id },
                data: { suggestionStatus: 'REJECTED' },
            })
        ),
    ]);

    return successResponse({ message: 'Créneau confirmé' });
});
