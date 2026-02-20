"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Phone,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    Flame,
    Trophy,
    Clock,
    ArrowRight,
    Loader2,
    MoreHorizontal,
    Calendar,
    ChevronDown,
} from "lucide-react";
import Link from "next/link";
import {
    DateRangeFilter,
    getPresetRange,
    toISO,
    type DateRangeValue,
    type DateRangePreset,
} from "@/components/dashboard/DateRangeFilter";
import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

interface DashboardStats {
    period: string;
    totalActions: number;
    meetingsBooked: number;
    opportunities: number;
    activeMissions: number;
    conversionRate: number;
    resultBreakdown: {
        NO_RESPONSE: number;
        BAD_CONTACT: number;
        INTERESTED: number;
        CALLBACK_REQUESTED: number;
        MEETING_BOOKED: number;
        DISQUALIFIED: number;
    };
    leaderboard: { id: string; name: string; actions: number }[];
    rdvLeaderboard: { id: string; name: string; rdv: number; actions: number }[];
}

interface MissionSummaryItem {
    id: string;
    name: string;
    isActive: boolean;
    client: { id: string; name: string };
    sdrCount: number;
    actionsThisPeriod: number;
    meetingsThisPeriod: number;
    lastActionAt: string | null;
}

interface RecentActivityItem {
    id: string;
    user: string;
    userId: string;
    action: string;
    time: string;
    type: "call" | "meeting" | "schedule";
    createdAt: string;
    result?: string;
    contactOrCompanyName?: string;
    campaignName?: string;
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
    last7: "7 derniers jours",
    last4weeks: "4 dernières semaines",
    lastMonth: "Mois dernier",
    last6months: "6 derniers mois",
    last12months: "12 derniers mois",
    monthToDate: "Mois en cours",
    quarterToDate: "Trimestre en cours",
    yearToDate: "Année en cours",
    allTime: "Tout",
};

const RDV_WEEKLY_GOAL = 30;

const PIE_LABELS: Record<string, string> = {
    MEETING_BOOKED: "RDV obtenu",
    CALLBACK_REQUESTED: "Rappel prévu",
    INTERESTED: "Intéressé",
    NO_RESPONSE: "Pas répondu",
    BAD_CONTACT: "Mauvais N.",
    DISQUALIFIED: "Hors cible",
};

const PIE_COLORS: Record<string, string> = {
    MEETING_BOOKED: "#7C5CFC",
    INTERESTED: "#A78BFA",
    CALLBACK_REQUESTED: "#F59E0B",
    NO_RESPONSE: "#E2E8F0",
    BAD_CONTACT: "#CBD5E1",
    DISQUALIFIED: "#94A3B8",
};

const DAYS = ["L", "M", "Me", "J", "V", "S", "D"];

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

// Synthetic sparkline: 7 points, total = meetingsBooked (ramp)
function buildSparklineData(meetingsBooked: number): { day: string; rdv: number }[] {
    const total = meetingsBooked || 0;
    return DAYS.map((day, i) => {
        const progress = (i + 1) / 7;
        const cumul = Math.round(total * progress);
        const prev = i === 0 ? 0 : Math.round(total * (i / 7));
        return { day, rdv: Math.max(0, cumul - prev) };
    });
}

// Synthetic weekly goal chart: objectif linear to 30, cumul ramp to meetingsBooked
function buildWeeklyGoalData(meetingsBooked: number): { jour: string; cumul: number; objectif: number }[] {
    return DAYS.map((jour, i) => {
        const dayIndex = i + 1;
        const objectif = Math.round((RDV_WEEKLY_GOAL / 7) * dayIndex * 10) / 10;
        const progress = dayIndex / 7;
        const cumul = Math.round(meetingsBooked * progress);
        return { jour, cumul, objectif };
    });
}

export default function ManagerDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [missions, setMissions] = useState<MissionSummaryItem[]>([]);
    const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
    const [dateRange, setDateRange] = useState<DateRangeValue>(() => {
        const { start, end } = getPresetRange("lastMonth");
        return { preset: "lastMonth", startDate: toISO(start), endDate: toISO(end) };
    });
    const [dateFilterOpen, setDateFilterOpen] = useState(false);
    const dateFilterRef = useRef<HTMLDivElement>(null);
    const [missionFilter, setMissionFilter] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [heroAnimated, setHeroAnimated] = useState(false);
    const [heroCount, setHeroCount] = useState(0);
    const heroTargetRef = useRef(0);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            let start = dateRange.startDate;
            let end = dateRange.endDate;
            if (!start || !end) {
                const r = getPresetRange((dateRange.preset as DateRangePreset) || "lastMonth");
                start = toISO(r.start);
                end = toISO(r.end);
            }
            const statsUrl = `/api/stats?startDate=${start}&endDate=${end}${missionFilter ? `&missionId=${missionFilter}` : ""}`;
            const [statsRes, missionsRes, recentRes] = await Promise.all([
                fetch(statsUrl),
                fetch(`/api/stats/missions-summary?startDate=${start}&endDate=${end}&limit=10`),
                fetch("/api/actions/recent?limit=20"),
            ]);

            const [statsJson, missionsJson, recentJson] = await Promise.all([
                statsRes.json(),
                missionsRes.json(),
                recentRes.json(),
            ]);

            if (statsJson.success) {
                setStats(statsJson.data);
                heroTargetRef.current = statsJson.data?.meetingsBooked ?? 0;
            }
            if (missionsJson.success) setMissions(missionsJson.data?.missions ?? []);
            if (recentJson.success) setRecentActivity(recentJson.data ?? []);
        } catch (error) {
            console.error("Dashboard fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    }, [dateRange, missionFilter]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Count-up animation when stats load
    useEffect(() => {
        const target = stats?.meetingsBooked ?? 0;
        if (target === 0) {
            setHeroCount(0);
            setHeroAnimated(true);
            return;
        }
        setHeroAnimated(true);
        let current = 0;
        const step = Math.max(1, Math.ceil(target / 25));
        const interval = setInterval(() => {
            current += step;
            if (current >= target) {
                setHeroCount(target);
                clearInterval(interval);
            } else {
                setHeroCount(current);
            }
        }, 40);
        return () => clearInterval(interval);
    }, [stats?.meetingsBooked]);

    const rdvGoalPct = stats ? Math.min((stats.meetingsBooked / RDV_WEEKLY_GOAL) * 100, 100) : 0;
    const hotLeads = stats ? stats.resultBreakdown.INTERESTED + stats.resultBreakdown.CALLBACK_REQUESTED : 0;

    const rdvActivity = useMemo(
        () =>
            recentActivity.filter((a) => a.type === "meeting" || a.result === "MEETING_BOOKED"),
        [recentActivity]
    );

    const missionsNearGoal = useMemo(
        () =>
            missions
                .filter((m) => m.isActive && m.meetingsThisPeriod > 0)
                .sort((a, b) => b.meetingsThisPeriod - a.meetingsThisPeriod)
                .slice(0, 5),
        [missions]
    );

    const totalResults = useMemo(() => {
        if (!stats?.resultBreakdown) return 0;
        return Object.values(stats.resultBreakdown).reduce((a, b) => a + b, 0);
    }, [stats]);

    const callResultsPieData = useMemo(() => {
        if (!stats?.resultBreakdown) return [];
        return Object.entries(stats.resultBreakdown)
            .filter(([, v]) => v > 0)
            .map(([key, value]) => ({
                name: PIE_LABELS[key] ?? key,
                value,
                color: PIE_COLORS[key] ?? "#94A3B8",
            }));
    }, [stats?.resultBreakdown]);

    const sparklineData = useMemo(
        () => buildSparklineData(stats?.meetingsBooked ?? 0),
        [stats?.meetingsBooked]
    );

    const weeklyGoalData = useMemo(
        () => buildWeeklyGoalData(stats?.meetingsBooked ?? 0),
        [stats?.meetingsBooked]
    );

    const callbackCount = stats?.resultBreakdown?.CALLBACK_REQUESTED ?? 0;

    if (isLoading && !stats) {
        return (
            <div className="flex items-center justify-center py-32 bg-[#F4F6F9]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-[#7C5CFC] animate-spin" />
                    <p className="text-[13px] text-[#8B8BA7] font-medium">Chargement du tableau de bord...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-[#F4F6F9] p-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Page Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-[22px] font-bold text-[#12122A] tracking-tight">Tableau de bord</h1>
                    <p className="text-[13px] text-[#8B8BA7] mt-0.5">
                        {dateRange.preset
                            ? PRESET_LABELS[dateRange.preset]
                            : dateRange.startDate && dateRange.endDate
                                ? `Du ${new Date(dateRange.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} au ${new Date(dateRange.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
                                : "Période"}{" "}
                        · {missionFilter ? "Mission sélectionnée" : "Toutes les missions"}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative" ref={dateFilterRef}>
                        <button
                            type="button"
                            onClick={() => setDateFilterOpen((o) => !o)}
                            className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#12122A] bg-white border border-[#E8EBF0] rounded-lg hover:border-[#C5C8D4] transition-colors"
                        >
                            <Calendar className="w-4 h-4 text-[#7C5CFC]" />
                            <span>{dateRange.preset ? PRESET_LABELS[dateRange.preset] : "Plage de dates"}</span>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-[#8B8BA7] transition-transform", dateFilterOpen && "rotate-180")} />
                        </button>
                        {dateFilterOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    aria-hidden
                                    onClick={() => setDateFilterOpen(false)}
                                />
                                <div className="absolute right-0 top-full mt-1 z-50 max-w-[calc(100vw-2rem)]">
                                    <DateRangeFilter
                                        value={dateRange}
                                        onChange={(v) => {
                                            setDateRange(v);
                                        }}
                                        onClose={() => setDateFilterOpen(false)}
                                        isOpen={true}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <select
                        value={missionFilter}
                        onChange={(e) => setMissionFilter(e.target.value)}
                        className="px-3 py-2 text-[12px] text-[#334155] bg-white border border-[#E8EBF0] rounded-lg min-w-[160px] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/30 focus:border-[#7C5CFC]"
                    >
                        <option value="">Toutes les missions</option>
                        {missions.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        className="w-8 h-8 rounded-lg border border-[#E8EBF0] flex items-center justify-center text-[#8B8BA7] hover:text-[#12122A] hover:border-[#C5C8D4] transition-colors duration-150 disabled:opacity-50"
                        title="Rafraîchir"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                    <Link
                        href="/manager/missions/new"
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#7C5CFC] to-[#6C4CE0] text-white rounded-lg text-[13px] font-semibold hover:from-[#6C4CE0] hover:to-[#5C3CD0] transition-all duration-150 shadow-sm shadow-[#7C5CFC]/25"
                    >
                        <span>+</span>
                        <span>Nouvelle mission</span>
                    </Link>
                </div>
            </div>

            {/* ZONE 1 — RDV COMMAND */}
            <div className="flex flex-col lg:flex-row gap-4 mb-5">
                {/* Hero KPI */}
                <div className="flex-[2] bg-gradient-to-br from-[#1A1040] to-[#12122A] rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-[#7C5CFC]/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#A78BFA]/5 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#7C5CFC]/20 flex items-center justify-center">
                                    <Trophy className="w-4 h-4 text-[#A78BFA]" />
                                </div>
                                <span className="text-[#8B8BA7] text-[13px] font-medium">RDV décrochés</span>
                            </div>
                            {stats && stats.conversionRate > 0 && (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] text-[11px] font-semibold">
                                    <ArrowUpRight className="w-3 h-3" />
                                    <span>{stats.conversionRate.toFixed(1)}% conv.</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-end gap-3 mt-3">
                            <span
                                className={`text-[52px] font-extrabold text-white leading-none tracking-tight transition-all duration-700 ${
                                    heroAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                                }`}
                            >
                                {heroCount}
                            </span>
                            <span className="text-[#4A4A6A] text-[14px] font-medium mb-2">/ {RDV_WEEKLY_GOAL}</span>
                        </div>
                        <div className="mt-4 mb-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] text-[#6A6A8A]">Objectif hebdomadaire</span>
                                <span className="text-[11px] font-semibold text-[#A78BFA]">{Math.round(rdvGoalPct)}%</span>
                            </div>
                            <div className="h-2 bg-[#1E1E3A] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-[#7C5CFC] to-[#A78BFA] rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${rdvGoalPct}%` }}
                                />
                            </div>
                        </div>
                        <div className="h-[48px] mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={sparklineData}>
                                    <defs>
                                        <linearGradient id="db-spark-grad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="rdv" stroke="#7C5CFC" strokeWidth={2} fill="url(#db-spark-grad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Supporting KPIs */}
                <div className="flex-[1.2] flex flex-col gap-3">
                    <div className="flex-1 bg-white rounded-xl border border-[#E8EBF0] p-4 flex items-center justify-between hover:border-[#C5C8D4] transition-colors duration-150">
                        <div>
                            <div className="text-[11px] text-[#8B8BA7] font-medium mb-0.5">Appels effectués</div>
                            <div className="text-[28px] font-bold text-[#12122A] leading-none">{stats?.totalActions ?? 0}</div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
                            <Phone className="w-5 h-5 text-[#7C5CFC]" />
                        </div>
                    </div>
                    <div className="flex-1 bg-white rounded-xl border border-[#E8EBF0] p-4 flex items-center justify-between hover:border-[#C5C8D4] transition-colors duration-150">
                        <div>
                            <div className="text-[11px] text-[#8B8BA7] font-medium mb-0.5">Leads chauds</div>
                            <div className="text-[28px] font-bold text-[#12122A] leading-none">{hotLeads}</div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] flex items-center justify-center">
                            <Flame className="w-5 h-5 text-[#F59E0B]" />
                        </div>
                    </div>
                    <div className="flex-1 bg-white rounded-xl border border-[#E8EBF0] p-4 flex items-center justify-between hover:border-[#C5C8D4] transition-colors duration-150">
                        <div>
                            <div className="text-[11px] text-[#8B8BA7] font-medium mb-0.5">Taux conversion</div>
                            <div className="text-[28px] font-bold text-[#12122A] leading-none">
                                {stats?.conversionRate?.toFixed(1) ?? "0.0"}
                                <span className="text-[18px] text-[#8B8BA7]">%</span>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-[#10B981]" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ZONE 2 + ZONE 3 */}
            <div className="flex flex-col xl:flex-row gap-4">
                {/* ZONE 2 — Pipeline (60%) */}
                <div className="flex-[3] flex flex-col gap-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        {/* Résultats des appels */}
                        <div className="flex-1 bg-white rounded-xl border border-[#E8EBF0] p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[14px] font-semibold text-[#12122A]">Résultats des appels</h3>
                                <button type="button" className="text-[#8B8BA7] hover:text-[#12122A] transition-colors duration-150 p-1 -m-1 rounded">
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>
                            {callResultsPieData.length > 0 ? (
                                <div className="flex items-center gap-4">
                                    <div className="w-[130px] h-[130px] flex-shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={callResultsPieData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={38}
                                                    outerRadius={58}
                                                    dataKey="value"
                                                    strokeWidth={2}
                                                    stroke="#fff"
                                                >
                                                    {callResultsPieData.map((entry, index) => (
                                                        <Cell key={index} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex-1 space-y-2.5 min-w-0">
                                        {callResultsPieData.map((item, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                                    <span className="text-[12px] text-[#5A5A7A] truncate">{item.name}</span>
                                                </div>
                                                <span className="text-[12px] font-semibold text-[#12122A] flex-shrink-0 ml-2">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[13px] text-[#8B8BA7] py-4">Aucun résultat pour cette période</p>
                            )}
                        </div>

                        {/* Leads à relancer */}
                        <div className="flex-1 bg-white rounded-xl border border-[#E8EBF0] p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[14px] font-semibold text-[#12122A]">Leads à relancer</h3>
                                <span className="text-[11px] font-medium text-[#7C5CFC] bg-[#EEF2FF] px-2 py-0.5 rounded-full">
                                    {callbackCount} en attente
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                                <Clock className="w-4 h-4 text-[#F59E0B]" />
                                <div>
                                    <p className="text-[12px] font-semibold text-[#12122A]">{callbackCount} rappels en attente</p>
                                    <p className="text-[11px] text-[#8B8BA7]">{stats?.resultBreakdown?.INTERESTED ?? 0} contacts intéressés</p>
                                </div>
                            </div>
                            <Link
                                href="/manager/prospection"
                                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#7C5CFC] hover:underline"
                            >
                                Voir la queue <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    {/* Missions proches de l'objectif */}
                    <div className="bg-white rounded-xl border border-[#E8EBF0] p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[14px] font-semibold text-[#12122A]">Missions proches de l'objectif</h3>
                            <Link href="/manager/missions" className="text-[12px] text-[#7C5CFC] font-medium hover:underline transition-colors duration-150">
                                Voir toutes
                            </Link>
                        </div>
                        {missionsNearGoal.length === 0 ? (
                            <p className="text-[13px] text-[#8B8BA7] py-2">Aucune mission active avec des RDV</p>
                        ) : (
                            <div className="space-y-4">
                                {missionsNearGoal.map((m) => {
                                    const goal = 20;
                                    const pct = Math.min(100, Math.round((m.meetingsThisPeriod / goal) * 100));
                                    return (
                                        <Link key={m.id} href={`/manager/missions/${m.id}`} className="block group">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[12px] font-medium text-[#12122A] group-hover:text-[#7C5CFC] transition-colors">{m.name}</span>
                                                <span className="text-[11px] text-[#8B8BA7]">{m.meetingsThisPeriod}/{goal} RDV</span>
                                            </div>
                                            <div className="h-2 bg-[#F4F6F9] rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        pct >= 80 ? "bg-gradient-to-r from-[#7C5CFC] to-[#A78BFA]" : pct >= 60 ? "bg-[#F59E0B]" : "bg-[#E2E8F0]"
                                                    }`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ZONE 3 — Performance humaine (40%) */}
                <div className="flex-[2] flex flex-col gap-4">
                    {/* Leaderboard RDV */}
                    <div className="bg-white rounded-xl border border-[#E8EBF0] p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[14px] font-semibold text-[#12122A]">Leaderboard RDV</h3>
                            <div
                                className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                                    rdvGoalPct >= 100 ? "bg-[#F0FDF4] text-[#10B981]" : rdvGoalPct >= 80 ? "bg-[#F0FDF4] text-[#10B981]" : "bg-[#FEF3C7] text-[#B45309]"
                                }`}
                            >
                                <Flame className="w-3 h-3" />
                                <span>
                                    {rdvGoalPct >= 100 ? "Objectif atteint" : rdvGoalPct >= 80 ? "En avance" : `${Math.round(100 - rdvGoalPct)}% restant`}
                                </span>
                            </div>
                        </div>
                        {stats?.rdvLeaderboard?.length ? (
                            <div className="space-y-2.5">
                                {stats.rdvLeaderboard.map((person, i) => (
                                    <div key={person.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#F9FAFB] transition-colors duration-150">
                                        <span
                                            className={`w-5 text-[12px] font-bold ${
                                                i === 0 ? "text-[#F59E0B]" : i === 1 ? "text-[#8B8BA7]" : i === 2 ? "text-[#B45309]" : "text-[#C5C8D4]"
                                            }`}
                                        >
                                            {i + 1}
                                        </span>
                                        <div
                                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                                i === 0 ? "bg-gradient-to-br from-[#7C5CFC] to-[#A78BFA]" : "bg-[#C5C8D4]"
                                            }`}
                                        >
                                            {getInitials(person.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-medium text-[#12122A] truncate">{person.name}</div>
                                            <div className="text-[10px] text-[#8B8BA7]">{person.actions} appels</div>
                                        </div>
                                        <span className="text-[13px] font-bold text-[#12122A]">{person.rdv}</span>
                                        <span className="text-[10px] text-[#8B8BA7]">RDV</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[13px] text-[#8B8BA7] py-2">Pas encore de RDV sur cette période</p>
                        )}
                    </div>

                    {/* Objectif hebdo */}
                    <div className="bg-white rounded-xl border border-[#E8EBF0] p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-[14px] font-semibold text-[#12122A]">Objectif hebdo</h3>
                            <span className="text-[11px] text-[#8B8BA7]">
                                Réalisé : {stats?.meetingsBooked ?? 0} / {RDV_WEEKLY_GOAL}
                            </span>
                        </div>
                        <div className="h-[110px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={weeklyGoalData}>
                                    <XAxis dataKey="jour" tick={{ fontSize: 10, fill: "#8B8BA7" }} axisLine={false} tickLine={false} />
                                    <YAxis hide domain={[0, 35]} />
                                    <Tooltip
                                        contentStyle={{
                                            fontSize: 11,
                                            borderRadius: 8,
                                            border: "1px solid #E8EBF0",
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                        }}
                                    />
                                    <Line type="monotone" dataKey="objectif" stroke="#E2E8F0" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Objectif" />
                                    <Line type="monotone" dataKey="cumul" stroke="#7C5CFC" strokeWidth={2.5} dot={false} name="Réalisé" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Activité récente RDV */}
                    <div className="bg-white rounded-xl border border-[#E8EBF0] p-5">
                        <h3 className="text-[14px] font-semibold text-[#12122A] mb-3">Activité récente</h3>
                        {rdvActivity.length === 0 ? (
                            <p className="text-[13px] text-[#8B8BA7] py-2">Aucun RDV sur cette période</p>
                        ) : (
                            <div className="space-y-3">
                                {rdvActivity.slice(0, 8).map((item) => (
                                    <div key={item.id} className="flex items-start gap-2.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#7C5CFC] mt-1.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] text-[#5A5A7A] leading-relaxed">
                                                <span className="font-semibold text-[#12122A]">{item.user}</span>
                                                {" "}a décroché un RDV{" "}
                                                {item.contactOrCompanyName && (
                                                    <>
                                                        avec <span className="font-semibold text-[#7C5CFC]">{item.contactOrCompanyName}</span>
                                                    </>
                                                )}
                                            </p>
                                            <span className="text-[10px] text-[#B0B3C0]">{item.time}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
