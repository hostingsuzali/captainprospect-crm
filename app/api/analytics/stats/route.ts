import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';
import { ActionResult, Prisma } from '@prisma/client';

export const GET = withErrorHandler(async (request: NextRequest) => {
    // Only Managers and Developers can see full team stats
    const session = await requireRole(['MANAGER', 'DEVELOPER'], request);
    const { searchParams } = new URL(request.url);

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const sdrIds = searchParams.getAll('sdrIds[]');
    const missionIds = searchParams.getAll('missionIds[]');
    const clientIds = searchParams.getAll('clientIds[]');
    const listIds = searchParams.getAll('listIds[]');

    // Default timeframe: last 30 days
    const dateTo = to ? new Date(to) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    const dateFrom = from ? new Date(from) : new Date(dateTo);
    if (!from) {
        dateFrom.setDate(dateFrom.getDate() - 30);
    }
    dateFrom.setHours(0, 0, 0, 0);

    // Dynamic filters for calls
    const where: Prisma.ActionWhereInput = {
        channel: 'CALL',
        createdAt: {
            gte: dateFrom,
            lte: dateTo,
        },
    };

    if (sdrIds.length > 0) {
        where.sdrId = { in: sdrIds };
    }

    if (missionIds.length > 0 || clientIds.length > 0) {
        where.campaign = {
            mission: {
                ...(missionIds.length > 0 && { id: { in: missionIds } }),
                ...(clientIds.length > 0 && { clientId: { in: clientIds } }),
            }
        };
    }

    if (listIds.length > 0) {
        where.OR = [
            { company: { listId: { in: listIds } } },
            { contact: { company: { listId: { in: listIds } } } },
        ];
    }

    // Prepare SQL Fragments for filtering in raw queries
    const sdrFilterRaw = sdrIds.length > 0
        ? Prisma.sql`AND "sdrId" IN (${Prisma.join(sdrIds)})`
        : Prisma.empty;

    const sdrFilterAliasA = sdrIds.length > 0
        ? Prisma.sql`AND a."sdrId" IN (${Prisma.join(sdrIds)})`
        : Prisma.empty;

    const missionFilterAliasM = missionIds.length > 0
        ? Prisma.sql`AND m.id IN (${Prisma.join(missionIds)})`
        : Prisma.empty;

    const clientFilterAliasM = clientIds.length > 0
        ? Prisma.sql`AND m."clientId" IN (${Prisma.join(clientIds)})`
        : Prisma.empty;

    const listFilterRaw = listIds.length > 0
        ? Prisma.sql`AND (
            "companyId" IS NOT NULL AND "companyId" IN (SELECT id FROM "Company" WHERE "listId" IN (${Prisma.join(listIds)}))
            OR "contactId" IS NOT NULL AND "contactId" IN (SELECT c.id FROM "Contact" c JOIN "Company" co ON c."companyId" = co.id WHERE co."listId" IN (${Prisma.join(listIds)}))
        )`
        : Prisma.empty;

    const listFilterAliasA = listIds.length > 0
        ? Prisma.sql`AND (
            a."companyId" IS NOT NULL AND a."companyId" IN (SELECT id FROM "Company" WHERE "listId" IN (${Prisma.join(listIds)}))
            OR a."contactId" IS NOT NULL AND a."contactId" IN (SELECT c.id FROM "Contact" c JOIN "Company" co ON c."companyId" = co.id WHERE co."listId" IN (${Prisma.join(listIds)}))
        )`
        : Prisma.empty;

    // Heavy Lifting with Parallel Aggregations
    const [
        basicStats,
        statusBreakdown,
        dailyVolume,
        heatmapData,
        sdrPerformanceData,
        missionStatesData
    ] = await Promise.all([
        // 1. Basic KPIs
        prisma.action.aggregate({
            where,
            _count: { id: true, contactId: true },
            _sum: { duration: true },
        }),

        // 2. Status Distribution
        prisma.action.groupBy({
            by: ['result'],
            where,
            _count: { id: true },
        }),

        // 3. Daily Stats for the main chart
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                TO_CHAR("createdAt", 'YYYY-MM-DD') as date,
                COUNT(*)::int as calls,
                COUNT(CASE WHEN "result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings
            FROM "Action"
            WHERE "channel" = 'CALL'
              AND "createdAt" >= ${dateFrom}
              AND "createdAt" <= ${dateTo}
              ${sdrFilterRaw}
              ${listFilterRaw}
            GROUP BY date
            ORDER BY date ASC
        `),

        // 4. Temporal Heatmap
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                TO_CHAR("createdAt", 'FMDay') as day,
                EXTRACT(HOUR FROM "createdAt")::int as hour,
                COUNT(*)::int as count
            FROM "Action"
            WHERE "channel" = 'CALL'
              AND "createdAt" >= ${dateFrom}
              AND "createdAt" <= ${dateTo}
              ${sdrFilterRaw}
              ${listFilterRaw}
            GROUP BY day, hour
        `),

        // 5. SDR Performance
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                u.id as "sdrId",
                u."name" as "sdrName",
                u."role" as "sdrRole",
                COUNT(a.id)::int as calls,
                COUNT(CASE WHEN a."result" = 'CALLBACK_REQUESTED' THEN 1 END)::int as callbacks,
                COUNT(CASE WHEN a."result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings,
                COUNT(CASE WHEN a."result" = 'DISQUALIFIED' THEN 1 END)::int as disqualified,
                COUNT(CASE WHEN a."result" != 'NO_RESPONSE' THEN 1 END)::int as contacts
            FROM "Action" a
            JOIN "User" u ON a."sdrId" = u.id
            LEFT JOIN "Campaign" c ON a."campaignId" = c.id
            LEFT JOIN "Mission" m ON c."missionId" = m.id
            WHERE a."channel" = 'CALL'
              AND a."createdAt" >= ${dateFrom}
              AND a."createdAt" <= ${dateTo}
              ${sdrFilterAliasA}
              ${missionFilterAliasM}
              ${clientFilterAliasM}
              ${listFilterAliasA}
            GROUP BY u.id, u."name", u."role"
            ORDER BY calls DESC
        `),

        // 6. Mission States
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                m.id as "missionId",
                m."name" as "missionName",
                m."isActive" as "isActive",
                cl."name" as "clientName",
                COUNT(a.id)::int as calls,
                COUNT(CASE WHEN a."result" = 'CALLBACK_REQUESTED' THEN 1 END)::int as callbacks,
                COUNT(CASE WHEN a."result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings,
                string_agg(DISTINCT u."name", ',') as "sdrNames"
            FROM "Action" a
            JOIN "Campaign" c ON a."campaignId" = c.id
            JOIN "Mission" m ON c."missionId" = m.id
            JOIN "Client" cl ON m."clientId" = cl.id
            JOIN "User" u ON a."sdrId" = u.id
            WHERE a."channel" = 'CALL'
              AND a."createdAt" >= ${dateFrom}
              AND a."createdAt" <= ${dateTo}
              ${sdrFilterAliasA}
              ${missionFilterAliasM}
              ${clientFilterAliasM}
              ${listFilterAliasA}
            GROUP BY m.id, m."name", m."isActive", cl."name"
            ORDER BY calls DESC
            LIMIT 10
        `),
    ]);

    // Formatting Status Distribution
    const statuses: Record<string, number> = {};
    statusBreakdown.forEach(curr => {
        statuses[curr.result] = curr._count.id;
    });

    const totalCalls = basicStats._count.id;
    const noResponse = statuses['NO_RESPONSE'] || 0;
    const contacts = totalCalls - noResponse;
    const callbacks = statuses['CALLBACK_REQUESTED'] || 0;
    const meetings = statuses['MEETING_BOOKED'] || 0;
    const interested = statuses['INTERESTED'] || 0;

    // Grouped Status Segments per User Request
    const segments = {
        success: meetings + interested,
        neutral: callbacks + noResponse + (statuses['ENVOIE_MAIL'] || 0),
        failure: (statuses['BAD_CONTACT'] || 0) + (statuses['DISQUALIFIED'] || 0) + (statuses['MEETING_CANCELLED'] || 0) + (statuses['NOT_INTERESTED'] || 0),
    };

    // Funnel Steps 
    const funnel = {
        totalCalls,
        contacts,
        opportunities: callbacks + interested,
        meetings
    };

    return successResponse({
        timeframe: { from: dateFrom, to: dateTo },
        kpis: {
            totalCalls,
            uniqueContacts: basicStats._count.contactId,
            totalTalkTime: basicStats._sum.duration || 0,
            avgCallDuration: totalCalls > 0 ? Math.round((basicStats._sum.duration || 0) / totalCalls) : 0,
            conversionRate: totalCalls > 0 ? Number(((meetings / totalCalls) * 100).toFixed(2)) : 0,
            interestRate: totalCalls > 0 ? Number(((segments.success / totalCalls) * 100).toFixed(2)) : 0,
            meetings,
        },
        statusBreakdown: statuses,
        segments,
        funnel,
        sdrPerformance: sdrPerformanceData,
        missionStates: missionStatesData.map(m => ({
            ...m,
            sdrNames: m.sdrNames ? m.sdrNames.split(',') : []
        })),
        charts: {
            daily: dailyVolume,
            heatmap: heatmapData.map(h => ({
                key: `${h.day.trim().substring(0, 3)}-${h.hour}`,
                count: h.count
            }))
        }
    });

});
