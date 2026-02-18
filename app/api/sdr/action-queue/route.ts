import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, requireRole, withErrorHandler } from "@/lib/api-utils";
import { statusConfigService } from "@/lib/services/StatusConfigService";

// ============================================
// GET /api/sdr/action-queue
// Returns a list of queue items (same pool as /api/actions/next) for table view.
// Query: missionId?, listId?, limit? (0 or omitted = all), search? (filter by name/company)
// Returns all queue items by default so the SDR table shows the complete listing.
// ============================================

function escapeIlikePattern(raw: string): string {
    return raw
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
}

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["SDR", "BUSINESS_DEVELOPER"], request);
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get("missionId");
    const listId = searchParams.get("listId");
    const search = searchParams.get("search")?.trim() ?? "";
    const hasSearch = search.length > 0;
    // No hard limit – return all queue items so the SDR can see the full listing
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) || 0 : 0; // 0 = no limit

    const COOLDOWN_HOURS = 24;
    const cooldownDate = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
    const sdrId = session.user.id;

    const missionFilter = missionId ? `AND m.id = '${missionId.replace(/'/g, "''")}'` : "";
    const listFilter = listId ? `AND l.id = '${listId.replace(/'/g, "''")}'` : "";

    const rawResult = await prisma.$queryRawUnsafe<
        Array<{
            contact_id: string | null;
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
            mission_name: string;
            mission_channel: string;
            last_action_result: string | null;
            last_action_note: string | null;
            last_action_created: Date | null;
        }>
    >(
        `
        WITH sdr_contacts AS (
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
                m.name as mission_name,
                m.channel as mission_channel
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
              AND (
                  (m.channel = 'CALL' AND (c.phone IS NOT NULL AND c.phone != '' OR co.phone IS NOT NULL AND co.phone != '')) OR
                  (m.channel = 'EMAIL' AND c.email IS NOT NULL AND c.email != '') OR
                  (m.channel = 'LINKEDIN' AND c.linkedin IS NOT NULL AND c.linkedin != '')
              )
              ${missionFilter}
              ${listFilter}
        ),
        sdr_companies AS (
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
                m.name as mission_name,
                m.channel as mission_channel
            FROM "Company" co
            INNER JOIN "List" l ON co."listId" = l.id
            INNER JOIN "Mission" m ON l."missionId" = m.id
            INNER JOIN "Client" cl ON m."clientId" = cl.id
            INNER JOIN "Campaign" camp ON camp."missionId" = m.id
            INNER JOIN "SDRAssignment" sa ON sa."missionId" = m.id
            WHERE sa."sdrId" = $1
              AND m."isActive" = true
              AND camp."isActive" = true
              AND m.channel = 'CALL'
              AND co.phone IS NOT NULL
              AND co.phone != ''
              AND NOT EXISTS (
                  SELECT 1 FROM "Contact" c2
                  WHERE c2."companyId" = co.id
                  AND (
                      (m.channel = 'CALL' AND c2.phone IS NOT NULL AND c2.phone != '') OR
                      (m.channel = 'EMAIL' AND c2.email IS NOT NULL AND c2.email != '') OR
                      (m.channel = 'LINKEDIN' AND c2.linkedin IS NOT NULL AND c2.linkedin != '')
                  )
              )
              ${missionFilter}
              ${listFilter}
        ),
        all_targets AS (
            SELECT * FROM sdr_contacts
            UNION ALL
            SELECT * FROM sdr_companies
        ),
        last_actions_contacts AS (
            SELECT DISTINCT ON (a."contactId")
                a."contactId",
                a.result,
                a.note,
                a."createdAt"
            FROM "Action" a
            WHERE a."contactId" IN (SELECT contact_id FROM all_targets WHERE contact_id IS NOT NULL)
            ORDER BY a."contactId", a."createdAt" DESC
        ),
        last_actions_companies AS (
            SELECT DISTINCT ON (a."companyId")
                a."companyId",
                a.result,
                a.note,
                a."createdAt"
            FROM "Action" a
            WHERE a."companyId" IN (SELECT company_id FROM all_targets WHERE contact_id IS NULL)
              AND a."companyId" IS NOT NULL
            ORDER BY a."companyId", a."createdAt" DESC
        ),
        targets_with_last_action AS (
            SELECT
                at.*,
                COALESCE(lac.result, lac2.result)::text as last_action_result,
                COALESCE(lac.note, lac2.note) as last_action_note,
                COALESCE(lac."createdAt", lac2."createdAt") as last_action_created
            FROM all_targets at
            LEFT JOIN last_actions_contacts lac ON at.contact_id = lac."contactId"
            LEFT JOIN last_actions_companies lac2 ON at.contact_id IS NULL AND at.company_id = lac2."companyId"
        )
        SELECT * FROM targets_with_last_action
        ${hasSearch ? `
        WHERE (
            (contact_first_name IS NOT NULL AND contact_first_name ILIKE $2)
            OR (contact_last_name IS NOT NULL AND contact_last_name ILIKE $2)
            OR (company_name IS NOT NULL AND company_name ILIKE $2)
        )` : ""}
    `,
        ...(hasSearch ? [sdrId, `%${escapeIlikePattern(search)}%`] : [sdrId])
    );

    // Resolve missionId for config
    let configMissionId = missionId ?? null;
    if (!configMissionId && listId) {
        const list = await prisma.list.findUnique({
            where: { id: listId },
            select: { missionId: true },
        });
        configMissionId = list?.missionId ?? null;
    }
    if (!configMissionId && rawResult.length > 0) {
        const camp = await prisma.campaign.findUnique({
            where: { id: rawResult[0].campaign_id },
            select: { missionId: true },
        });
        configMissionId = camp?.missionId ?? null;
    }

    const config = await statusConfigService.getEffectiveStatusConfig(
        configMissionId ? { missionId: configMissionId } : {}
    );

    // Add config-driven priority, apply cooldown (999 for recent), sort, limit
    const withPriority = rawResult.map((row) => {
        const inCooldown =
            row.last_action_created && new Date(row.last_action_created) >= cooldownDate;
        const { priorityOrder, priorityLabel } = inCooldown
            ? { priorityOrder: 999, priorityLabel: "SKIP" as const }
            : statusConfigService.getPriorityForResult(row.last_action_result, config);
        return { ...row, _priorityOrder: priorityOrder, _priorityLabel: priorityLabel };
    });
    const sorted = withPriority.sort(
        (a, b) =>
            a._priorityOrder - b._priorityOrder ||
            (a.contact_status === "ACTIONABLE" ? 0 : a.contact_status === "PARTIAL" ? 1 : 2) -
                (b.contact_status === "ACTIONABLE" ? 0 : b.contact_status === "PARTIAL" ? 1 : 2) ||
            new Date(a.last_action_created ?? 0).getTime() - new Date(b.last_action_created ?? 0).getTime()
    );
    const result = limit > 0 ? sorted.slice(0, limit) : sorted;

    const items = result.map((row) => ({
        contactId: row.contact_id,
        companyId: row.company_id,
        contact: row.contact_id
            ? {
                id: row.contact_id,
                firstName: row.contact_first_name,
                lastName: row.contact_last_name,
                title: row.contact_title,
                email: row.contact_email,
                phone: row.contact_phone,
                linkedin: row.contact_linkedin,
                status: row.contact_status,
            }
            : null,
        company: {
            id: row.company_id,
            name: row.company_name,
            industry: row.company_industry,
            website: row.company_website,
            country: row.company_country,
            phone: row.company_phone || null,
        },
        campaignId: row.campaign_id,
        channel: row.mission_channel,
        missionName: row.mission_name,
        lastAction: row.last_action_result
            ? {
                result: row.last_action_result,
                note: row.last_action_note,
                createdAt: row.last_action_created?.toISOString(),
            }
            : null,
        priority: row._priorityLabel,
    }));

    return successResponse({ items });
});
