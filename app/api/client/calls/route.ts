import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, successResponse, withErrorHandler } from "@/lib/api-utils";

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);
    const clientId = (session.user as { clientId?: string | null }).clientId;

    if (!clientId) {
        return successResponse([]);
    }

    const calls = await prisma.action.findMany({
        where: {
            channel: "CALL",
            campaign: {
                mission: {
                    clientId,
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
            id: true,
            createdAt: true,
            callbackDate: true,
            result: true,
            note: true,
            duration: true,
            company: {
                select: {
                    id: true,
                    name: true,
                    industry: true,
                    country: true,
                },
            },
            contact: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    title: true,
                    email: true,
                    phone: true,
                    company: {
                        select: {
                            id: true,
                            name: true,
                            industry: true,
                            country: true,
                        },
                    },
                },
            },
            campaign: {
                select: {
                    id: true,
                    name: true,
                    mission: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
    });

    return successResponse(calls);
});

