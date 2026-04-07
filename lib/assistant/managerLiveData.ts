import { prisma } from "@/lib/prisma";

type TeamUser = {
    id: string;
    name: string;
    lastConnectedAt: Date | null;
};

type MissionBlock = {
    sdrId: string;
    missionId: string;
    missionName: string;
    clientName: string;
    startTime: string;
    endTime: string;
};

type LowActivitySignal = {
    sdrId: string;
    sdrName: string;
    actionsToday: number;
    activeSecondsToday: number;
    lastConnectedAt: string | null;
    reasons: string[];
};

type PerformanceRow = {
    sdrId: string;
    sdrName: string;
    actions: number;
    meetings: number;
    conversionPct: number;
};

function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function hasAny(q: string, patterns: RegExp[]): boolean {
    return patterns.some((p) => p.test(q));
}

function shouldLoadMissionToday(question: string): boolean {
    const q = normalize(question);
    return (
        /mission/.test(q) &&
        /(today|aujourd|ce jour|sur quelle|quelle mission)/.test(q)
    );
}

function shouldLoadMissionNextWeek(question: string): boolean {
    const q = normalize(question);
    const hasMissionWord = /(mission|missions|work on|working on|travaille|travaillons)/.test(q);
    const hasNextWeekWord = /(next week|semaine prochaine|week next|prochaine semaine)/.test(q);
    return hasMissionWord && hasNextWeekWord;
}

function shouldLoadLowActivity(question: string): boolean {
    const q = normalize(question);
    return /(lazy|feneant|fain|pas actif|inactive|low activity|qui bosse pas|qui ne travaille|moins actif)/.test(
        q
    );
}

function shouldLoadCallbacks(question: string): boolean {
    const q = normalize(question);
    return hasAny(q, [/(callback|rappel|relance|a rappeler|rappels|follow[- ]?up)/]);
}

function shouldLoadTopPerformance(question: string): boolean {
    const q = normalize(question);
    return hasAny(q, [
        /(top|leader|leaderboard|classement|meilleur|best)/,
        /(perform|performance|rdv|meeting|conversion|qui est fort)/,
    ]);
}

function shouldLoadPlanningConflicts(question: string): boolean {
    const q = normalize(question);
    return hasAny(q, [
        /(planning|planification|plan)/,
        /(conflit|conflict|p0|p1|p2|overload|surcharge|double booked|capacite|capacity)/,
    ]);
}

function shouldLoadAbsences(question: string): boolean {
    const q = normalize(question);
    return hasAny(q, [/(absence|absent|conge|vacation|sick|malade|off today)/]);
}

function shouldLoadMissionHealth(question: string): boolean {
    const q = normalize(question);
    return hasAny(q, [
        /(mission.*health|mission.*sante|mission.*performance|mission.*risque)/,
        /(understaffed|en retard|bloquee|bloque|stale mission|no activity)/,
    ]);
}

function matchTargetSdr(question: string, users: TeamUser[]): TeamUser | null {
    const q = normalize(question);
    let best: TeamUser | null = null;
    let bestLen = 0;

    for (const user of users) {
        const name = normalize(user.name);
        if (!name) continue;
        if (q.includes(name) && name.length > bestLen) {
            best = user;
            bestLen = name.length;
            continue;
        }
        const parts = name.split(" ").filter(Boolean);
        if (parts.length > 0 && parts.every((p) => q.includes(p)) && name.length > bestLen) {
            best = user;
            bestLen = name.length;
        }
    }
    return best;
}

function mergePerformance(
    users: TeamUser[],
    actionsMap: Map<string, number>,
    meetingsMap: Map<string, number>
): PerformanceRow[] {
    return users
        .map((u) => {
            const actions = actionsMap.get(u.id) ?? 0;
            const meetings = meetingsMap.get(u.id) ?? 0;
            const conversionPct = actions > 0 ? Number(((meetings / actions) * 100).toFixed(1)) : 0;
            return {
                sdrId: u.id,
                sdrName: u.name,
                actions,
                meetings,
                conversionPct,
            };
        })
        .sort((a, b) => {
            if (b.meetings !== a.meetings) return b.meetings - a.meetings;
            if (b.actions !== a.actions) return b.actions - a.actions;
            return b.conversionPct - a.conversionPct;
        });
}

function buildLowActivitySignals(
    users: TeamUser[],
    actionsBySdr: Map<string, number>,
    activeBySdr: Map<string, { activeSeconds: number; lastActivityAt: Date | null }>
): LowActivitySignal[] {
    const now = new Date();
    const hour = now.getHours();
    const isLateEnough = hour >= 11;

    const signals: LowActivitySignal[] = users.map((u) => {
        const actionsToday = actionsBySdr.get(u.id) ?? 0;
        const activity = activeBySdr.get(u.id);
        const activeSecondsToday = activity?.activeSeconds ?? 0;
        const lastConnected = u.lastConnectedAt;
        const minutesSinceLastConnected = lastConnected
            ? Math.floor((now.getTime() - lastConnected.getTime()) / 60000)
            : null;

        const reasons: string[] = [];
        if (isLateEnough && actionsToday <= 2) {
            reasons.push(`very low actions (${actionsToday})`);
        }
        if (isLateEnough && activeSecondsToday < 1800) {
            reasons.push(`low active CRM time (${Math.round(activeSecondsToday / 60)} min)`);
        }
        if (minutesSinceLastConnected != null && minutesSinceLastConnected > 120) {
            reasons.push(`disconnected for ${minutesSinceLastConnected} min`);
        }
        if (minutesSinceLastConnected == null) {
            reasons.push("no connection signal today");
        }

        return {
            sdrId: u.id,
            sdrName: u.name,
            actionsToday,
            activeSecondsToday,
            lastConnectedAt: lastConnected ? lastConnected.toISOString() : null,
            reasons,
        };
    });

    return signals
        .filter((s) => s.reasons.length > 0)
        .sort((a, b) => {
            const aScore = a.actionsToday * 2 + Math.floor(a.activeSecondsToday / 900);
            const bScore = b.actionsToday * 2 + Math.floor(b.activeSecondsToday / 900);
            return aScore - bScore;
        })
        .slice(0, 6);
}

export async function buildManagerLiveDataContext(question: string): Promise<string> {
    const needMissionToday = shouldLoadMissionToday(question);
    const needMissionNextWeek = shouldLoadMissionNextWeek(question);
    const needLowActivity = shouldLoadLowActivity(question);
    const needCallbacks = shouldLoadCallbacks(question);
    const needTopPerformance = shouldLoadTopPerformance(question);
    const needPlanningConflicts = shouldLoadPlanningConflicts(question);
    const needAbsences = shouldLoadAbsences(question);
    const needMissionHealth = shouldLoadMissionHealth(question);
    if (
        !needMissionToday &&
        !needMissionNextWeek &&
        !needLowActivity &&
        !needCallbacks &&
        !needTopPerformance &&
        !needPlanningConflicts &&
        !needAbsences &&
        !needMissionHealth
    ) {
        return "";
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const day = now.getDay(); // 0=Sun..6=Sat
    const daysUntilNextMonday = ((8 - day) % 7) || 7;
    const nextWeekStart = new Date(todayStart);
    nextWeekStart.setDate(todayStart.getDate() + daysUntilNextMonday);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 7);

    const users = await prisma.user.findMany({
        where: {
            role: { in: ["SDR", "BOOKER"] },
            isActive: true,
        },
        select: {
            id: true,
            name: true,
            lastConnectedAt: true,
        },
        orderBy: { name: "asc" },
    });

    if (users.length === 0) {
        return "Live manager data: no active SDRs found in team.";
    }

    const targetSdr = matchTargetSdr(question, users);
    const scopedUsers = targetSdr ? [targetSdr] : users;
    const scopedSdrIds = scopedUsers.map((u) => u.id);

    let missionBlocks: MissionBlock[] = [];
    if (needMissionToday) {
        const blocks = await prisma.scheduleBlock.findMany({
            where: {
                sdrId: { in: scopedSdrIds },
                date: { gte: todayStart, lt: tomorrow },
                status: { not: "CANCELLED" },
            },
            select: {
                sdrId: true,
                missionId: true,
                startTime: true,
                endTime: true,
                mission: {
                    select: {
                        name: true,
                        client: { select: { name: true } },
                    },
                },
            },
            orderBy: [{ sdrId: "asc" }, { startTime: "asc" }],
        });

        missionBlocks = blocks.map((b) => ({
            sdrId: b.sdrId,
            missionId: b.missionId,
            missionName: b.mission.name,
            clientName: b.mission.client.name,
            startTime: b.startTime,
            endTime: b.endTime,
        }));
    }

    let nextWeekMissionRoster: Array<{
        missionId: string;
        missionName: string;
        clientName: string;
        memberCount: number;
        members: Array<{ sdrId: string; sdrName: string }>;
        plannedBlocks: number;
    }> = [];
    if (needMissionNextWeek) {
        const nextWeekBlocks = await prisma.scheduleBlock.findMany({
            where: {
                date: { gte: nextWeekStart, lt: nextWeekEnd },
                status: { not: "CANCELLED" },
                OR: [{ suggestionStatus: null }, { suggestionStatus: "SUGGESTED" }, { suggestionStatus: "CONFIRMED" }],
            },
            select: {
                missionId: true,
                sdrId: true,
                mission: {
                    select: {
                        id: true,
                        name: true,
                        client: { select: { name: true } },
                    },
                },
                sdr: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: [{ missionId: "asc" }],
        });

        const rosterMap = new Map<
            string,
            {
                missionId: string;
                missionName: string;
                clientName: string;
                membersMap: Map<string, { sdrId: string; sdrName: string }>;
                plannedBlocks: number;
            }
        >();

        for (const block of nextWeekBlocks) {
            const key = block.missionId;
            const existing = rosterMap.get(key) ?? {
                missionId: block.mission.id,
                missionName: block.mission.name,
                clientName: block.mission.client.name,
                membersMap: new Map<string, { sdrId: string; sdrName: string }>(),
                plannedBlocks: 0,
            };
            existing.plannedBlocks += 1;
            existing.membersMap.set(block.sdrId, { sdrId: block.sdr.id, sdrName: block.sdr.name });
            rosterMap.set(key, existing);
        }

        nextWeekMissionRoster = [...rosterMap.values()]
            .map((r) => ({
                missionId: r.missionId,
                missionName: r.missionName,
                clientName: r.clientName,
                memberCount: r.membersMap.size,
                members: [...r.membersMap.values()].sort((a, b) => a.sdrName.localeCompare(b.sdrName)),
                plannedBlocks: r.plannedBlocks,
            }))
            .sort((a, b) => b.plannedBlocks - a.plannedBlocks);
    }

    let lowActivitySignals: LowActivitySignal[] = [];
    if (needLowActivity) {
        const [actionGroups, activityDays] = await Promise.all([
            prisma.action.groupBy({
                by: ["sdrId"],
                where: {
                    sdrId: { in: scopedSdrIds },
                    createdAt: { gte: todayStart, lt: tomorrow },
                },
                _count: { _all: true },
            }),
            prisma.crmActivityDay.findMany({
                where: {
                    userId: { in: scopedSdrIds },
                    date: todayStart,
                },
                select: {
                    userId: true,
                    totalActiveSeconds: true,
                    lastActivityAt: true,
                },
            }),
        ]);

        const actionsBySdr = new Map(actionGroups.map((g) => [g.sdrId, g._count._all]));
        const activeBySdr = new Map(
            activityDays.map((a) => [
                a.userId,
                { activeSeconds: a.totalActiveSeconds, lastActivityAt: a.lastActivityAt },
            ])
        );

        lowActivitySignals = buildLowActivitySignals(scopedUsers, actionsBySdr, activeBySdr);
    }

    let callbacksBySdr: Array<{
        sdrId: string;
        sdrName: string;
        count: number;
        nextCallbackDate: string | null;
    }> = [];
    if (needCallbacks) {
        const callbackStatuses = ["CALLBACK_REQUESTED", "RELANCE", "RAPPEL"];
        const callbackAgg = await prisma.action.groupBy({
            by: ["sdrId"],
            where: {
                sdrId: { in: scopedSdrIds },
                result: { in: callbackStatuses },
                OR: [
                    { callbackDate: { gte: todayStart } },
                    { callbackDate: null, createdAt: { gte: todayStart } },
                ],
            },
            _count: { _all: true },
            _min: { callbackDate: true },
        });
        const userMap = new Map(scopedUsers.map((u) => [u.id, u.name]));
        callbacksBySdr = callbackAgg
            .map((r) => ({
                sdrId: r.sdrId,
                sdrName: userMap.get(r.sdrId) || "Unknown",
                count: r._count._all,
                nextCallbackDate: r._min.callbackDate?.toISOString() ?? null,
            }))
            .sort((a, b) => b.count - a.count);
    }

    let topPerformanceToday: PerformanceRow[] = [];
    let topPerformanceWeek: PerformanceRow[] = [];
    if (needTopPerformance || needLowActivity) {
        const [actionsToday, meetingsToday, actionsWeek, meetingsWeek] = await Promise.all([
            prisma.action.groupBy({
                by: ["sdrId"],
                where: { sdrId: { in: scopedSdrIds }, createdAt: { gte: todayStart, lt: tomorrow } },
                _count: { _all: true },
            }),
            prisma.action.groupBy({
                by: ["sdrId"],
                where: {
                    sdrId: { in: scopedSdrIds },
                    createdAt: { gte: todayStart, lt: tomorrow },
                    result: "MEETING_BOOKED",
                },
                _count: { _all: true },
            }),
            prisma.action.groupBy({
                by: ["sdrId"],
                where: { sdrId: { in: scopedSdrIds }, createdAt: { gte: weekStart, lt: tomorrow } },
                _count: { _all: true },
            }),
            prisma.action.groupBy({
                by: ["sdrId"],
                where: {
                    sdrId: { in: scopedSdrIds },
                    createdAt: { gte: weekStart, lt: tomorrow },
                    result: "MEETING_BOOKED",
                },
                _count: { _all: true },
            }),
        ]);
        const actionsTodayMap = new Map(actionsToday.map((r) => [r.sdrId, r._count._all]));
        const meetingsTodayMap = new Map(meetingsToday.map((r) => [r.sdrId, r._count._all]));
        const actionsWeekMap = new Map(actionsWeek.map((r) => [r.sdrId, r._count._all]));
        const meetingsWeekMap = new Map(meetingsWeek.map((r) => [r.sdrId, r._count._all]));
        topPerformanceToday = mergePerformance(scopedUsers, actionsTodayMap, meetingsTodayMap).slice(0, 8);
        topPerformanceWeek = mergePerformance(scopedUsers, actionsWeekMap, meetingsWeekMap).slice(0, 8);
    }

    let absencesToday: Array<{
        sdrId: string;
        sdrName: string;
        type: string;
        startDate: string;
        endDate: string;
        note: string | null;
    }> = [];
    if (needAbsences) {
        const absences = await prisma.sdrAbsence.findMany({
            where: {
                sdrId: { in: scopedSdrIds },
                startDate: { lte: todayStart },
                endDate: { gte: todayStart },
            },
            select: {
                sdrId: true,
                type: true,
                startDate: true,
                endDate: true,
                note: true,
                sdr: { select: { name: true } },
            },
            orderBy: [{ startDate: "asc" }],
        });
        absencesToday = absences.map((a) => ({
            sdrId: a.sdrId,
            sdrName: a.sdr.name,
            type: a.type,
            startDate: a.startDate.toISOString(),
            endDate: a.endDate.toISOString(),
            note: a.note ?? null,
        }));
    }

    let planningConflicts: Array<{
        id: string;
        severity: string;
        type: string;
        sdrId: string | null;
        missionId: string | null;
        message: string;
        suggestedAction: string | null;
    }> = [];
    let planningConflictSummary: { P0: number; P1: number; P2: number; total: number } | null = null;
    if (needPlanningConflicts) {
        const conflictRows = await prisma.planningConflict.findMany({
            where: {
                month: monthKey,
                resolvedAt: null,
                ...(targetSdr ? { sdrId: targetSdr.id } : {}),
            },
            select: {
                id: true,
                severity: true,
                type: true,
                sdrId: true,
                missionId: true,
                message: true,
                suggestedAction: true,
            },
            orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
            take: 50,
        });
        planningConflicts = conflictRows.map((c) => ({
            id: c.id,
            severity: c.severity,
            type: c.type,
            sdrId: c.sdrId ?? null,
            missionId: c.missionId ?? null,
            message: c.message,
            suggestedAction: c.suggestedAction ?? null,
        }));
        planningConflictSummary = {
            P0: planningConflicts.filter((c) => c.severity === "P0").length,
            P1: planningConflicts.filter((c) => c.severity === "P1").length,
            P2: planningConflicts.filter((c) => c.severity === "P2").length,
            total: planningConflicts.length,
        };
    }

    let missionHealth:
        | {
            activeMissions: number;
            staleMissions: Array<{ missionId: string; missionName: string; clientName: string; lastActionAt: string | null }>;
            missionKpis: Array<{
                missionId: string;
                missionName: string;
                clientName: string;
                actions7d: number;
                meetings7d: number;
                lastActionAt: string | null;
            }>;
        }
        | null = null;
    if (needMissionHealth) {
        const missions = await prisma.mission.findMany({
            where: {
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now },
            },
            select: {
                id: true,
                name: true,
                client: { select: { name: true } },
            },
            orderBy: { name: "asc" },
            take: 40,
        });
        const missionIds = missions.map((m) => m.id);
        const actions = missionIds.length
            ? await prisma.action.findMany({
                where: {
                    createdAt: { gte: sevenDaysAgo, lt: tomorrow },
                    campaign: { missionId: { in: missionIds } },
                },
                select: {
                    createdAt: true,
                    result: true,
                    campaign: { select: { missionId: true } },
                },
            })
            : [];

        const stats = new Map<
            string,
            { actions7d: number; meetings7d: number; lastActionAt: Date | null }
        >();
        for (const m of missions) {
            stats.set(m.id, { actions7d: 0, meetings7d: 0, lastActionAt: null });
        }
        for (const a of actions) {
            const missionId = a.campaign?.missionId;
            if (!missionId) continue;
            const row = stats.get(missionId);
            if (!row) continue;
            row.actions7d += 1;
            if (a.result === "MEETING_BOOKED") row.meetings7d += 1;
            if (!row.lastActionAt || a.createdAt > row.lastActionAt) row.lastActionAt = a.createdAt;
        }

        const missionKpis = missions.map((m) => {
            const s = stats.get(m.id)!;
            return {
                missionId: m.id,
                missionName: m.name,
                clientName: m.client.name,
                actions7d: s.actions7d,
                meetings7d: s.meetings7d,
                lastActionAt: s.lastActionAt?.toISOString() ?? null,
            };
        });
        missionHealth = {
            activeMissions: missions.length,
            staleMissions: missionKpis
                .filter((m) => m.actions7d === 0)
                .map((m) => ({
                    missionId: m.missionId,
                    missionName: m.missionName,
                    clientName: m.clientName,
                    lastActionAt: m.lastActionAt,
                })),
            missionKpis: missionKpis.sort((a, b) => b.actions7d - a.actions7d).slice(0, 20),
        };
    }

    const payload = {
        generatedAt: now.toISOString(),
        monthKey,
        triggeredCases: {
            missionToday: needMissionToday,
            missionNextWeek: needMissionNextWeek,
            lowActivity: needLowActivity,
            callbacks: needCallbacks,
            topPerformance: needTopPerformance,
            planningConflicts: needPlanningConflicts,
            absences: needAbsences,
            missionHealth: needMissionHealth,
        },
        scope: targetSdr ? `single_sdr:${targetSdr.name}` : "team",
        missionToday: missionBlocks,
        nextWeekWindow: {
            start: nextWeekStart.toISOString(),
            endExclusive: nextWeekEnd.toISOString(),
        },
        nextWeekMissionRoster,
        lowActivitySignals,
        callbacksBySdr,
        topPerformanceToday,
        topPerformanceWeek,
        absencesToday,
        planningConflictSummary,
        planningConflicts,
        missionHealth,
        note: "Use these live operational facts for manager answers. For 'lazy' requests, frame as low activity signals and propose coaching actions.",
    };

    return `Manager live operational data (real-time):
${JSON.stringify(payload, null, 2)}`;
}
