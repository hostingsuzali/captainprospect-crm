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
// DELETE /api/clients/[id] - Delete client
// ============================================

export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;

    // Check if client has missions
    const client = await prisma.client.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    missions: true,
                },
            },
        },
    });

    if (!client) {
        throw new NotFoundError('Client introuvable');
    }

    if (client._count.missions > 0) {
        return errorResponse(
            'Impossible de supprimer ce client car il a des missions associées. Supprimez d\'abord les missions.',
            400
        );
    }

    await prisma.client.delete({
        where: { id },
    });

    return successResponse({ deleted: true });
});
