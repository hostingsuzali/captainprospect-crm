import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
} from '@/lib/api-utils';

// Lightweight endpoint: returns only client bookingUrl + active interlocuteurs
// Used by the SDR drawer to avoid loading the full mission payload
export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'CLIENT', 'SDR', 'BUSINESS_DEVELOPER'], request);
    const { id } = await params;

    const mission = await prisma.mission.findUnique({
        where: { id },
        select: {
            id: true,
            client: {
                select: {
                    bookingUrl: true,
                    interlocuteurs: {
                        where: { isActive: true },
                        orderBy: { createdAt: 'asc' },
                    },
                },
            },
        },
    });

    if (!mission) {
        throw new NotFoundError('Mission introuvable');
    }

    return successResponse({
        bookingUrl: mission.client?.bookingUrl || null,
        interlocuteurs: mission.client?.interlocuteurs || [],
    });
});
