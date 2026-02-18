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

const updateClientSchema = z.object({
    name: z.string().min(1).optional(),
    industry: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    bookingUrl: z.string().url().optional().or(z.literal('')),
});

// ============================================
// GET /api/clients/[id] - Get client details
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'CLIENT'], request);
    const { id } = await params;

    const client = await prisma.client.findUnique({
        where: { id },
        include: {
            missions: {
                include: {
                    _count: {
                        select: {
                            campaigns: true,
                            lists: true,
                            sdrAssignments: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            },
            users: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            },
            _count: {
                select: {
                    missions: true,
                    users: true,
                },
            },
        },
    });

    if (!client) {
        throw new NotFoundError('Client introuvable');
    }

    return successResponse(client);
});

// ============================================
// PUT /api/clients/[id] - Update client
// ============================================

export const PUT = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;
    const data = await validateRequest(request, updateClientSchema);

    // Clean up empty strings
    const cleanData = {
        ...data,
        email: data.email || undefined,
        phone: data.phone || undefined,
        industry: data.industry || undefined,
        bookingUrl: data.bookingUrl || undefined,
    };

    const client = await prisma.client.update({
        where: { id },
        data: cleanData,
        include: {
            _count: {
                select: {
                    missions: true,
                    users: true,
                },
            },
        },
    });

    return successResponse(client);
});

// ============================================
// DELETE /api/clients/[id] - Delete client and all connected data
// ============================================

export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;

    const client = await prisma.client.findUnique({
        where: { id },
    });

    if (!client) {
        throw new NotFoundError('Client introuvable');
    }

    // Delete client and all connected data in a transaction.
    // Order: unlink/drop relations that don't cascade, then delete client (DB cascades the rest).
    await prisma.$transaction(async (tx) => {
        // Unlink users from this client (they keep their account, just lose client access)
        await tx.user.updateMany({
            where: { clientId: id },
            data: { clientId: null },
        });

        // Delete client-scoped files and folders
        await tx.file.deleteMany({ where: { clientId: id } });
        await tx.folder.deleteMany({ where: { clientId: id } });

        // Unlink optional client references
        await tx.project.updateMany({
            where: { clientId: id },
            data: { clientId: null },
        });
        await tx.emailThread.updateMany({
            where: { clientId: id },
            data: { clientId: null },
        });
        await tx.prospectSource.updateMany({
            where: { clientId: id },
            data: { clientId: null },
        });
        await tx.prospectRule.updateMany({
            where: { clientId: id },
            data: { clientId: null },
        });

        // Remove client-specific pipeline config (1:1)
        await tx.prospectPipelineConfig.deleteMany({ where: { clientId: id } });

        // Campaign is cascade-deleted with Mission when Client is deleted; Action/File/EmailThread
        // reference Campaign without onDelete, so we must clear them first.
        const clientCampaignIds = await tx.campaign.findMany({
            where: { mission: { clientId: id } },
            select: { id: true },
        }).then(rows => rows.map(r => r.id));

        if (clientCampaignIds.length > 0) {
            await tx.action.deleteMany({
                where: { campaignId: { in: clientCampaignIds } },
            });
            await tx.file.updateMany({
                where: { campaignId: { in: clientCampaignIds } },
                data: { campaignId: null },
            });
            await tx.emailThread.updateMany({
                where: { campaignId: { in: clientCampaignIds } },
                data: { campaignId: null },
            });
            await tx.emailSequence.updateMany({
                where: { campaignId: { in: clientCampaignIds } },
                data: { campaignId: null },
            });
        }

        // Delete client; DB/Prisma cascades: Mission (and its Campaign, List, etc.),
        // ClientOnboarding, BusinessDeveloperClient, CommsChannel
        await tx.client.delete({
            where: { id },
        });
    });

    return successResponse({ deleted: true });
});
