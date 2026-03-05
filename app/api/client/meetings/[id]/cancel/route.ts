import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    withErrorHandler,
    requireRole,
    NotFoundError,
    AuthError,
    errorResponse,
} from "@/lib/api-utils";
import {
    MEETING_CANCELLATION_REASON_CODES,
    type MeetingCancellationReasonCode,
} from "@/lib/constants/meetingCancellationReasons";

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(["CLIENT"], request);
    const { id: actionId } = await params;

    const body = await request.json().catch(() => ({}));
    const { cancellationReason, note } = body as { cancellationReason?: string; note?: string | null };

    if (!cancellationReason || !MEETING_CANCELLATION_REASON_CODES.includes(cancellationReason as MeetingCancellationReasonCode)) {
        return errorResponse("cancellationReason invalide ou manquant", 400);
    }

    const action = await prisma.action.findUnique({
        where: { id: actionId },
        include: {
            campaign: {
                include: {
                    mission: {
                        include: {
                            client: {
                                include: { users: { select: { id: true } } },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!action) {
        throw new NotFoundError("Action introuvable");
    }

    if (action.result !== "MEETING_BOOKED") {
        return errorResponse("Ce rendez-vous est déjà annulé", 400);
    }

    const client = action.campaign.mission.client;
    if (!client) {
        throw new NotFoundError("Client introuvable pour ce rendez-vous");
    }

    const clientUserIds = client.users.map((u) => u.id);
    if (!clientUserIds.includes(session.user.id)) {
        throw new AuthError("Non autorisé à annuler ce rendez-vous", 403);
    }

    const updated = await prisma.action.update({
        where: { id: actionId },
        data: {
            result: "MEETING_CANCELLED",
            cancellationReason: cancellationReason,
            note: note && String(note).trim() ? (action.note ? `${action.note}\n${String(note).trim()}` : String(note).trim()) : action.note ?? undefined,
        },
        include: {
            contact: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    company: { select: { name: true } },
                },
            },
            campaign: {
                select: {
                    id: true,
                    name: true,
                    mission: { select: { id: true, name: true } },
                },
            },
        },
    });

    return successResponse(updated);
});
