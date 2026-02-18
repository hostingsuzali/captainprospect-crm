import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============================================
// GET /api/sdr/lists
// Fetch lists available for current SDR (from assigned missions)
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

        // Get SDR's assigned missions
        const assignments = await prisma.sDRAssignment.findMany({
            where: {
                sdrId: session.user.id,
                mission: {
                    isActive: true,
                },
            },
            select: {
                missionId: true,
            },
        });

        const assignedMissionIds = assignments.map(a => a.missionId);

        // If missionId is provided, validate it's in assigned missions
        if (missionId && !assignedMissionIds.includes(missionId)) {
            return NextResponse.json(
                { success: false, error: "Mission non accessible" },
                { status: 403 }
            );
        }

        // Fetch lists
        const lists = await prisma.list.findMany({
            where: {
                missionId: missionId
                    ? missionId
                    : { in: assignedMissionIds },
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

        // Get contact counts and completeness for each list
        const listsWithStats = await Promise.all(
            lists.map(async (list) => {
                const contacts = await prisma.contact.findMany({
                    where: {
                        company: {
                            listId: list.id,
                        },
                    },
                    select: {
                        status: true,
                    },
                });

                const totalContacts = contacts.length;
                const actionableContacts = contacts.filter(c => c.status === "ACTIONABLE").length;
                const partialContacts = contacts.filter(c => c.status === "PARTIAL").length;
                const incompleteContacts = contacts.filter(c => c.status === "INCOMPLETE").length;

                // Contacted count (contacts with at least one action)
                const contactedCount = await prisma.contact.count({
                    where: {
                        company: {
                            listId: list.id,
                        },
                        actions: {
                            some: {},
                        },
                    },
                });

                return {
                    id: list.id,
                    name: list.name,
                    type: list.type,
                    source: list.source,
                    mission: list.mission,
                    companiesCount: list._count.companies,
                    contactsCount: totalContacts,
                    contactedCount,
                    completeness: {
                        actionable: actionableContacts,
                        partial: partialContacts,
                        incomplete: incompleteContacts,
                    },
                    progress: totalContacts > 0
                        ? Math.round((contactedCount / totalContacts) * 100)
                        : 0,
                    createdAt: list.createdAt,
                };
            })
        );

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
