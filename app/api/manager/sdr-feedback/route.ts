import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    errorResponse,
    requireRole,
    successResponse,
    withErrorHandler,
} from "@/lib/api-utils";

const querySchema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    missionId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
});

function parseDateRange(from?: string, to?: string): { gte?: Date; lte?: Date } {
    const out: { gte?: Date; lte?: Date } = {};
    if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) {
            fromDate.setHours(0, 0, 0, 0);
            out.gte = fromDate;
        }
    }
    if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) {
            toDate.setHours(23, 59, 59, 999);
            out.lte = toDate;
        }
    }
    return out;
}

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
        missionId: searchParams.get("missionId") ?? undefined,
        limit: searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
        return errorResponse("Paramètres invalides", 400);
    }

    const range = parseDateRange(parsed.data.from, parsed.data.to);
    const submittedAtFilter = range.gte || range.lte ? { submittedAt: range } : {};
    const missionId = parsed.data.missionId?.trim();
    const missionFilter = missionId
        ? {
              OR: [
                  { missionId },
                  {
                      missions: {
                          some: {
                              missionId,
                          },
                      },
                  },
              ],
          }
        : {};
    const where = {
        ...submittedAtFilter,
        ...missionFilter,
    };

    const rows = await prisma.sdrDailyFeedback.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        take: parsed.data.limit,
        select: {
            id: true,
            score: true,
            review: true,
            objections: true,
            missionComment: true,
            pagePath: true,
            submittedAt: true,
            sdr: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            mission: {
                select: {
                    id: true,
                    name: true,
                },
            },
            missions: {
                select: {
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

    return successResponse(rows);
});
