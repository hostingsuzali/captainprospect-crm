import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, successResponse, withErrorHandler } from "@/lib/api-utils";

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);
    const clientId = (session.user as { clientId?: string | null }).clientId;

    if (!clientId) {
        return successResponse({ items: [], total: 0 });
    }

    const where = {
        channel: "CALL" as const,
        campaign: {
            mission: {
                clientId,
            },
        },
    };

    const [calls, total] = await Promise.all([
        prisma.action.findMany({
            where,
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
        }),
        prisma.action.count({ where }),
    ]);

    return successResponse({ items: calls, total });
});

