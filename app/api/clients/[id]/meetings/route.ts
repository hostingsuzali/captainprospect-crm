import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
    AuthError,
} from '@/lib/api-utils';

// ============================================
// GET /api/clients/[id]/meetings
// Get all meetings (RDV pris) for a client, grouped by mission and campaign
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(['MANAGER', 'CLIENT'], request);
    const { id: clientId } = await params;

    // CLIENT users can only access their own client's meetings
    if (session.user.role === 'CLIENT') {
        if (session.user.clientId !== clientId) {
            throw new AuthError('Accès non autorisé', 403);
        }
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
        where: { id: clientId },
    });

    if (!client) {
        throw new NotFoundError('Client introuvable');
    }

    // Get all missions for this client
    const missions = await prisma.mission.findMany({
        where: { clientId },
        select: { id: true },
    });

    const missionIds = missions.map(m => m.id);

    if (missionIds.length === 0) {
        return successResponse({
            totalMeetings: 0,
            byMission: [],
            byCampaign: [],
        });
    }

    // Get all meetings (actions with MEETING_BOOKED result) for this client's missions
    const meetings = await prisma.action.findMany({
        where: {
            result: 'MEETING_BOOKED',
            campaign: {
                missionId: { in: missionIds },
            },
        },
        include: {
            contact: {
                include: {
                    company: {
                        select: {
                            id: true,
                            name: true,
                            industry: true,
                        },
                    },
                },
            },
            campaign: {
                select: {
                    id: true,
                    name: true,
                    missionId: true,
                    mission: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            sdr: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Group by mission
    const byMission = new Map<string, {
        missionId: string;
        missionName: string;
        count: number;
        meetings: typeof meetings;
    }>();

    // Group by campaign
    const byCampaign = new Map<string, {
        campaignId: string;
        campaignName: string;
        missionId: string;
        missionName: string;
        count: number;
        meetings: typeof meetings;
    }>();

    for (const meeting of meetings) {
        const missionId = meeting.campaign.missionId;
        const missionName = meeting.campaign.mission.name;
        const campaignId = meeting.campaignId;
        const campaignName = meeting.campaign.name;

        // Group by mission
        if (!byMission.has(missionId)) {
            byMission.set(missionId, {
                missionId,
                missionName,
                count: 0,
                meetings: [],
            });
        }
        const missionGroup = byMission.get(missionId)!;
        missionGroup.count++;
        missionGroup.meetings.push(meeting);

        // Group by campaign
        if (!byCampaign.has(campaignId)) {
            byCampaign.set(campaignId, {
                campaignId,
                campaignName,
                missionId,
                missionName,
                count: 0,
                meetings: [],
            });
        }
        const campaignGroup = byCampaign.get(campaignId)!;
        campaignGroup.count++;
        campaignGroup.meetings.push(meeting);
    }

    return successResponse({
        totalMeetings: meetings.length,
        byMission: Array.from(byMission.values()),
        byCampaign: Array.from(byCampaign.values()),
        allMeetings: meetings,
    });
});
