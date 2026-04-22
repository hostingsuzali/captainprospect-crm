import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MissionDetailShell, type MissionShellData } from "./MissionDetailShell";
import type { MissionStatusValue } from "@/lib/constants/missionStatus";

export const dynamic = "force-dynamic";

export default async function MissionDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect("/login");
    }
    const { id } = await params;

    const mission = await prisma.mission.findUnique({
        where: { id },
        include: {
            client: { select: { id: true, name: true } },
            teamLeadSdr: { select: { id: true, name: true, email: true } },
            sdrAssignments: {
                include: {
                    sdr: { select: { id: true, name: true, email: true } },
                },
            },
            _count: {
                select: {
                    campaigns: true,
                    lists: true,
                    sdrAssignments: true,
                },
            },
        },
    });

    if (!mission) {
        notFound();
    }

    const [totalActions, meetingsBooked] = await Promise.all([
        prisma.action.count({ where: { campaign: { missionId: id } } }),
        prisma.action.count({
            where: { campaign: { missionId: id }, result: "MEETING_BOOKED" },
        }),
    ]);

    const opportunities = await prisma.opportunity.count({
        where: {
            contact: {
                company: {
                    list: { missionId: id },
                },
            },
        },
    });

    const initial: MissionShellData = {
        id: mission.id,
        name: mission.name,
        objective: mission.objective,
        channel: mission.channel as MissionShellData["channel"],
        channels: mission.channels as MissionShellData["channels"],
        status: mission.status as MissionStatusValue,
        isActive: mission.isActive,
        clientId: mission.clientId,
        client: mission.client,
        startDate: mission.startDate.toISOString(),
        endDate: mission.endDate.toISOString(),
        totalContractDays: mission.totalContractDays,
        defaultMailboxId: mission.defaultMailboxId,
        defaultInterlocuteurId: mission.defaultInterlocuteurId,
        teamLeadSdrId: mission.teamLeadSdrId,
        teamLeadSdr: mission.teamLeadSdr,
        sdrAssignments: mission.sdrAssignments.map((a) => ({
            id: a.id,
            sdr: a.sdr,
        })),
        _count: mission._count,
        stats: {
            totalActions,
            meetingsBooked,
            opportunities,
        },
        createdAt: mission.createdAt.toISOString(),
    };

    return <MissionDetailShell missionId={id} initialMission={initial} />;
}
