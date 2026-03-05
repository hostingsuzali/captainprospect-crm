import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, successResponse, withErrorHandler } from "@/lib/api-utils";

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);
    const clientId = session.user.clientId;

    if (!clientId) {
        return successResponse({
            portalShowCallHistory: false,
            portalShowDatabase: false,
        });
    }

    const client = await prisma.client.findUnique({
        where: { id: clientId },
    });

    if (!client) {
        return successResponse({
            portalShowCallHistory: false,
            portalShowDatabase: false,
        });
    }

    // Prisma client currently doesn't expose portal-specific flags on Client in the generated types,
    // so we return safe defaults here to avoid runtime errors.
    return successResponse({
        portalShowCallHistory: false,
        portalShowDatabase: false,
    });
});

