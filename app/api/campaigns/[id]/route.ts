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

const updateCampaignSchema = z.object({
    name: z.string().min(1).optional(),
    icp: z.string().min(1).optional(),
    pitch: z.string().min(1).optional(),
    script: z.object({
        intro: z.string().optional(),
        discovery: z.string().optional(),
        objection: z.string().optional(),
        closing: z.string().optional(),
    }).optional(),
    isActive: z.boolean().optional(),
});

// ============================================
// GET /api/campaigns/[id] - Get campaign details
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'CLIENT', 'SDR', 'BUSINESS_DEVELOPER'], request);
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
        where: { id },
        include: {
            mission: {
                include: {
                    client: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    actions: true,
                },
            },
        },
    });

    if (!campaign) {
        throw new NotFoundError('Campagne introuvable');
    }

    // Get stats
    const actions = await prisma.action.findMany({
        where: { campaignId: id },
    });

    const stats = {
        totalActions: actions.length,
        meetings: actions.filter(a => a.result === 'MEETING_BOOKED').length,
        interested: actions.filter(a => a.result === 'INTERESTED').length,
        notInterested: actions.filter(a => a.result === 'DISQUALIFIED').length,
        noAnswer: actions.filter(a => a.result === 'NO_RESPONSE').length,
        conversionRate: actions.length > 0
            ? (actions.filter(a => a.result === 'MEETING_BOOKED').length / actions.length) * 100
            : 0,
    };

    return successResponse({
        ...campaign,
        stats,
    });
});

// ============================================
// PUT /api/campaigns/[id] - Update campaign
// ============================================

export const PUT = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);
    const { id } = await params;
    const data = await validateRequest(request, updateCampaignSchema);

    const campaign = await prisma.campaign.update({
        where: { id },
        data: {
            ...data,
            script: data.script ? JSON.stringify(data.script) : undefined,
        },
        include: {
            mission: {
                select: {
                    id: true,
                    name: true,
                    channel: true,
                },
            },
        },
    });

    return successResponse(campaign);
});

// ============================================
// DELETE /api/campaigns/[id] - Delete campaign
// ============================================

export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);
    const { id } = await params;

    await prisma.campaign.delete({
        where: { id },
    });

    return successResponse({ deleted: true });
});
