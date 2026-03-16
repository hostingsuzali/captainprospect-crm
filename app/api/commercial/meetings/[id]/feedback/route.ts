import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
    AuthError,
    ValidationError,
} from '@/lib/api-utils';

// Helper: verify a COMMERCIAL user has access to the action (via their client's missions)
async function verifyCommercialAccessToAction(actionId: string, interlocuteurId: string) {
    const interlocuteur = await prisma.clientInterlocuteur.findUnique({
        where: { id: interlocuteurId },
        select: { clientId: true },
    });

    if (!interlocuteur) throw new AuthError('Interlocuteur introuvable', 403);

    const action = await prisma.action.findUnique({
        where: { id: actionId },
        include: {
            campaign: {
                include: { mission: { select: { clientId: true } } },
            },
        },
    });

    if (!action) throw new NotFoundError('Rendez-vous introuvable');
    if (action.campaign.mission.clientId !== interlocuteur.clientId) {
        throw new AuthError('Accès non autorisé', 403);
    }

    return action;
}

// ============================================
// GET /api/commercial/meetings/[id]/feedback
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(['COMMERCIAL'], request);
    const { id: actionId } = await params;

    const interlocuteurId = session.user.interlocuteurId;
    if (!interlocuteurId) throw new AuthError('Profil commercial introuvable', 403);

    await verifyCommercialAccessToAction(actionId, interlocuteurId);

    const feedback = await prisma.meetingFeedback.findUnique({ where: { actionId } });
    return successResponse(feedback);
});

// ============================================
// POST /api/commercial/meetings/[id]/feedback
// ============================================

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(['COMMERCIAL'], request);
    const { id: actionId } = await params;

    const interlocuteurId = session.user.interlocuteurId;
    if (!interlocuteurId) throw new AuthError('Profil commercial introuvable', 403);

    const body = await request.json();
    const { outcome, recontactRequested, clientNote } = body;

    if (!outcome || !recontactRequested) {
        throw new ValidationError('outcome et recontactRequested sont requis');
    }

    const validOutcomes = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NO_SHOW'];
    const validRecontact = ['YES', 'NO', 'MAYBE'];

    if (!validOutcomes.includes(outcome)) {
        throw new ValidationError('Valeur outcome invalide');
    }
    if (!validRecontact.includes(recontactRequested)) {
        throw new ValidationError('Valeur recontactRequested invalide');
    }

    const action = await verifyCommercialAccessToAction(actionId, interlocuteurId);

    if (action.confirmationStatus !== 'CONFIRMED') {
        throw new AuthError("Ce rendez-vous n'est pas encore confirmé", 403);
    }

    const existing = await prisma.meetingFeedback.findUnique({ where: { actionId } });
    if (existing) {
        throw new AuthError('Un feedback a déjà été soumis pour ce rendez-vous');
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

// ============================================
// PATCH /api/commercial/meetings/[id]/feedback
// Update existing feedback
// ============================================

export const PATCH = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(['COMMERCIAL'], request);
    const { id: actionId } = await params;

    const interlocuteurId = session.user.interlocuteurId;
    if (!interlocuteurId) throw new AuthError('Profil commercial introuvable', 403);

    await verifyCommercialAccessToAction(actionId, interlocuteurId);

    const body = await request.json();
    const { outcome, recontactRequested, clientNote } = body;

    const validOutcomes = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NO_SHOW'];
    const validRecontact = ['YES', 'NO', 'MAYBE'];

    if (outcome && !validOutcomes.includes(outcome)) {
        throw new ValidationError('Valeur outcome invalide');
    }
    if (recontactRequested && !validRecontact.includes(recontactRequested)) {
        throw new ValidationError('Valeur recontactRequested invalide');
    }

    const existing = await prisma.meetingFeedback.findUnique({ where: { actionId } });
    if (!existing) {
        throw new NotFoundError('Aucun feedback trouvé pour ce rendez-vous');
    }

    const updated = await prisma.meetingFeedback.update({
        where: { actionId },
        data: {
            ...(outcome && { outcome }),
            ...(recontactRequested && { recontactRequested }),
            ...(clientNote !== undefined && { clientNote: clientNote || null }),
        },
    });

    return successResponse(updated);
});
