import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
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

const createClientSchema = z.object({
    name: z.string().min(1, 'Nom requis'),
    email: z.string().email('Email invalide').optional().nullable(),
    phone: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    logo: z.string().url('URL logo invalide').optional().nullable(),
    // Onboarding data
    onboardingData: z.object({
        icp: z.string().optional(),
        targetIndustries: z.array(z.string()).optional(),
        targetCompanySize: z.string().optional(),
        targetJobTitles: z.array(z.string()).optional(),
        targetGeographies: z.array(z.string()).optional(),
        listingSources: z.array(z.string()).optional(),
        listingCriteria: z.string().optional(),
        estimatedContacts: z.string().optional(),
        aiAnalysis: z.any().optional(),
    }).optional(),
    targetLaunchDate: z.string().optional().nullable(),
    scripts: z.object({
        intro: z.string().optional(),
        discovery: z.string().optional(),
        objection: z.string().optional(),
        closing: z.string().optional(),
    }).optional(),
    notes: z.string().optional().nullable(),
    // Mission creation
    createMission: z.boolean().optional(),
    missionName: z.string().optional().nullable(),
    missionObjective: z.string().optional().nullable(),
    missionChannel: z.enum(['CALL', 'EMAIL', 'LINKEDIN']).optional(),
});

// ============================================
// GET /api/clients - List all clients
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['MANAGER', 'CLIENT'], request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);

    const where: Record<string, unknown> = {};

    // Clients can only see their own company
    if (session.user.role === 'CLIENT') {
        where.users = { some: { id: session.user.id } };
    }

    const search = searchParams.get('search');
    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
    }

    const [clients, total] = await Promise.all([
        prisma.client.findMany({
            where,
            include: {
                _count: {
                    select: {
                        missions: true,
                        users: true,
                    },
                },
                missions: {
                    where: { isActive: true },
                    select: { id: true, name: true },
                    take: 5,
                },
            },
            orderBy: { name: 'asc' },
            skip,
            take: limit,
        }),
        prisma.client.count({ where }),
    ]);

    return paginatedResponse(clients, total, page, limit);
});

// ============================================
// POST /api/clients - Create new client with onboarding
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['MANAGER'], request);
    const data = await validateRequest(request, createClientSchema);

    // Extract onboarding fields
    const {
        name,
        email,
        phone,
        industry,
        logo,
        onboardingData,
        targetLaunchDate,
        scripts,
        notes,
        createMission,
        missionName,
        missionObjective,
        missionChannel,
    } = data;

    // Create client
    const client = await prisma.client.create({
        data: {
            name,
            email: email || undefined,
            phone: phone || undefined,
            industry: industry || undefined,
            logo: logo || undefined,
        },
    });

    // Create onboarding record if onboarding data is provided
    const hasOnboardingData = onboardingData || scripts || notes || targetLaunchDate;

    if (hasOnboardingData) {
        await prisma.clientOnboarding.create({
            data: {
                clientId: client.id,
                status: 'IN_PROGRESS',
                onboardingData: onboardingData || {},
                scripts: scripts || {},
                notes: notes || undefined,
                targetLaunchDate: targetLaunchDate ? new Date(targetLaunchDate) : undefined,
                createdById: session.user.id,
            },
        });
    }

    // Create mission if requested
    if (createMission && missionName) {
        const mission = await prisma.mission.create({
            data: {
                clientId: client.id,
                name: missionName,
                objective: missionObjective || `Mission pour ${name}`,
                channel: missionChannel || 'CALL',
                startDate: targetLaunchDate ? new Date(targetLaunchDate) : new Date(),
                endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
                isActive: false, // Will be activated later
            },
        });

        // Create initial campaign if we have scripts/ICP
        if (scripts?.intro || onboardingData?.icp) {
            await prisma.campaign.create({
                data: {
                    missionId: mission.id,
                    name: `Campagne ${name}`,
                    icp: onboardingData?.icp || 'ICP à définir',
                    pitch: onboardingData?.icp || 'Pitch à définir',
                    script: scripts ? JSON.stringify(scripts) : undefined,
                    isActive: false,
                },
            });
        }
    }

    // Return client with onboarding info
    const clientWithOnboarding = await prisma.client.findUnique({
        where: { id: client.id },
        include: {
            onboarding: true,
            _count: {
                select: {
                    missions: true,
                    users: true,
                },
            },
        },
    });

    return successResponse(clientWithOnboarding, 201);
});
