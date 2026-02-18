import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    paginatedResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    getPaginationParams,
} from '@/lib/api-utils';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createMissionSchema = z.object({
    clientId: z.string().min(1, 'Client requis'),
    name: z.string().min(1, 'Nom requis'),
    objective: z.string().min(1, 'Objectif requis'),
    channel: z.enum(['CALL', 'EMAIL', 'LINKEDIN']),
    startDate: z.string().transform((s) => new Date(s)),
    endDate: z.string().transform((s) => new Date(s)),
    isActive: z.boolean().optional().default(true),
});

const updateMissionSchema = createMissionSchema.partial();

// ============================================
// GET /api/missions - List all missions
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['MANAGER', 'CLIENT', 'SDR', 'BUSINESS_DEVELOPER'], request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);

    // Filters
    const clientId = searchParams.get('clientId');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    // Role-based filtering
    if (session.user.role === 'CLIENT') {
        where.client = { users: { some: { id: session.user.id } } };
    } else if (session.user.role === 'SDR' || session.user.role === 'BUSINESS_DEVELOPER') {
        // SDR and BD see missions they're assigned to
        where.sdrAssignments = { some: { sdrId: session.user.id } };
    }

    if (clientId) where.clientId = clientId;
    if (isActive !== null) where.isActive = isActive === 'true';
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { objective: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [missions, total] = await Promise.all([
        prisma.mission.findMany({
            where,
            include: {
                client: { select: { id: true, name: true } },
                campaigns: { select: { id: true, name: true, isActive: true } },
                lists: { select: { id: true, name: true, type: true } },
                sdrAssignments: {
                    include: { sdr: { select: { id: true, name: true } } },
                },
                _count: {
                    select: {
                        campaigns: true,
                        lists: true,
                        sdrAssignments: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.mission.count({ where }),
    ]);

    return paginatedResponse(missions, total, page, limit);
});

// ============================================
// POST /api/missions - Create new mission
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);
    const data = await validateRequest(request, createMissionSchema);

    // Verify client exists
    const client = await prisma.client.findUnique({
        where: { id: data.clientId },
    });

    if (!client) {
        return errorResponse('Client introuvable', 404);
    }

    const mission = await prisma.mission.create({
        data,
        include: {
            client: { select: { id: true, name: true } },
        },
    });

    return successResponse(mission, 201);
});
