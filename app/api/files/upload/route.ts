import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { storageService } from '@/lib/storage/storage-service';
import {
    successResponse,
    errorResponse,
    requireAuth,
    withErrorHandler,
} from '@/lib/api-utils';

// ============================================
// POST /api/files/upload - Upload file
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireAuth(request);

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const folderId = formData.get('folderId') as string | null;
        const missionId = formData.get('missionId') as string | null;
        const clientId = formData.get('clientId') as string | null;
        const campaignId = formData.get('campaignId') as string | null;
        const description = formData.get('description') as string | null;
        const tags = formData.get('tags') as string | null;

        if (!file) {
            return errorResponse('Aucun fichier fourni', 400);
        }

        // Validate file size (max 100MB)
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (!storageService.isAllowedSize(file.size, maxSize)) {
            return errorResponse('Fichier trop volumineux (max 100MB)', 400);
        }

        // Validate file type (optional - can add restrictions)
        const allowedTypes = [
            'image/*',
            'video/*',
            'audio/*',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/*',
        ];

        if (!storageService.isAllowedType(file.type, allowedTypes)) {
            return errorResponse('Type de fichier non autorisé', 400);
        }

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Determine folder based on context
        let folder = 'general';
        if (missionId) folder = 'missions';
        else if (clientId) folder = 'clients';
        else if (campaignId) folder = 'campaigns';

        // Upload to storage
        const { key, url } = await storageService.upload(
            buffer,
            {
                filename: file.name,
                mimeType: file.type,
                size: file.size,
                folder,
            },
            session.user.id
        );

        // Save metadata to database
        const fileRecord = await prisma.file.create({
            data: {
                name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
                originalName: file.name,
                mimeType: file.type,
                size: file.size,
                path: key,
                url,
                uploadedById: session.user.id,
                folderId: folderId || undefined,
                missionId: missionId || undefined,
                clientId: clientId || undefined,
                campaignId: campaignId || undefined,
                description: description || undefined,
                tags: tags ? JSON.parse(tags) : [],
            },
            include: {
                uploadedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return successResponse(fileRecord, 201);
    } catch (error) {
        console.error('Upload error:', error);
        return errorResponse('Erreur lors du téléchargement du fichier', 500);
    }
});


