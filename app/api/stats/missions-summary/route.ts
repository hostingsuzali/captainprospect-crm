import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';

// ============================================
// GET /api/stats/missions-summary
// Returns active missions with actionsThisWeek, meetingsThisWeek, lastActionAt for dashboard
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);

    let dateFrom: Date;
    if (startDateParam && endDateParam) {
        dateFrom = new Date(startDateParam);
        dateFrom.setHours(0, 0, 0, 0);
    } else {
        dateFrom = new Date();
        dateFrom.setHours(0, 0, 0, 0);
        switch (period) {
            case 'today':
                break;
            case 'week':
                dateFrom.setDate(dateFrom.getDate() - 7);
                break;
            case 'month':
                dateFrom.setMonth(dateFrom.getMonth() - 1);
                break;
            case 'quarter':
                dateFrom.setDate(dateFrom.getDate() - 90);
                break;
            default:
                dateFrom.setMonth(dateFrom.getMonth() - 1);
        }
    }

    const [missions, actionsInPeriod] = await Promise.all([
        prisma.mission.findMany({
            where: { isActive: true },
            take: limit,
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                name: true,
                isActive: true,
                client: { select: { id: true, name: true } },
                _count: { select: { sdrAssignments: true } },
            },
        }),
        prisma.action.findMany({
            where: {
                createdAt: {
                    gte: dateFrom,
                    ...(endDateParam ? { lte: new Date(new Date(endDateParam).setHours(23, 59, 59, 999)) } : {}),
                },
            },
            select: {
                result: true,
                createdAt: true,
                campaign: { select: { missionId: true } },
            },
        }),
    ]);

    const missionIds = new Set(missions.map((m) => m.id));
    const byMission: Record<
        string,
        { actionsCount: number; meetingsCount: number; lastActionAt: Date | null }
    > = {};
    for (const m of missions) {
        byMission[m.id] = { actionsCount: 0, meetingsCount: 0, lastActionAt: null };
    }
    for (const a of actionsInPeriod) {
        const missionId = a.campaign?.missionId;
        if (!missionId || !missionIds.has(missionId)) continue;
        const row = byMission[missionId];
        if (!row) continue;
        row.actionsCount += 1;
        if (a.result === 'MEETING_BOOKED') row.meetingsCount += 1;
        if (!row.lastActionAt || a.createdAt > row.lastActionAt) {
            row.lastActionAt = a.createdAt;
        }
    }

    const data = missions.map((m) => ({
        id: m.id,
        name: m.name,
        isActive: m.isActive,
        client: m.client,
        sdrCount: m._count.sdrAssignments,
        actionsThisPeriod: byMission[m.id]?.actionsCount ?? 0,
        meetingsThisPeriod: byMission[m.id]?.meetingsCount ?? 0,
        lastActionAt: byMission[m.id]?.lastActionAt?.toISOString() ?? null,
    }));

    return successResponse({ missions: data, period });
});
