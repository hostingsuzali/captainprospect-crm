import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============================================
// GET /api/sdr/meetings
// Fetch meetings booked by the current SDR with filtering by Mission and List
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
        const listId = searchParams.get("listId");

        // Build where clause with filters (include MEETING_BOOKED and MEETING_CANCELLED)
        const where: any = {
            sdrId: session.user.id,
            result: { in: ["MEETING_BOOKED", "MEETING_CANCELLED"] },
        };

        // Filter by Mission (via Campaign -> Mission)
        if (missionId) {
            where.campaign = {
                missionId: missionId,
            };
        }

        // Filter by List (via Contact -> Company -> List)
        if (listId) {
            where.contact = {
                company: {
                    listId: listId,
                },
            };
        }

        // If both filters are present, combine them
        if (missionId && listId) {
            where.campaign = {
                missionId: missionId,
            };
            where.contact = {
                company: {
                    listId: listId,
                },
            };
        }

        const meetings = await prisma.action.findMany({
            where,
            include: {
                contact: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        title: true,
                        email: true,
                        company: {
                            select: {
                                id: true,
                                name: true,
                                list: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
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
                                client: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // Transform response to match frontend expectations
        const transformedMeetings = meetings.map((meeting) => ({
            id: meeting.id,
            createdAt: meeting.createdAt,
            result: meeting.result,
            note: meeting.note || undefined,
            contact: meeting.contact,
            mission: meeting.campaign?.mission
                ? {
                      id: meeting.campaign.mission.id,
                      name: meeting.campaign.mission.name,
                      client: meeting.campaign.mission.client,
                  }
                : null,
            list: meeting.contact.company.list
                ? {
                      id: meeting.contact.company.list.id,
                      name: meeting.contact.company.list.name,
                  }
                : null,
        }));

        return NextResponse.json({
            success: true,
            data: transformedMeetings,
        });

    } catch (error) {
        console.error("Error fetching SDR meetings:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
