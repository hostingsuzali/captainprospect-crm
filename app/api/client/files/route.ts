import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { storageService } from "@/lib/storage/storage-service";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    AuthError,
    getPaginationParams,
} from "@/lib/api-utils";

// ============================================
// GET /api/client/files - List files for logged-in client
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);

    const clientId = (session.user as { clientId?: string })?.clientId;
    if (!clientId) {
        throw new AuthError("Accès non autorisé", 403);
    }

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);

    const [files, total] = await Promise.all([
        prisma.file.findMany({
            where: {
                clientId,
                deletedAt: null,
            },
            include: {
                uploadedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                folder: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.file.count({
            where: {
                clientId,
                deletedAt: null,
            },
        }),
    ]);

    const filesWithFormattedSize = files.map((file) => ({
        ...file,
        formattedSize: storageService.formatSize(file.size),
    }));

    return successResponse({
        files: filesWithFormattedSize,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
        },
    });
});
