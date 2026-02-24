import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';

// ============================================
// GET /api/stats - Dashboard statistics
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['MANAGER', 'SDR', 'CLIENT'], request);
    const { searchParams } = new URL(request.url);

    const missionId = searchParams.get('missionId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const period = searchParams.get('period') || 'month';

    let dateFrom: Date;
    let dateTo: Date;

    if (startDateParam && endDateParam) {
        dateFrom = new Date(startDateParam);
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(endDateParam);
        dateTo.setHours(23, 59, 59, 999);
    } else {
        dateTo = new Date();
        dateTo.setHours(23, 59, 59, 999);
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

    const actionWhere: Record<string, unknown> = {
        createdAt: { gte: dateFrom, lte: dateTo },
    };

    // Role-based filtering
    if (session.user.role === 'SDR') {
        actionWhere.sdrId = session.user.id;
    } else if (session.user.role === 'CLIENT') {
        actionWhere.campaign = {
            mission: {
                client: {
                    users: { some: { id: session.user.id } },
                },
            },
        };
    }

    if (missionId) {
        actionWhere.campaign = { missionId };
    }

    // Get stats
    const [
        totalActions,
        actionsByResult,
        meetingsBooked,
        opportunities,
        activeMissions,
        topSDRs,
    ] = await Promise.all([
        // Total actions
        prisma.action.count({ where: actionWhere }),

        // Actions by result
        prisma.action.groupBy({
            by: ['result'],
            where: actionWhere,
            _count: true,
        }),

        // Meetings booked
        prisma.action.count({
            where: { ...actionWhere, result: 'MEETING_BOOKED' },
        }),

        // Opportunities
        prisma.opportunity.count({
            where: {
                createdAt: { gte: dateFrom, lte: dateTo },
                ...(session.user.role === 'CLIENT' && {
                    contact: {
                        company: {
                            list: {
                                mission: {
                                    client: { users: { some: { id: session.user.id } } },
                                },
                            },
                        },
                    },
                }),
            },
        }),

        // Active missions count
        prisma.mission.count({
            where: {
                isActive: true,
                ...(session.user.role === 'CLIENT' && {
                    client: { users: { some: { id: session.user.id } } },
                }),
                ...(session.user.role === 'SDR' && {
                    sdrAssignments: { some: { sdrId: session.user.id } },
                }),
            },
        }),

        // Top SDRs by total actions (only for managers)
        session.user.role === 'MANAGER'
            ? prisma.action.groupBy({
                by: ['sdrId'],
                where: actionWhere,
                _count: true,
                orderBy: { _count: { sdrId: 'desc' } },
                take: 10,
            })
            : [],
    ]);

    // RDV leaderboard: rank SDRs by MEETING_BOOKED count (only for managers)
    let rdvBySdr: { sdrId: string; _count: number }[] = [];
    if (session.user.role === 'MANAGER') {
        rdvBySdr = await prisma.action.groupBy({
            by: ['sdrId'],
            where: { ...actionWhere, result: 'MEETING_BOOKED' },
            _count: true,
            orderBy: { _count: { sdrId: 'desc' } },
            take: 10,
        });
    }

    // Format results by type
    const resultBreakdown = {
        NO_RESPONSE: 0,
        BAD_CONTACT: 0,
        INTERESTED: 0,
        CALLBACK_REQUESTED: 0,
        MEETING_BOOKED: 0,
        DISQUALIFIED: 0,
    };

    actionsByResult.forEach((item) => {
        resultBreakdown[item.result] = item._count;
    });

    // Calculate conversion rate
    const conversionRate = totalActions > 0
        ? ((meetingsBooked / totalActions) * 100).toFixed(2)
        : '0.00';

    // Get SDR names for leaderboard
    let leaderboard: { id: string; name: string; actions: number }[] = [];
    let rdvLeaderboard: { id: string; name: string; rdv: number; actions: number }[] = [];
    const allSdrIds = [...new Set([...topSDRs.map((s) => s.sdrId), ...rdvBySdr.map((s) => s.sdrId)])];
    if (allSdrIds.length > 0) {
        const sdrs = await prisma.user.findMany({
            where: { id: { in: allSdrIds } },
            select: { id: true, name: true },
        });
        const nameMap = new Map(sdrs.map(u => [u.id, u.name]));
        const actionMap = new Map(topSDRs.map(s => [s.sdrId, s._count]));

        leaderboard = topSDRs.map((s) => ({
            id: s.sdrId,
            name: nameMap.get(s.sdrId) || 'Unknown',
            actions: s._count,
        }));

        rdvLeaderboard = rdvBySdr.map((s) => ({
            id: s.sdrId,
            name: nameMap.get(s.sdrId) || 'Unknown',
            rdv: s._count,
            actions: actionMap.get(s.sdrId) || 0,
        }));
    }

    // Client Portal extras: lastActivityDate, contactsReached, monthlyObjective
    let lastActivityDate: string | null = null;
    let contactsReached = 0;
    let monthlyObjective = 10;
    if (session.user.role === 'CLIENT') {
        const lastAction = await prisma.action.findFirst({
            where: actionWhere,
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });
        lastActivityDate = lastAction?.createdAt?.toISOString() ?? null;

        const distinctContacts = await prisma.action.findMany({
            where: { ...actionWhere, contactId: { not: null } },
            select: { contactId: true },
            distinct: ['contactId'],
        });
        contactsReached = distinctContacts.length;

        const mission = await prisma.mission.findFirst({
            where: {
                isActive: true,
                client: { users: { some: { id: session.user.id } } },
            },
            select: { objective: true },
        });
        const parsed = parseInt(mission?.objective ?? '', 10);
        if (!isNaN(parsed) && parsed > 0) monthlyObjective = parsed;
    }

    return successResponse({
        period,
        totalActions,
        meetingsBooked,
        opportunities,
        activeMissions,
        conversionRate: parseFloat(conversionRate),
        resultBreakdown,
        leaderboard,
        rdvLeaderboard,
        lastActivityDate,
        contactsReached,
        monthlyObjective,
    });
});
