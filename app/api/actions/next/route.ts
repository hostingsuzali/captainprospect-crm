import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';
import { statusConfigService } from '@/lib/services/StatusConfigService';

// ============================================
// OPTIMIZED QUEUE QUERY - PHASE 2.5
// ============================================
// Single SQL query using CTEs for performance
// Now supports missionId and listId filters
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['SDR', 'BUSINESS_DEVELOPER'], request);
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');
    const listId = searchParams.get('listId');
    const channelParam = searchParams.get('channel')?.toUpperCase();
    const VALID_CHANNELS = ['CALL', 'EMAIL', 'LINKEDIN'] as const;
    const channelFilter = channelParam && VALID_CHANNELS.includes(channelParam as any)
        ? `AND ('${channelParam}' = ANY(m.channels))`
        : '';

    // Cooldown configuration (should move to env/config)
    const COOLDOWN_HOURS = 24;
    const cooldownDate = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
    const sdrId = session.user.id;

    // Build dynamic where clauses
    const missionFilter = missionId
        ? `AND m.id = '${missionId.replace(/'/g, "''")}'`
        : '';
    const listFilter = listId
        ? `AND l.id = '${listId.replace(/'/g, "''")}'`
        : '';

    // ============================================
    // OPTIMIZED QUERY: Single CTE-based query
    // Now includes both contacts AND companies (for direct company calls)
    // ============================================
    const result = await prisma.$queryRawUnsafe<Array<{
        contact_id: string;
        company_id: string;
        company_name: string;
        company_industry: string | null;
        company_website: string | null;
        company_country: string | null;
        company_phone: string | null;
        contact_first_name: string | null;
        contact_last_name: string | null;
        contact_title: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        contact_linkedin: string | null;
        contact_status: string;
        campaign_id: string;
        campaign_script: string | null;
        mission_name: string;
        mission_channel: string;
        client_id: string;
        client_booking_url: string | null;
        last_action_result: string | null;
        last_action_note: string | null;
        last_action_created: Date | null;
        last_action_sdr_id?: string | null;
        last_action_sdr_name?: string | null;
        priority: number;
        priority_label: string;
    }>>(`
        WITH sdr_contacts AS (
            -- Get all contacts for SDR's active missions
            -- Include ALL statuses (INCOMPLETE, PARTIAL, ACTIONABLE) - SDRs can work with all
            SELECT DISTINCT
                c.id as contact_id,
                co.id as company_id,
                co.name as company_name,
                co.industry as company_industry,
                co.website as company_website,
                co.country as company_country,
                co.phone as company_phone,
                c."firstName" as contact_first_name,
                c."lastName" as contact_last_name,
                c.title as contact_title,
                c.email as contact_email,
                c.phone as contact_phone,
                c.linkedin as contact_linkedin,
                c.status::text as contact_status,
                camp.id as campaign_id,
                camp.script as campaign_script,
                m.name as mission_name,
                m.channel as mission_channel,
                cl.id as client_id,
                cl."bookingUrl" as client_booking_url
            FROM "Contact" c
            INNER JOIN "Company" co ON c."companyId" = co.id
            INNER JOIN "List" l ON co."listId" = l.id
            INNER JOIN "Mission" m ON l."missionId" = m.id
            INNER JOIN "Client" cl ON m."clientId" = cl.id
            INNER JOIN "Campaign" camp ON camp."missionId" = m.id
            INNER JOIN "SDRAssignment" sa ON sa."missionId" = m.id
            WHERE sa."sdrId" = $1
              AND m."isActive" = true
              AND camp."isActive" = true
              -- Include all contacts regardless of status (INCOMPLETE, PARTIAL, ACTIONABLE)
              -- Only check that they have the required channel info for the mission (mission can be multi-channel)
              AND (
                  ('CALL' = ANY(m.channels) AND (c.phone IS NOT NULL AND c.phone != '' OR co.phone IS NOT NULL AND co.phone != '')) OR
                  ('EMAIL' = ANY(m.channels) AND c.email IS NOT NULL AND c.email != '') OR
                  ('LINKEDIN' = ANY(m.channels) AND c.linkedin IS NOT NULL AND c.linkedin != '')
              )
              ${missionFilter}
              ${listFilter}
              ${channelFilter}
        ),
        sdr_companies AS (
            -- Get companies that can be called directly (have phone but maybe no contacts, or we want to call company)
            SELECT DISTINCT
                NULL::text as contact_id,
                co.id as company_id,
                co.name as company_name,
                co.industry as company_industry,
                co.website as company_website,
                co.country as company_country,
                co.phone as company_phone,
                NULL::text as contact_first_name,
                NULL::text as contact_last_name,
                NULL::text as contact_title,
                NULL::text as contact_email,
                NULL::text as contact_phone,
                NULL::text as contact_linkedin,
                'INCOMPLETE'::text as contact_status,
                camp.id as campaign_id,
                camp.script as campaign_script,
                m.name as mission_name,
                m.channel as mission_channel,
                cl.id as client_id,
                cl."bookingUrl" as client_booking_url
            FROM "Company" co
            INNER JOIN "List" l ON co."listId" = l.id
            INNER JOIN "Mission" m ON l."missionId" = m.id
            INNER JOIN "Client" cl ON m."clientId" = cl.id
            INNER JOIN "Campaign" camp ON camp."missionId" = m.id
            INNER JOIN "SDRAssignment" sa ON sa."missionId" = m.id
            WHERE sa."sdrId" = $1
              AND m."isActive" = true
              AND camp."isActive" = true
              -- Only include companies with phone for CALL missions (mission can be multi-channel)
              AND 'CALL' = ANY(m.channels)
              AND co.phone IS NOT NULL
              AND co.phone != ''
              -- Exclude companies that already have actionable contacts (to avoid duplicates)
              AND NOT EXISTS (
                  SELECT 1 FROM "Contact" c2 
                  WHERE c2."companyId" = co.id 
                  AND (
                      ('CALL' = ANY(m.channels) AND c2.phone IS NOT NULL AND c2.phone != '') OR
                      ('EMAIL' = ANY(m.channels) AND c2.email IS NOT NULL AND c2.email != '') OR
                      ('LINKEDIN' = ANY(m.channels) AND c2.linkedin IS NOT NULL AND c2.linkedin != '')
                  )
              )
              ${missionFilter}
              ${listFilter}
              ${channelFilter}
        ),
        all_targets AS (
            -- Combine contacts and companies
            SELECT * FROM sdr_contacts
            UNION ALL
            SELECT * FROM sdr_companies
        ),
        last_actions_contacts AS (
            -- Get last action per contact (with SDR who did it)
            SELECT DISTINCT ON (a."contactId")
                a."contactId",
                a.result,
                a.note,
                a."createdAt",
                a."sdrId",
                u.name as sdr_name
            FROM "Action" a
            INNER JOIN "User" u ON u.id = a."sdrId"
            WHERE a."contactId" IN (SELECT contact_id FROM all_targets WHERE contact_id IS NOT NULL)
            ORDER BY a."contactId", a."createdAt" DESC
        ),
        last_actions_companies AS (
            -- Get last action per company (with SDR who did it)
            SELECT DISTINCT ON (a."companyId")
                a."companyId",
                a.result,
                a.note,
                a."createdAt",
                a."sdrId",
                u.name as sdr_name
            FROM "Action" a
            INNER JOIN "User" u ON u.id = a."sdrId"
            WHERE a."companyId" IN (SELECT company_id FROM all_targets WHERE contact_id IS NULL)
              AND a."companyId" IS NOT NULL
            ORDER BY a."companyId", a."createdAt" DESC
        ),
        targets_with_last_action AS (
            SELECT
                at.*,
                COALESCE(lac.result, lac2.result)::text as last_action_result,
                COALESCE(lac.note, lac2.note) as last_action_note,
                COALESCE(lac."createdAt", lac2."createdAt") as last_action_created,
                COALESCE(lac."sdrId", lac2."sdrId") as last_action_sdr_id,
                COALESCE(lac.sdr_name, lac2.sdr_name) as last_action_sdr_name
            FROM all_targets at
            LEFT JOIN last_actions_contacts lac ON at.contact_id = lac."contactId"
            LEFT JOIN last_actions_companies lac2 ON at.contact_id IS NULL AND at.company_id = lac2."companyId"
        )
        SELECT *
        FROM targets_with_last_action
        WHERE (last_action_created IS NULL OR last_action_created < $2)
        ORDER BY 
            CASE WHEN contact_status = 'ACTIONABLE' THEN 0 WHEN contact_status = 'PARTIAL' THEN 1 WHEN contact_status = 'INCOMPLETE' THEN 2 ELSE 3 END,
            COALESCE(last_action_created, '1970-01-01'::timestamp) ASC
        LIMIT 500
    `, sdrId, cooldownDate);

    // Resolve missionId for config and fetch interlocuteurs in parallel
    const configMissionIdPromise = (async () => {
        if (missionId) return missionId;
        if (listId) {
            const list = await prisma.list.findUnique({
                where: { id: listId },
                select: { missionId: true },
            });
            if (list?.missionId) return list.missionId;
        }
        if (result.length > 0) {
            const camp = await prisma.campaign.findUnique({
                where: { id: result[0].campaign_id },
                select: { missionId: true },
            });
            return camp?.missionId ?? null;
        }
        return null;
    })();

    // Sort by config once we have it
    const configMissionId = await configMissionIdPromise;
    const config = await statusConfigService.getEffectiveStatusConfig(
        configMissionId ? { missionId: configMissionId } : {}
    );

    const withPriority = result.map((row) => {
        const { priorityOrder, priorityLabel } = statusConfigService.getPriorityForResult(
            row.last_action_result,
            config
        );
        return { ...row, _priorityOrder: priorityOrder, _priorityLabel: priorityLabel };
    });
    const filtered = withPriority.filter((r) => r._priorityOrder < 999);
    const sorted = filtered.sort(
        (a, b) =>
            a._priorityOrder - b._priorityOrder ||
            (a.contact_status === "ACTIONABLE" ? 0 : a.contact_status === "PARTIAL" ? 1 : 2) -
                (b.contact_status === "ACTIONABLE" ? 0 : b.contact_status === "PARTIAL" ? 1 : 2) ||
            new Date(a.last_action_created ?? 0).getTime() - new Date(b.last_action_created ?? 0).getTime()
    );
    const next = sorted[0];

    if (!next) {
        return successResponse({
            hasNext: false,
            message: listId
                ? 'Queue vide pour cette liste - aucun contact disponible ou tous en cooldown'
                : missionId
                    ? 'Queue vide pour cette mission - aucun contact disponible ou tous en cooldown'
                    : 'Queue vide - aucun contact disponible ou tous en cooldown',
        });
    }

    // bookingUrl comes from the raw SQL now; only fetch interlocuteurs separately
    const clientBookingUrl = next.client_booking_url || undefined;
    let clientInterlocuteurs: Array<Record<string, unknown>> = [];
    try {
        const interlocuteurs = await prisma.clientInterlocuteur.findMany({
            where: { clientId: next.client_id, isActive: true },
            orderBy: { createdAt: 'asc' },
        });
        clientInterlocuteurs = interlocuteurs as Array<Record<string, unknown>>;
    } catch (err) {
        console.warn('Could not fetch client interlocuteurs:', err);
    }

    return successResponse({
        hasNext: true,
        priority: next._priorityLabel,
        missionName: next.mission_name,
        contact: next.contact_id ? {
            id: next.contact_id,
            firstName: next.contact_first_name,
            lastName: next.contact_last_name,
            title: next.contact_title,
            email: next.contact_email,
            phone: next.contact_phone,
            linkedin: next.contact_linkedin,
            status: next.contact_status,
        } : null,
        company: {
            id: next.company_id,
            name: next.company_name,
            industry: next.company_industry,
            website: next.company_website,
            country: next.company_country,
            phone: next.company_phone || null,
        },
        campaignId: next.campaign_id,
        channel: next.mission_channel,
        script: next.campaign_script,
        clientBookingUrl,
        clientInterlocuteurs,
        lastAction: next.last_action_result ? {
            result: next.last_action_result,
            note: next.last_action_note,
            createdAt: next.last_action_created?.toISOString(),
        } : null,
        lastActionBy: next.last_action_sdr_id
            ? { id: next.last_action_sdr_id, name: next.last_action_sdr_name ?? null }
            : null,
    });
});
