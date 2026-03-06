import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    NotFoundError,
} from '@/lib/api-utils';
import {
    MEETING_CANCELLATION_REASON_CODES,
    type MeetingCancellationReasonCode,
} from '@/lib/constants/meetingCancellationReasons';
import { z } from 'zod';

// ============================================
// PATCH /api/actions/[id] - Update callback date (reschedule rappel) or meeting (result + note + cancellationReason + callbackDate)
// ============================================

const meetingResults = ['MEETING_BOOKED', 'MEETING_CANCELLED'] as const;

const updateCallbackSchema = z.object({
    callbackDate: z.union([z.string(), z.date()]).optional().transform((s) => (s ? (typeof s === 'string' ? new Date(s) : s) : undefined)),
    note: z.string().max(2000).optional(),
    result: z.string().optional(),
    cancellationReason: z
        .string()
        .refine((v) => MEETING_CANCELLATION_REASON_CODES.includes(v as MeetingCancellationReasonCode))
        .optional(),
    meetingType: z.enum(['VISIO', 'PHYSIQUE', 'TELEPHONIQUE']).optional(),
    meetingAddress: z.string().max(500).optional().nullable(),
    meetingJoinUrl: z.string().url('Lien de rejoindre invalide').max(2000).optional().nullable(),
    meetingPhone: z.string().max(50).optional().nullable(),
}).refine(
    (data) => {
        if (!data.meetingType) return true;
        if (data.meetingType === 'VISIO') return !!data.meetingJoinUrl?.trim();
        if (data.meetingType === 'PHYSIQUE') return !!data.meetingAddress?.trim();
        return true;
    },
    { message: 'VISIO requiert un lien de rejoindre ; PHYSIQUE requiert une adresse.', path: ['meetingType'] }
);

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
    const isVoipPendingValidation = (action as { actionStatus?: string }).actionStatus === 'PENDING_VALIDATION';

    if (!isMeetingAction && !isCallbackAction && !isVoipPendingValidation) {
        return errorResponse('Seules les actions type rappel ou rendez-vous peuvent être modifiées', 400);
    }

    // VoIP: validate call result + note
    if (isVoipPendingValidation && data.result !== undefined) {
        const { statusConfigService } = await import('@/lib/services/StatusConfigService');
        const allowedCodes = await statusConfigService.getAllowedResultCodes({ campaignId: action.campaignId });
        if (!allowedCodes.includes(data.result)) {
            return errorResponse('Résultat non autorisé pour cette campagne', 400);
        }
        const updated = await prisma.action.update({
            where: { id },
            data: {
                result: data.result as any,
                note: data.note ?? action.note,
                actionStatus: null,
            },
            include: {
                contact: { select: { id: true, firstName: true, lastName: true, company: { select: { name: true } } } },
                company: { select: { id: true, name: true } },
                campaign: { select: { id: true, name: true, mission: { select: { id: true, name: true } } } },
            },
        });
        return successResponse(updated);
    }

    // Meeting: result + note + cancellationReason (when cancelling) + callbackDate (reschedule); Callback: callbackDate + note
    if (isMeetingAction && data.result !== undefined && !meetingResults.includes(data.result as any)) {
        return errorResponse('Statut RDV invalide', 400);
    }
    if (
        data.cancellationReason !== undefined &&
        !MEETING_CANCELLATION_REASON_CODES.includes(data.cancellationReason as MeetingCancellationReasonCode)
    ) {
        return errorResponse('Raison d\'annulation invalide', 400);
    }

    // Access: SDR, BD, Manager can all modify any meeting (remove, reschedule, cancel, absent)
    // No restriction by ownership - everyone has full access to meeting actions

    const updateData: {
        callbackDate?: Date;
        note?: string;
        result?: (typeof meetingResults)[number];
        cancellationReason?: string | null;
        meetingType?: string | null;
        meetingAddress?: string | null;
        meetingJoinUrl?: string | null;
        meetingPhone?: string | null;
    } = {};
    if (data.callbackDate !== undefined) updateData.callbackDate = data.callbackDate;
    if (data.note !== undefined) updateData.note = data.note;
    if (isMeetingAction && data.result !== undefined) updateData.result = data.result as (typeof meetingResults)[number];
    if (isMeetingAction && data.cancellationReason !== undefined) updateData.cancellationReason = data.cancellationReason;
    if (isMeetingAction && data.meetingType !== undefined) updateData.meetingType = data.meetingType;
    if (isMeetingAction && data.meetingAddress !== undefined) updateData.meetingAddress = data.meetingAddress;
    if (isMeetingAction && data.meetingJoinUrl !== undefined) updateData.meetingJoinUrl = data.meetingJoinUrl;
    if (isMeetingAction && data.meetingPhone !== undefined) updateData.meetingPhone = data.meetingPhone;

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

// ============================================
// DELETE /api/actions/[id] - Delete meeting action (MEETING_BOOKED or MEETING_CANCELLED only)
// ============================================

const MEETING_RESULTS_FOR_DELETE = ['MEETING_BOOKED', 'MEETING_CANCELLED'] as const;

export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(['SDR', 'BUSINESS_DEVELOPER', 'MANAGER'], request);
    const { id } = await params;

    const action = await prisma.action.findUnique({
        where: { id },
        include: {
            campaign: { select: { missionId: true } },
        },
    });

    if (!action) {
        throw new NotFoundError('Action introuvable');
    }

    if (!MEETING_RESULTS_FOR_DELETE.includes(action.result as any)) {
        return errorResponse('Seuls les rendez-vous (confirmés ou annulés) peuvent être supprimés', 400);
    }

    // Access: SDR, BD, Manager can all delete any meeting
    // No restriction by ownership

    await prisma.action.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
});
