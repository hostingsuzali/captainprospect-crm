import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
    AuthError,
} from '@/lib/api-utils';

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(['CLIENT'], request);
    const { id: actionId } = await params;

    const action = await prisma.action.findUnique({
        where: { id: actionId },
        include: {
            campaign: {
                include: {
                    mission: {
                        include: { client: { include: { users: { select: { id: true } } } } },
                    },
                },
            },
        },
    });

    if (!action) throw new NotFoundError('Action not found');

    if (action.confirmationStatus !== 'CONFIRMED') {
        throw new AuthError("Ce rendez-vous n'est pas encore confirmé", 403);
    }

    const clientUserIds = action.campaign.mission.client.users.map((u) => u.id);
    if (!clientUserIds.includes(session.user.id)) {
        throw new AuthError('Not authorized to access feedback for this meeting', 403);
    }

    const feedback = await prisma.meetingFeedback.findUnique({
        where: { actionId },
    });

    return successResponse(feedback);
});

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(['CLIENT'], request);
    const { id: actionId } = await params;
    const body = await request.json();

    const { outcome, recontactRequested, clientNote } = body;

    if (!outcome || !recontactRequested) {
        throw new NotFoundError('outcome and recontactRequested are required');
    }

    const validOutcomes = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NO_SHOW'];
    const validRecontact = ['YES', 'NO', 'MAYBE'];

    if (!validOutcomes.includes(outcome)) {
        throw new NotFoundError('Invalid outcome value');
    }
    if (!validRecontact.includes(recontactRequested)) {
        throw new NotFoundError('Invalid recontactRequested value');
    }

    const action = await prisma.action.findUnique({
        where: { id: actionId },
        include: {
            campaign: {
                include: {
                    mission: {
                        include: { client: { include: { users: { select: { id: true } } } } },
                    },
                },
            },
        },
    });

    if (!action) throw new NotFoundError('Action not found');

    if (action.confirmationStatus !== 'CONFIRMED') {
        throw new AuthError("Ce rendez-vous n'est pas encore confirmé", 403);
    }

    const clientUserIds = action.campaign.mission.client.users.map((u) => u.id);
    if (!clientUserIds.includes(session.user.id)) {
        throw new AuthError('Not authorized to provide feedback for this meeting');
    }

    const existing = await prisma.meetingFeedback.findUnique({ where: { actionId } });
    if (existing) {
        throw new AuthError('Feedback already submitted for this meeting');
    }

    const feedback = await prisma.meetingFeedback.create({
        data: {
            actionId,
            outcome,
            recontactRequested,
            clientNote: clientNote || null,
        },
    });

    return successResponse(feedback);
});
