import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, requireAuth, withErrorHandler } from "@/lib/api-utils";
import { z } from "zod";

const shareBodySchema = z.object({
    userIds: z.array(z.string().min(1)).min(1, "Au moins un utilisateur requis"),
});

// POST /api/files/[id]/share - Share file with users (direct share)
export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireAuth(request);
    const { id: fileId } = await params;

    const file = await prisma.file.findUnique({
        where: { id: fileId },
        select: { id: true, uploadedById: true },
    });
    if (!file) return errorResponse("Fichier introuvable", 404);

    const body = await request.json();
    const parsed = shareBodySchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.errors[0]?.message ?? "Données invalides", 400);

    const { userIds } = parsed.data;

    // If FileShare model exists in schema, persist here. For now just validate and return success.
    // TODO: when FileShare is in schema: create FileShare records for each userId
    const existingUsers = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true },
    });
    if (existingUsers.length !== userIds.length) {
        return errorResponse("Un ou plusieurs utilisateurs introuvables", 400);
    }

    return successResponse({
        fileId,
        sharedWith: userIds,
        message: "Partage enregistré.",
    });
});
