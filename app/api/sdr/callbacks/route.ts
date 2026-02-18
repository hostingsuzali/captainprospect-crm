import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============================================
// GET /api/sdr/callbacks
// Fetch pending callbacks for the current SDR or BD.
// BD sees callbacks by mission (campaign.missionId), not by SDR assignment:
// if an SDR is reassigned/removed, their past callbacks remain visible to BD
// because they are tied to the mission.
// ============================================

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        // 0 or omitted = no limit (return all); otherwise cap at 50k for safety
        const limitParam = searchParams.get("limit");
        const limit =
            limitParam === null || limitParam === "" || limitParam === "0"
                ? 0
                : Math.min(Math.max(1, parseInt(limitParam, 10) || 0), 50_000);
        const skip = Math.max(0, parseInt(searchParams.get("skip") || "0", 10));
        const missionIdParam = searchParams.get("missionId") || undefined;
        const listIdParam = searchParams.get("listId") || undefined;
        const dateFromParam = searchParams.get("dateFrom") || undefined;
        const dateToParam = searchParams.get("dateTo") || undefined;

        const userRole = (session.user as { role?: string }).role;
        const isBusinessDeveloper = userRole === "BUSINESS_DEVELOPER";

        // Missions assigned to current user
        const assignments = await prisma.sDRAssignment.findMany({
            where: { sdrId: session.user.id },
            select: { missionId: true },
        });
        const assignedMissionIds = assignments.map((a) => a.missionId);

        // Missions where current user is team lead (can see all teammates' callbacks)
        const teamLeadMissions = await prisma.mission.findMany({
            where: { teamLeadSdrId: session.user.id },
            select: { id: true },
        });
        const teamLeadMissionIds = teamLeadMissions.map((m) => m.id);

        // BD: scope by assigned missions. SDR: own callbacks + all callbacks for missions where they are team lead.
        const whereClause: {
            sdrId?: string;
            result: "CALLBACK_REQUESTED";
            campaign?: { missionId: string | { in: string[] } };
            callbackDate?: { gte?: Date; lte?: Date };
            OR?: Array<{ sdrId: string; campaign: { missionId: string | { in: string[] } } } | { campaign: { missionId: { in: string[] } } }>;
        } = {
            result: "CALLBACK_REQUESTED",
        };

        if (isBusinessDeveloper) {
            if (assignedMissionIds.length === 0) {
                return NextResponse.json({ success: true, data: [] });
            }
            if (missionIdParam && assignedMissionIds.includes(missionIdParam)) {
                whereClause.campaign = { missionId: missionIdParam };
            } else {
                whereClause.campaign = { missionId: { in: assignedMissionIds } };
            }
        } else {
            // SDR: own callbacks for assigned missions + all callbacks for missions where they are team lead
            if (missionIdParam && !assignedMissionIds.includes(missionIdParam) && !teamLeadMissionIds.includes(missionIdParam)) {
                return NextResponse.json({ success: true, data: [] });
            }
            const missionFilter = missionIdParam
                ? { missionId: missionIdParam }
                : { missionId: { in: [...new Set([...assignedMissionIds, ...teamLeadMissionIds])] } };
            const orParts: Array<{ sdrId: string; campaign: { missionId: string | { in: string[] } } } | { campaign: { missionId: string | { in: string[] } } }> = [
                { sdrId: session.user.id, campaign: missionFilter },
            ];
            if (teamLeadMissionIds.length > 0) {
                orParts.push({
                    campaign: missionIdParam && teamLeadMissionIds.includes(missionIdParam)
                        ? { missionId: missionIdParam }
                        : { missionId: { in: teamLeadMissionIds } },
                });
            }
            whereClause.OR = orParts;
        }

        // Date filter: callbackDate range
        if (dateFromParam || dateToParam) {
            const dateFrom = dateFromParam ? new Date(dateFromParam) : undefined;
            const dateTo = dateToParam ? new Date(dateToParam) : undefined;
            if (dateFrom && dateTo) {
                whereClause.callbackDate = { gte: dateFrom, lte: dateTo };
            } else if (dateFrom) {
                whereClause.callbackDate = { gte: dateFrom };
            } else if (dateTo) {
                whereClause.callbackDate = { lte: dateTo };
            }
        }

        // List filter: only callbacks whose contact's company or company belongs to this list
        if (listIdParam) {
            (whereClause as Record<string, unknown>).AND = [
                {
                    OR: [
                        { contact: { company: { listId: listIdParam } } },
                        { company: { listId: listIdParam } },
                    ],
                },
            ];
        }

        const callbacks = await prisma.action.findMany({
            where: whereClause,
            skip,
            ...(limit > 0 ? { take: limit } : {}),
            include: {
                sdr: (isBusinessDeveloper || teamLeadMissionIds.length > 0)
                    ? { select: { id: true, name: true } }
                    : false,
                contact: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        title: true,
                        phone: true,
                        email: true,
                        company: {
                            select: {
                                id: true,
                                name: true,
                            }
                        }
                    }
                },
                company: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    }
                },
                campaign: {
                    select: {
                        id: true,
                        name: true,
                        mission: {
                            select: {
                                id: true,
                                name: true,
                                channel: true,
                                client: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: [
                { callbackDate: 'asc' },
                { createdAt: 'desc' },
            ]
        });

        // Pending = CALLBACK_REQUESTED with no newer action for same contact/company.
        // Batch query: one SQL call instead of N to find all superseded action ids.
        type CallbackItem = {
            id: string;
            campaignId: string;
            channel: string;
            createdAt: Date;
            callbackDate: Date | null;
            note: string | null;
            contact: typeof callbacks[0]["contact"];
            company: typeof callbacks[0]["company"];
            mission: { id: string; name: string; client: { name: string } } | null;
            sdr?: { id: string; name: string | null };
        };
        const activeCallbacks: CallbackItem[] = [];

        if (callbacks.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                pagination: { limit: limit || null, skip, hasMore: false },
            });
        }

        const callbackIds = callbacks.map((c) => c.id);
        const superseded = await prisma.$queryRaw<{ id: string }[]>`
            SELECT a.id FROM "Action" a
            WHERE a.id IN (${Prisma.join(callbackIds)})
            AND (
                (a."contactId" IS NOT NULL AND EXISTS (SELECT 1 FROM "Action" b WHERE b."contactId" = a."contactId" AND b."createdAt" > a."createdAt"))
                OR
                (a."companyId" IS NOT NULL AND EXISTS (SELECT 1 FROM "Action" b WHERE b."companyId" = a."companyId" AND b."createdAt" > a."createdAt"))
            )
        `;
        const supersededSet = new Set(superseded.map((r) => r.id));

        for (const action of callbacks) {
            if (supersededSet.has(action.id)) continue;

            const item: CallbackItem = {
                id: action.id,
                campaignId: action.campaignId,
                channel: (action.campaign?.mission as { channel?: string })?.channel ?? "CALL",
                createdAt: action.createdAt,
                callbackDate: action.callbackDate,
                note: action.note,
                contact: action.contact,
                company: action.company,
                mission: action.campaign?.mission ? {
                    id: action.campaign.mission.id || action.campaignId,
                    name: action.campaign.mission.name,
                    client: action.campaign.mission.client,
                } : null,
            };
            if ((isBusinessDeveloper || teamLeadMissionIds.length > 0) && action.sdr) {
                item.sdr = { id: action.sdr.id, name: action.sdr.name };
            }
            activeCallbacks.push(item);
        }

        return NextResponse.json({
            success: true,
            data: activeCallbacks,
            pagination: { limit: limit || null, skip, hasMore: limit > 0 ? callbacks.length === limit : false },
        });

    } catch (error) {
        console.error("Error fetching SDR callbacks:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
