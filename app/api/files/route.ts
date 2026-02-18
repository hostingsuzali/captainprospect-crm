import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { storageService } from '@/lib/storage/storage-service';
import {
    successResponse,
    errorResponse,
    requireAuth,
    requireRole,
    withErrorHandler,
    getPaginationParams,
} from '@/lib/api-utils';

// ============================================
// GET /api/files - List files
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);

    const folderId = searchParams.get('folderId');
    const missionId = searchParams.get('missionId');
    const clientId = searchParams.get('clientId');
    const campaignId = searchParams.get('campaignId');
    const search = searchParams.get('search');
    const type = searchParams.get('type'); // 'image', 'video', 'document', etc.

    const where: any = {
        deletedAt: null, // Only show non-deleted files
    };

    if (folderId) {
        where.folderId = folderId;
    }

    if (missionId) {
        where.missionId = missionId;
    }

    if (clientId) {
        where.clientId = clientId;
    }

    if (campaignId) {
        where.campaignId = campaignId;
    }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { originalName: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { tags: { hasSome: [search] } },
        ];
    }

    if (type) {
        const typeMap: Record<string, string[]> = {
            image: ['image/'],
            video: ['video/'],
            audio: ['audio/'],
            document: ['application/pdf', 'application/msword', 'application/vnd.'],
            text: ['text/'],
        };

        if (typeMap[type]) {
            where.mimeType = {
                startsWith: typeMap[type][0],
            };
        }
    }

    const [files, total] = await Promise.all([
        prisma.file.findMany({
            where,
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
                mission: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                client: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.file.count({ where }),
    ]);

    // Add formatted size to each file
    const filesWithFormattedSize = files.map(file => ({
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
