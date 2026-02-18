import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
} from '@/lib/api-utils';

// ============================================
// GET /api/lists/[id] - Get list details
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'CLIENT', 'SDR'], request);
    const { id } = await params;

    const list = await prisma.list.findUnique({
        where: { id },
        include: {
            mission: {
                select: {
                    id: true,
                    name: true,
                    client: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    companies: true,
                },
            },
        },
    });

    if (!list) {
        throw new NotFoundError('Liste introuvable');
    }

    return successResponse(list);
});

// ============================================
// DELETE /api/lists/[id] - Delete list
// ============================================

export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;

    // Delete list (cascade will delete companies and contacts)
    await prisma.list.delete({
        where: { id },
    });

    return successResponse({ deleted: true });
});

// ============================================
// PATCH /api/lists/[id] - Update list
// ============================================

export const PATCH = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;
    const body = await request.json();

    const { name, type, source, missionId } = body;

    const updatedList = await prisma.list.update({
        where: { id },
        data: {
            ...(name && { name }),
            ...(type && { type }),
            ...(source !== undefined && { source }),
            ...(missionId && { missionId }),
        },
        include: {
            mission: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    return successResponse(updatedList);
});
