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
// SCHEMAS
// ============================================

const channelEnum = z.enum(['CALL', 'EMAIL', 'LINKEDIN']);
const updateMissionSchema = z
    .object({
        clientId: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        objective: z.string().min(1).optional(),
        channel: channelEnum.optional(),
        channels: z.array(channelEnum).min(1).optional(),
        startDate: z.string().transform((s) => new Date(s)).optional(),
        endDate: z.string().transform((s) => new Date(s)).optional(),
        isActive: z.boolean().optional(),
        teamLeadSdrId: z.string().nullable().optional(),
        defaultInterlocuteurId: z.string().nullable().optional(),
        // Allow empty string from UI but normalize to null later
        defaultMailboxId: z.string().optional().or(z.literal('')),
    })
    .partial()
    .transform((data) => {
        const base = data.channels !== undefined ? { ...data, channel: data.channels[0] } : data;
        // Normalize empty string to null so we can safely disconnect the relation
        if (base.defaultMailboxId === '') {
            return { ...base, defaultMailboxId: null };
        }
        return base;
    });

const assignSdrSchema = z.object({
    sdrId: z.string().min(1, 'SDR ID requis'),
});

// ============================================
// GET /api/missions/[id] - Get mission details
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(['MANAGER', 'CLIENT', 'SDR', 'BUSINESS_DEVELOPER', 'BOOKER'], request);
    const { id } = await params;

    const mission = await prisma.mission.findUnique({
        where: { id },
        include: {
            client: {
                include: {
                    interlocuteurs: {
                        where: { isActive: true },
                        orderBy: { createdAt: 'asc' },
                    },
                },
            },
            campaigns: true,
            lists: {
                include: {
                    // List has no "contacts" relation; only "companies". Contact count is per company below.
                    _count: { select: { companies: true } },
                    companies: {
                        select: {
                            status: true,
                            _count: { select: { contacts: true } },
                        },
                    },
                    commercialInterlocuteur: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            title: true,
                        },
                    },
                },
            },
            defaultInterlocuteur: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    title: true,
                },
            },
            sdrAssignments: {
                include: {
                    sdr: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            selectedListId: true,
                            selectedMissionId: true,
                        },
                    },
                },
            },
            teamLeadSdr: { select: { id: true, name: true, email: true } },
            // Include default mailbox so SDR flows can use mission-level mailbox
            defaultMailbox: { select: { id: true, email: true, displayName: true } },
            _count: {
                select: {
                    sdrAssignments: true,
                    campaigns: true,
                    lists: true,
                },
            },
        },
    });

    if (!mission) {
        throw new NotFoundError('Mission introuvable');
    }

    // Access control
    if (session.user.role === 'CLIENT') {
        const hasAccess = await prisma.user.findFirst({
            where: { id: session.user.id, clientId: mission.clientId },
        });
        if (!hasAccess) {
            return errorResponse('Accès non autorisé', 403);
        }
    }

    if (session.user.role === 'SDR' || session.user.role === 'BUSINESS_DEVELOPER') {
        const isAssigned = mission.sdrAssignments.some(
            (a: { sdrId: string }) => a.sdrId === session.user.id
        );
        if (!isAssigned) {
            return errorResponse('Accès non autorisé', 403);
        }
    }

    // Get stats
    const stats = await prisma.action.aggregate({
        where: {
            campaign: { missionId: id },
        },
        _count: true,
    });

    const meetings = await prisma.action.count({
        where: {
            campaign: { missionId: id },
            result: 'MEETING_BOOKED',
        },
    });

    const opportunities = await prisma.opportunity.count({
        where: {
            contact: {
                company: {
                    list: { missionId: id },
                },
            },
        },
    });

    return successResponse({
        ...mission,
        stats: {
            totalActions: stats._count,
            meetingsBooked: meetings,
            opportunities,
        },
    });
});

// ============================================
// PUT /api/missions/[id] - Update mission
// ============================================

export const PUT = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER', 'BOOKER'], request);
    const { id } = await params;
    const data = await validateRequest(request, updateMissionSchema);

    // If setting teamLeadSdrId, ensure they are assigned to this mission
    if (data.teamLeadSdrId !== undefined) {
        if (data.teamLeadSdrId) {
            const assigned = await prisma.sDRAssignment.findUnique({
                where: { missionId_sdrId: { missionId: id, sdrId: data.teamLeadSdrId } },
            });
            if (!assigned) {
                return errorResponse('Le responsable d\'équipe doit être assigné à la mission', 400);
            }
        }
    }

    // Build Prisma update data: relations (client, teamLeadSdr, defaultMailbox) and array (channels) use special syntax
    const {
        clientId,
        teamLeadSdrId,
        channels,
        defaultMailboxId,
        defaultInterlocuteurId,
        ...scalars
    } = data;
    const updateData: Parameters<typeof prisma.mission.update>[0]['data'] = {
        ...scalars,
        ...(channels !== undefined && { channels: { set: channels } }),
        ...(clientId !== undefined && { client: { connect: { id: clientId } } }),
        ...(teamLeadSdrId !== undefined && {
            teamLeadSdr: teamLeadSdrId ? { connect: { id: teamLeadSdrId } } : { disconnect: true },
        }),
        ...(defaultMailboxId !== undefined && {
            defaultMailbox: defaultMailboxId ? { connect: { id: defaultMailboxId } } : { disconnect: true },
        }),
        ...(defaultInterlocuteurId !== undefined && {
            defaultInterlocuteur: defaultInterlocuteurId
                ? { connect: { id: defaultInterlocuteurId } }
                : { disconnect: true },
        }),
    };

    const mission = await prisma.mission.update({
        where: { id },
        data: updateData,
        include: {
            client: { select: { id: true, name: true } },
            teamLeadSdr: { select: { id: true, name: true, email: true } },
        },
    });

    return successResponse(mission);
});

// ============================================
// DELETE /api/missions/[id] - Delete mission
// ============================================

export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;

    await prisma.mission.delete({
        where: { id },
    });

    return successResponse({ deleted: true });
});

// ============================================
// POST /api/missions/[id]/assign - Assign SDR
// ============================================

export const PATCH = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER', 'BOOKER'], request);
    const { id } = await params;
    const { sdrId } = await validateRequest(request, assignSdrSchema);

    // Verify user exists and has SDR or BUSINESS_DEVELOPER role
    const sdr = await prisma.user.findFirst({
        where: { id: sdrId, role: { in: ['SDR', 'BUSINESS_DEVELOPER', 'BOOKER'] } },
    });

    if (!sdr) {
        return errorResponse('SDR ou Business Developer introuvable', 404);
    }

    // Check if already assigned
    const existing = await prisma.sDRAssignment.findUnique({
        where: { missionId_sdrId: { missionId: id, sdrId } },
    });

    if (existing) {
        return errorResponse('SDR déjà assigné à cette mission', 400);
    }

    const assignment = await prisma.sDRAssignment.create({
        data: { missionId: id, sdrId },
        include: {
            sdr: { select: { id: true, name: true } },
            mission: { select: { id: true, name: true } },
        },
    });

    return successResponse(assignment, 201);
});
