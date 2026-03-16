import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============================================
// GET /api/sdr/missions
// Fetch missions assigned to current SDR
// ============================================

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        const role = session.user.role;
        if (role !== "SDR" && role !== "BOOKER") {
            return NextResponse.json(
                { success: false, error: "Accès non autorisé" },
                { status: 403 }
            );
        }

        const baseMissionInclude = {
            client: { select: { id: true, name: true } },
            lists: {
                select: {
                    id: true,
                    _count: { select: { companies: true } },
                },
            },
            _count: { select: { campaigns: true, lists: true } },
            defaultMailbox: { select: { id: true, email: true, displayName: true } },
        } as const;

        const missionsRaw =
            role === "BOOKER"
                ? await prisma.mission.findMany({
                      where: { isActive: true },
                      include: baseMissionInclude,
                      orderBy: { createdAt: "desc" },
                  })
                : (
                      await prisma.sDRAssignment.findMany({
                          where: {
                              sdrId: session.user.id,
                              mission: { isActive: true },
                          },
                          include: { mission: { include: baseMissionInclude } },
                          orderBy: { createdAt: "desc" },
                      })
                  ).map((a) => a.mission);

        // Calculate progress and remaining contacts for each mission
        const missions = await Promise.all(
            missionsRaw.map(async (mission) => {
                // Get total contacts count for this mission's lists
                const totalContacts = await prisma.contact.count({
                    where: {
                        company: {
                            list: {
                                missionId: mission.id,
                            },
                        },
                    },
                });

                // Get actioned contacts (contacts with at least one action)
                const actionedContacts = await prisma.contact.count({
                    where: {
                        company: {
                            list: {
                                missionId: mission.id,
                            },
                        },
                        actions: {
                            some: {},
                        },
                    },
                });

                const progress = totalContacts > 0
                    ? Math.round((actionedContacts / totalContacts) * 100)
                    : 0;

                return {
                    id: mission.id,
                    name: mission.name,
                    channel: mission.channel,
                    client: mission.client,
                    defaultMailboxId: mission.defaultMailboxId ?? null,
                    progress,
                    contactsRemaining: totalContacts - actionedContacts,
                    _count: mission._count,
                };
            })
        );

        return NextResponse.json({
            success: true,
            data: missions,
        });
    } catch (error) {
        console.error("Error fetching SDR missions:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
