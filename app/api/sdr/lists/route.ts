import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============================================
// GET /api/sdr/lists
// Fetch active lists available for SDR action views
// ============================================

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const missionId = searchParams.get("missionId");

        // Fetch lists from active mission window (same scope as mission dropdown)
        const lists = await prisma.list.findMany({
            where: {
                isActive: true,
                mission: {
                    isActive: true,
                    startDate: { lte: new Date() },
                    endDate: { gte: new Date() },
                    ...(missionId ? { id: missionId } : {}),
                },
            },
            include: {
                mission: {
                    select: {
                        id: true,
                        name: true,
                        channel: true,
                        client: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        companies: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        if (lists.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
            });
        }

        const listIds = lists.map((list) => list.id);

        const [statusRows, contactedRows] = await Promise.all([
            prisma.$queryRaw<Array<{ listId: string; status: string; count: bigint }>>`
                SELECT
                    co."listId" AS "listId",
                    c.status::text AS status,
                    COUNT(*)::bigint AS count
                FROM "Contact" c
                INNER JOIN "Company" co ON c."companyId" = co.id
                WHERE co."listId" IN (${Prisma.join(listIds)})
                GROUP BY co."listId", c.status
            `,
            prisma.$queryRaw<Array<{ listId: string; count: bigint }>>`
                SELECT
                    co."listId" AS "listId",
                    COUNT(DISTINCT c.id)::bigint AS count
                FROM "Contact" c
                INNER JOIN "Company" co ON c."companyId" = co.id
                WHERE co."listId" IN (${Prisma.join(listIds)})
                  AND EXISTS (
                    SELECT 1
                    FROM "Action" a
                    WHERE a."contactId" = c.id
                  )
                GROUP BY co."listId"
            `,
        ]);

        const completenessByList = new Map<
            string,
            { total: number; actionable: number; partial: number; incomplete: number }
        >();
        for (const row of statusRows) {
            const entry = completenessByList.get(row.listId) ?? {
                total: 0,
                actionable: 0,
                partial: 0,
                incomplete: 0,
            };
            const count = Number(row.count);
            entry.total += count;
            if (row.status === "ACTIONABLE") entry.actionable += count;
            else if (row.status === "PARTIAL") entry.partial += count;
            else if (row.status === "INCOMPLETE") entry.incomplete += count;
            completenessByList.set(row.listId, entry);
        }

        const contactedByList = new Map(contactedRows.map((row) => [row.listId, Number(row.count)]));

        const listsWithStats = lists.map((list) => {
            const stats = completenessByList.get(list.id) ?? {
                total: 0,
                actionable: 0,
                partial: 0,
                incomplete: 0,
            };
            const contactedCount = contactedByList.get(list.id) ?? 0;

            return {
                id: list.id,
                name: list.name,
                type: list.type,
                source: list.source,
                mission: list.mission,
                companiesCount: list._count.companies,
                contactsCount: stats.total,
                contactedCount,
                completeness: {
                    actionable: stats.actionable,
                    partial: stats.partial,
                    incomplete: stats.incomplete,
                },
                progress: stats.total > 0
                    ? Math.round((contactedCount / stats.total) * 100)
                    : 0,
                createdAt: list.createdAt,
            };
        });

        return NextResponse.json({
            success: true,
            data: listsWithStats,
        });
    } catch (error) {
        console.error("Error fetching SDR lists:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
