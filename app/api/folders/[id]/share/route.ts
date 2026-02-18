import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, requireAuth, withErrorHandler } from "@/lib/api-utils";
import { z } from "zod";

const shareBodySchema = z.object({
    userIds: z.array(z.string().min(1)).min(1, "Au moins un utilisateur requis"),
});

// POST /api/folders/[id]/share - Share folder with users (direct share)
export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireAuth(request);
    const { id: folderId } = await params;

    const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        select: { id: true },
    });
    if (!folder) return errorResponse("Dossier introuvable", 404);

    const body = await request.json();
    const parsed = shareBodySchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.errors[0]?.message ?? "Données invalides", 400);

    const { userIds } = parsed.data;

    const existingUsers = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true },
    });
    if (existingUsers.length !== userIds.length) {
        return errorResponse("Un ou plusieurs utilisateurs introuvables", 400);
    }

    return successResponse({
        folderId,
        sharedWith: userIds,
        message: "Partage enregistré.",
    });
});
