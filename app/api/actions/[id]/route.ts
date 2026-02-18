import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    NotFoundError,
} from '@/lib/api-utils';
import { z } from 'zod';

// ============================================
// PATCH /api/actions/[id] - Update callback date (reschedule rappel) or meeting (result + note)
// ============================================

const meetingResults = ['MEETING_BOOKED', 'MEETING_CANCELLED'] as const;

const updateCallbackSchema = z.object({
    callbackDate: z.union([z.string(), z.date()]).optional().transform((s) => (s ? (typeof s === 'string' ? new Date(s) : s) : undefined)),
    note: z.string().max(2000).optional(),
    result: z.enum(meetingResults).optional(),
});

export const PATCH = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(['SDR', 'BUSINESS_DEVELOPER', 'MANAGER'], request);
    const { id } = await params;
    const data = await validateRequest(request, updateCallbackSchema);

    const action = await prisma.action.findUnique({
        where: { id },
        include: {
            campaign: { select: { missionId: true } },
        },
    });

    if (!action) {
        throw new NotFoundError('Action introuvable');
    }

    const isMeetingAction = action.result === 'MEETING_BOOKED' || action.result === 'MEETING_CANCELLED';
    const isCallbackAction = action.result === 'CALLBACK_REQUESTED';

    if (!isMeetingAction && !isCallbackAction) {
        return errorResponse('Seules les actions type rappel ou rendez-vous peuvent être modifiées', 400);
    }

    // Meeting: only result + note; Callback: callbackDate + note
    if (isMeetingAction && data.result !== undefined && !meetingResults.includes(data.result as any)) {
        return errorResponse('Statut RDV invalide', 400);
    }

    // Access: SDR own actions; BD actions on assigned missions; Manager any
    if (session.user.role === 'SDR') {
        if (action.sdrId !== session.user.id) {
            return errorResponse('Non autorisé', 403);
        }
    } else if (session.user.role === 'BUSINESS_DEVELOPER') {
        const assigned = await prisma.sDRAssignment.findFirst({
            where: { missionId: action.campaign.missionId, sdrId: session.user.id },
        });
        if (!assigned) {
            return errorResponse('Non autorisé', 403);
        }
    }

    const updateData: { callbackDate?: Date; note?: string; result?: typeof meetingResults[number] } = {};
    if (data.callbackDate !== undefined) updateData.callbackDate = data.callbackDate;
    if (data.note !== undefined) updateData.note = data.note;
    if (isMeetingAction && data.result !== undefined) updateData.result = data.result as typeof meetingResults[number];

    if (Object.keys(updateData).length === 0) {
        return errorResponse('Aucune donnée à mettre à jour', 400);
    }

    const updated = await prisma.action.update({
        where: { id },
        data: updateData,
        include: {
            contact: { select: { id: true, firstName: true, lastName: true, company: { select: { name: true } } } },
            company: { select: { id: true, name: true } },
            campaign: { select: { id: true, name: true, mission: { select: { id: true, name: true } } } },
        },
    });

    return successResponse(updated);
});
