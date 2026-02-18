import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    getPaginationParams,
} from '@/lib/api-utils';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createCampaignSchema = z.object({
    name: z.string().min(1, 'Nom requis'),
    missionId: z.string().min(1, 'Mission requise'),
    icp: z.string().min(1, 'ICP requis'),
    pitch: z.string().min(1, 'Pitch requis'),
    script: z.object({
        intro: z.string().min(1, 'Introduction requise'),
        discovery: z.string().optional(),
        objection: z.string().optional(),
        closing: z.string().optional(),
    }).optional(),
});

// ============================================
// GET /api/campaigns - List campaigns
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER', 'CLIENT', 'BUSINESS_DEVELOPER', 'SDR'], request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);

    const missionId = searchParams.get('missionId');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');

    const where: any = {};

    if (missionId) {
        where.missionId = missionId;
    }

    if (isActive !== null) {
        where.isActive = isActive === 'true';
    }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { icp: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [campaigns, total] = await Promise.all([
        prisma.campaign.findMany({
            where,
            include: {
                mission: {
                    select: {
                        id: true,
                        name: true,
                        channel: true,
                        client: {
                            select: {
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
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.campaign.count({ where }),
    ]);

    return successResponse(campaigns);
});

// ============================================
// POST /api/campaigns - Create campaign
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);
    const data = await validateRequest(request, createCampaignSchema);

    // Verify mission exists
    const mission = await prisma.mission.findUnique({
        where: { id: data.missionId },
    });

    if (!mission) {
        return errorResponse('Mission non trouvée', 404);
    }

    const campaign = await prisma.campaign.create({
        data: {
            name: data.name,
            missionId: data.missionId,
            icp: data.icp,
            pitch: data.pitch,
            script: data.script ? JSON.stringify(data.script) : null,
            isActive: true,
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

    return successResponse(campaign, 201);
});
