import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

// ============================================
// PUT /api/users/[id]/status - Toggle user active status
// ============================================

const updateStatusSchema = z.object({
    isActive: z.boolean(),
});

export const PUT = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(['MANAGER'], request);
    const { id } = await params;
    const data = await validateRequest(request, updateStatusSchema);

    // Prevent self-deactivation
    if (session.user.id === id && !data.isActive) {
        return errorResponse('Vous ne pouvez pas vous désactiver vous-même', 400);
    }

    // Check user exists
    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, role: true },
    });

    if (!user) {
        return errorResponse('Utilisateur non trouvé', 404);
    }

    // Prevent deactivating other managers (optional security measure)
    if (user.role === 'MANAGER' && !data.isActive && session.user.id !== id) {
        return errorResponse('Vous ne pouvez pas désactiver un autre manager', 400);
    }

    // Update user status
    const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: data.isActive },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
        },
    });

    return successResponse({
        message: data.isActive ? 'Utilisateur activé' : 'Utilisateur désactivé',
        user: updatedUser,
    });
});
