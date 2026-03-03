"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui";
import { ReglagesTab } from "./ReglagesTab";
import {
    Users,
    Clock,
    TrendingUp,
    Target,
    Phone,
    Calendar,
    Activity,
    Award,
    BarChart3,
    ChevronRight,
    RefreshCw,
    Loader2,
    Zap,
    Trophy,
    Medal,
    Crown,
    Flame,
    Eye,
    UserPlus,
    Mail,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    LayoutGrid,
    List,
    Download,
    AlertCircle,
    Settings,
    Globe,
    LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    lastSignInAt?: string | null;
    lastSignInIp?: string | null;
    lastSignInCountry?: string | null;
    lastConnectedAt?: string | null;
    _count: {
        assignedMissions: number;
        actions: number;
    };
    metrics?: TeamMemberMetrics;
}

interface TeamMemberMetrics {
    scheduledHoursThisWeek: number;
    scheduledHoursThisMonth: number;
    completedHoursThisWeek: number;
    completedHoursThisMonth: number;
    callsToday: number;
    callsThisWeek: number;
    callsThisMonth: number;
    avgCallsPerHour: number;
    meetingsBooked: number;
    meetingsBookedThisWeek: number;
    conversionRate: number;
    lastActiveAt: string | null;
    lastSeenMinutesAgo?: number | null;
    currentMission: string | null;
    activeBlockId: string | null;
    status: "online" | "busy" | "away" | "offline";
    dailyHours: { day: string; scheduled: number; completed: number }[];
    currentStreak: number;
    weeklyRank: number;
    monthlyScore: number;
}

interface ScheduleBlock {
    id: string;
    sdrId: string;
    missionId: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    mission: {
        id: string;
        name: string;
        client?: { name: string };
    };
}

interface TeamStats {
    totalMembers: number;
    activeMembers: number;
    totalScheduledHours: number;
    totalCompletedHours: number;
    utilizationRate: number;
    totalCalls: number;
    totalMeetings: number;
    avgConversionRate: number;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_CONFIG = {
    online: { color: "bg-emerald-500", ring: "ring-emerald-500/20", label: "En ligne", pulse: true },
    busy: { color: "bg-amber-500", ring: "ring-amber-500/20", label: "Occupé", pulse: true },
    away: { color: "bg-slate-400", ring: "ring-slate-400/20", label: "Absent", pulse: false },
    offline: { color: "bg-slate-300", ring: "ring-slate-300/20", label: "Hors ligne", pulse: false },
};

const ROLE_LABELS: Record<string, string> = {
    SDR: "SDR",
    BUSINESS_DEVELOPER: "Business Dev",
    MANAGER: "Manager",
    DEVELOPER: "Développeur",
};

const ROLE_STYLES: Record<string, { bg: string; text: string }> = {
    SDR: { bg: "bg-blue-50", text: "text-blue-700" },
    BUSINESS_DEVELOPER: { bg: "bg-emerald-50", text: "text-emerald-700" },
    MANAGER: { bg: "bg-indigo-50", text: "text-indigo-700" },
    DEVELOPER: { bg: "bg-purple-50", text: "text-purple-700" },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getWeekDates(): Date[] {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    return Array.from({ length: 5 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });
}

function formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
}

function calcHours(start: string, end: string): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return (eh * 60 + em - sh * 60 - sm) / 60;
}

function formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

function formatSessionDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ============================================
// PREMIUM STAT CARD
// ============================================

function StatCard({
    icon: Icon,
    label,
    value,
    subValue,
    trend,
    accent,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    subValue?: string;
    trend?: { value: number; isPositive: boolean };
    accent: string; // gradient classes
}) {
    return (
        <div className="team-stat-card group">
            <div className="flex items-start justify-between">
                <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-500">{label}</p>
                    <p className="text-[2rem] font-extrabold text-slate-900 leading-tight tracking-tight mt-1">{value}</p>
                    {subValue && (
                        <p className="text-[13px] text-slate-400 mt-1">{subValue}</p>
                    )}
                    {trend && (
                        <div className={cn(
                            "inline-flex items-center gap-1 mt-2 text-[13px] font-semibold px-2 py-0.5 rounded-md",
                            trend.isPositive
                                ? "text-emerald-700 bg-emerald-50"
                                : "text-rose-700 bg-rose-50"
                        )}>
                            {trend.isPositive ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                            )}
                            {trend.value}%
                        </div>
                    )}
                </div>
                <div className={cn(
                    "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300",
                    accent
                )}>
                    <Icon className="w-5.5 h-5.5 text-white" />
                </div>
            </div>
        </div>
    );
}

// ============================================
// HOURS BREAKDOWN BAR
// ============================================

function HoursBar({
    scheduled,
    completed,
    maxHours = 40,
}: {
    scheduled: number;
    completed: number;
    maxHours?: number;
}) {
    const scheduledPct = Math.min((scheduled / maxHours) * 100, 100);
    const completedPct = Math.min((completed / maxHours) * 100, 100);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Heures</span>
                <span className="font-medium text-slate-700 tabular-nums">
                    {formatHours(completed)} / {formatHours(scheduled)}
                </span>
            </div>
            <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="absolute inset-y-0 left-0 bg-indigo-200 rounded-full transition-all duration-700"
                    style={{ width: `${scheduledPct}%` }}
                />
                <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-700"
                    style={{ width: `${completedPct}%` }}
                />
            </div>
        </div>
    );
}

// ============================================
// MINI DAILY CHART
// ============================================

function MiniDailyChart({ data }: { data: { day: string; scheduled: number; completed: number }[] }) {
    const max = Math.max(...data.map(d => Math.max(d.scheduled, d.completed)), 4);

    return (
        <div className="flex items-end justify-between gap-1.5 h-14">
            {data.map((d, i) => (
                <div key={`${d.day}-${i}`} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center gap-px h-10">
                        <div
                            className="w-[5px] bg-indigo-100 rounded-t-sm transition-all duration-500"
                            style={{ height: `${Math.max((d.scheduled / max) * 100, 4)}%` }}
                        />
                        <div
                            className="w-[5px] bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-t-sm transition-all duration-500"
                            style={{ height: `${Math.max((d.completed / max) * 100, 4)}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{d.day}</span>
                </div>
            ))}
        </div>
    );
}

// ============================================
// RANK BADGE
// ============================================

function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) {
        return (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full text-white text-xs font-bold shadow-md shadow-amber-300/30">
                <Crown className="w-3 h-3" />
                <span>#1</span>
            </div>
        );
    }
    if (rank === 2) {
        return (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-slate-300 to-slate-400 rounded-full text-white text-xs font-bold">
                <Medal className="w-3 h-3" />
                <span>#2</span>
            </div>
        );
    }
    if (rank === 3) {
        return (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full text-white text-xs font-bold">
                <Award className="w-3 h-3" />
                <span>#3</span>
            </div>
        );
    }
    return (
        <div className="px-2.5 py-1 bg-slate-100 rounded-full text-slate-500 text-xs font-semibold">
            #{rank}
        </div>
    );
}

// ============================================
// MEMBER CARD — Apple-inspired design
// ============================================

function MemberCard({
    member,
    onViewDetails,
}: {
    member: TeamMember;
    onViewDetails: () => void;
}) {
    const metrics = member.metrics || {
        scheduledHoursThisWeek: 0,
        completedHoursThisWeek: 0,
        callsThisWeek: 0,
        callsToday: 0,
        avgCallsPerHour: 0,
        meetingsBookedThisWeek: 0,
        conversionRate: 0,
        lastActiveAt: null,
        lastSeenMinutesAgo: null,
        status: "offline" as const,
        currentMission: null,
        currentStreak: 0,
        weeklyRank: 0,
        dailyHours: [
            { day: "L", scheduled: 0, completed: 0 },
            { day: "M", scheduled: 0, completed: 0 },
            { day: "M", scheduled: 0, completed: 0 },
            { day: "J", scheduled: 0, completed: 0 },
            { day: "V", scheduled: 0, completed: 0 },
        ],
    };

    const roleStyle = ROLE_STYLES[member.role] || ROLE_STYLES.SDR;
    const statusCfg = STATUS_CONFIG[metrics.status] ?? STATUS_CONFIG.offline;

    // Avatar gradient per role
    const avatarGradient = member.role === "BUSINESS_DEVELOPER"
        ? "from-emerald-100 to-emerald-200 text-emerald-700"
        : "from-indigo-100 to-indigo-200 text-indigo-700";

    return (
        <div
            onClick={onViewDetails}
            className="team-member-card group cursor-pointer"
        >
            {/* Top section: avatar + basic info */}
            <div className="flex items-start gap-4 p-5 pb-4">
                {/* Avatar + status */}
                <div className="relative flex-shrink-0">
                    <div className={cn(
                        "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-lg font-bold transition-transform duration-300 group-hover:scale-105",
                        avatarGradient
                    )}>
                        {getInitials(member.name)}
                    </div>
                    <span
                        className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[2.5px] border-white",
                            statusCfg.color,
                            statusCfg.pulse && "animate-pulse"
                        )}
                        title={statusCfg.label}
                    />
                </div>

                {/* Name + role + status */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[15px] font-bold text-slate-900 truncate">{member.name}</h3>
                        {metrics.weeklyRank > 0 && metrics.weeklyRank <= 3 && (
                            <RankBadge rank={metrics.weeklyRank} />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "px-2 py-0.5 rounded-md text-[11px] font-semibold",
                            roleStyle.bg, roleStyle.text
                        )}>
                            {ROLE_LABELS[member.role] || member.role}
                        </span>
                        <span className="text-xs text-slate-400">{statusCfg.label}</span>
                    </div>
                </div>

                {/* View details arrow */}
                <div className="p-2 rounded-xl text-slate-300 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all duration-200 opacity-0 group-hover:opacity-100">
                    <ChevronRight className="w-4 h-4" />
                </div>
            </div>

            {/* Current mission banner */}
            {metrics.currentMission && (
                <div className="mx-5 mb-3 px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100/50">
                    <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-indigo-500 animate-pulse flex-shrink-0" />
                        <span className="text-[13px] text-indigo-700 font-medium truncate">
                            {metrics.currentMission}
                        </span>
                    </div>
                </div>
            )}

            {/* Quick stats — 3 columns */}
            <div className="px-5 pb-4">
                <div className="grid grid-cols-3 gap-2">
                    <div className="text-center py-2.5 bg-slate-50 rounded-xl">
                        <div className="flex items-center justify-center mb-1">
                            <Phone className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <p className="text-lg font-bold text-slate-900 leading-none">{metrics.callsThisWeek}</p>
                        <p className="text-[11px] text-slate-400 mt-1">Appels</p>
                    </div>
                    <div className="text-center py-2.5 bg-slate-50 rounded-xl">
                        <div className="flex items-center justify-center mb-1">
                            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                        <p className="text-lg font-bold text-slate-900 leading-none">{metrics.meetingsBookedThisWeek}</p>
                        <p className="text-[11px] text-slate-400 mt-1">RDV</p>
                    </div>
                    <div className="text-center py-2.5 bg-slate-50 rounded-xl">
                        <div className="flex items-center justify-center mb-1">
                            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <p className="text-lg font-bold text-slate-900 leading-none">{metrics.conversionRate}%</p>
                        <p className="text-[11px] text-slate-400 mt-1">Conv.</p>
                    </div>
                </div>
            </div>

            {/* Hours + mini chart */}
            <div className="px-5 pb-4 space-y-3">
                <HoursBar
                    scheduled={metrics.scheduledHoursThisWeek}
                    completed={metrics.completedHoursThisWeek}
                />
                <MiniDailyChart data={metrics.dailyHours} />
            </div>

            {/* Session / Sign-in info */}
            {(member.lastConnectedAt || member.lastSignInAt || member.lastSignInIp || member.lastSignInCountry) && (
                <div className="px-5 pb-3 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        {metrics.lastActiveAt && (
                            <span className="flex items-center gap-1" title="Dernière activité dans l'app">
                                <Activity className="w-3 h-3 text-slate-400" />
                                Activité: {formatSessionDate(metrics.lastActiveAt)}
                            </span>
                        )}
                        {member.lastConnectedAt && (
                            <span className="flex items-center gap-1" title="Dernière connexion (app)">
                                <Activity className="w-3 h-3 text-slate-400" />
                                Connexion: {formatSessionDate(member.lastConnectedAt)}
                            </span>
                        )}
                        {member.lastSignInAt && (
                            <span className="flex items-center gap-1" title="Dernière connexion (login)">
                                <LogIn className="w-3 h-3 text-slate-400" />
                                Login: {formatSessionDate(member.lastSignInAt)}
                            </span>
                        )}
                        {member.lastSignInIp && (
                            <span className="tabular-nums" title="IP">
                                IP: {member.lastSignInIp}
                            </span>
                        )}
                        {member.lastSignInCountry && (
                            <span className="flex items-center gap-1" title="Pays">
                                <Globe className="w-3 h-3 text-slate-400" />
                                {member.lastSignInCountry}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between rounded-b-2xl">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{metrics.avgCallsPerHour} appels/h</span>
                </div>
                <span className="text-xs font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors flex items-center gap-1">
                    Voir détails
                    <ChevronRight className="w-3 h-3" />
                </span>
            </div>
        </div>
    );
}

// ============================================
// MEMBER LIST ROW — Compact alternative view
// ============================================

function MemberListRow({
    member,
    onViewDetails,
}: {
    member: TeamMember;
    onViewDetails: () => void;
}) {
    const metrics = member.metrics;
    const statusCfg = STATUS_CONFIG[metrics?.status ?? "offline"];
    const roleStyle = ROLE_STYLES[member.role] || ROLE_STYLES.SDR;

    return (
        <div
            onClick={onViewDetails}
            className="team-list-row group cursor-pointer"
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-sm font-bold text-indigo-700">
                    {getInitials(member.name)}
                </div>
                <span className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                    statusCfg.color
                )} />
            </div>

            {/* Name + role */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-slate-900 truncate">{member.name}</span>
                    {metrics?.weeklyRank && metrics.weeklyRank <= 3 && (
                        <RankBadge rank={metrics.weeklyRank} />
                    )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded", roleStyle.bg, roleStyle.text)}>
                        {ROLE_LABELS[member.role] || member.role}
                    </span>
                    {metrics?.currentMission && (
                        <span className="text-xs text-indigo-600 truncate max-w-[140px]">
                            {metrics.currentMission}
                        </span>
                    )}
                </div>
                {(member.lastConnectedAt || member.lastSignInAt || member.lastSignInIp || member.lastSignInCountry) && (
                    <div className="flex flex-wrap items-center gap-x-2 mt-1 text-[10px] text-slate-400">
                        {member.lastConnectedAt && <span>Connexion: {formatSessionDate(member.lastConnectedAt)}</span>}
                        {member.lastSignInAt && member.lastSignInAt !== member.lastConnectedAt && (
                            <span>Login: {formatSessionDate(member.lastSignInAt)}</span>
                        )}
                        {member.lastSignInIp && <span>IP: {member.lastSignInIp}</span>}
                        {member.lastSignInCountry && <span>{member.lastSignInCountry}</span>}
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6">
                <div className="text-center">
                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{metrics?.callsThisWeek ?? 0}</p>
                    <p className="text-[10px] text-slate-400">Appels</p>
                </div>
                <div className="text-center">
                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{metrics?.meetingsBookedThisWeek ?? 0}</p>
                    <p className="text-[10px] text-slate-400">RDV</p>
                </div>
                <div className="text-center">
                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{metrics?.conversionRate ?? 0}%</p>
                    <p className="text-[10px] text-slate-400">Conv.</p>
                </div>
                <div className="text-center min-w-[60px]">
                    <p className="text-[15px] font-bold text-slate-900 tabular-nums">{formatHours(metrics?.completedHoursThisWeek ?? 0)}</p>
                    <p className="text-[10px] text-slate-400">Heures</p>
                </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
        </div>
    );
}

// ============================================
// LEADERBOARD
// ============================================

function Leaderboard({
    members,
    metric,
}: {
    members: TeamMember[];
    metric: "calls" | "meetings" | "hours";
}) {
    const sorted = useMemo(() => {
        return [...members]
            .filter(m => m.metrics)
            .sort((a, b) => {
                const am = a.metrics!;
                const bm = b.metrics!;
                switch (metric) {
                    case "calls": return bm.callsThisWeek - am.callsThisWeek;
                    case "meetings": return bm.meetingsBookedThisWeek - am.meetingsBookedThisWeek;
                    case "hours": return bm.completedHoursThisWeek - am.completedHoursThisWeek;
                    default: return 0;
                }
            })
            .slice(0, 5);
    }, [members, metric]);

    const getValue = (m: TeamMemberMetrics) => {
        switch (metric) {
            case "calls": return m.callsThisWeek;
            case "meetings": return m.meetingsBookedThisWeek;
            case "hours": return formatHours(m.completedHoursThisWeek);
        }
    };

    const getUnit = () => {
        switch (metric) {
            case "calls": return "appels";
            case "meetings": return "RDV";
            case "hours": return "";
        }
    };

    const maxValue = Math.max(
        ...sorted.map(m => {
            const metrics = m.metrics!;
            switch (metric) {
                case "calls": return metrics.callsThisWeek;
                case "meetings": return metrics.meetingsBookedThisWeek;
                case "hours": return metrics.completedHoursThisWeek;
            }
        }),
        1
    );

    return (
        <div className="space-y-3">
            {sorted.length === 0 && (
                <p className="text-[13px] text-slate-400 py-4 text-center">Pas encore de données</p>
            )}
            {sorted.map((member, index) => {
                const metrics = member.metrics!;
                const numericValue = metric === "hours"
                    ? metrics.completedHoursThisWeek
                    : metric === "calls"
                        ? metrics.callsThisWeek
                        : metrics.meetingsBookedThisWeek;
                const percentage = (numericValue / maxValue) * 100;

                return (
                    <div key={member.id} className="flex items-center gap-3 py-1.5">
                        <RankBadge rank={index + 1} />
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                            {getInitials(member.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[13px] font-semibold text-slate-900 truncate">
                                    {member.name}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[14px] font-bold text-indigo-600 tabular-nums">
                                        {getValue(metrics)}
                                    </span>
                                    {getUnit() && (
                                        <span className="text-[11px] text-slate-400">{getUnit()}</span>
                                    )}
                                </div>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-700"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ============================================
// UTILIZATION HEATMAP
// ============================================

function UtilizationHeatmap({
    members,
}: {
    members: TeamMember[];
}) {
    const dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

    return (
        <div className="space-y-2.5">
            {/* Header */}
            <div className="flex items-center gap-2 pl-28">
                {dayLabels.map((day, i) => (
                    <div key={i} className="flex-1 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Rows */}
            {members.slice(0, 8).map((member) => {
                const dailyHours = member.metrics?.dailyHours || [];

                return (
                    <div key={member.id} className="flex items-center gap-2">
                        <div className="w-28 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0">
                                {getInitials(member.name)}
                            </div>
                            <span className="text-[13px] text-slate-700 truncate font-medium">
                                {member.name.split(" ")[0]}
                            </span>
                        </div>
                        {dailyHours.map((d, i) => {
                            const pct = d.scheduled > 0
                                ? (d.completed / d.scheduled) * 100
                                : 0;

                            let bgClass = "bg-slate-50 text-slate-400";
                            if (d.scheduled > 0) {
                                if (pct >= 100) bgClass = "bg-emerald-400 text-white";
                                else if (pct >= 75) bgClass = "bg-emerald-200 text-emerald-800";
                                else if (pct >= 50) bgClass = "bg-amber-200 text-amber-800";
                                else if (pct >= 25) bgClass = "bg-amber-100 text-amber-700";
                                else bgClass = "bg-rose-100 text-rose-700";
                            }

                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex-1 h-9 rounded-lg flex items-center justify-center text-[11px] font-semibold transition-colors",
                                        bgClass
                                    )}
                                    title={`${formatHours(d.completed)} / ${formatHours(d.scheduled)}`}
                                >
                                    {d.scheduled > 0 ? `${Math.round(pct)}%` : "–"}
                                </div>
                            );
                        })}
                    </div>
                );
            })}

            {/* Legend */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">Utilisation :</span>
                {[
                    { bg: "bg-rose-100", label: "<25%" },
                    { bg: "bg-amber-100", label: "25-50%" },
                    { bg: "bg-amber-200", label: "50-75%" },
                    { bg: "bg-emerald-200", label: "75-100%" },
                    { bg: "bg-emerald-400", label: "100%+" },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1">
                        <div className={cn("w-3.5 h-3.5 rounded", item.bg)} />
                        <span className="text-[10px] text-slate-500">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================
// ACTIVITY FEED
// ============================================

function ActivityFeed({
    activities,
}: {
    activities: { id: string; user: string; action: string; time: string; type: "call" | "meeting" | "schedule" }[];
}) {
    const typeConfig = {
        call: { icon: Phone, color: "text-blue-500", bg: "bg-blue-50" },
        meeting: { icon: Calendar, color: "text-emerald-500", bg: "bg-emerald-50" },
        schedule: { icon: Clock, color: "text-amber-500", bg: "bg-amber-50" },
    };

    return (
        <div className="space-y-2">
            {activities.length === 0 && (
                <p className="text-[13px] text-slate-400 py-4 text-center">Aucune activité récente</p>
            )}
            {activities.map((activity) => {
                const config = typeConfig[activity.type];
                const Icon = config.icon;

                return (
                    <div key={activity.id} className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            config.bg
                        )}>
                            <Icon className={cn("w-3.5 h-3.5", config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-slate-700 truncate">
                                <span className="font-semibold">{activity.user}</span>
                                {" "}{activity.action}
                            </p>
                        </div>
                        <span className="text-[12px] text-slate-400 tabular-nums whitespace-nowrap">{activity.time}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

type TeamPageTab = "equipe" | "reglages";

export default function TeamDashboardPage() {
    const searchParams = useSearchParams();
    const { success, error: showError } = useToast();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
    const [recentActivities, setRecentActivities] = useState<{ id: string; user: string; action: string; time: string; type: "call" | "meeting" | "schedule" }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [leaderboardMetric, setLeaderboardMetric] = useState<"calls" | "meetings" | "hours">("calls");
    const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
    const [mounted, setMounted] = useState(false);

    const tabFromUrl = (searchParams.get("tab") === "reglages" ? "reglages" : "equipe") as TeamPageTab;
    const [activeTab, setActiveTab] = useState<TeamPageTab>(tabFromUrl);
    useEffect(() => {
        setActiveTab(tabFromUrl);
    }, [tabFromUrl]);
    const setTab = useCallback((tab: TeamPageTab) => {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        if (tab === "reglages") url.searchParams.set("tab", "reglages");
        else url.searchParams.delete("tab");
        window.history.replaceState({}, "", url.pathname + url.search);
    }, []);

    const [trendData, setTrendData] = useState<{
        hours: { change: number; isPositive: boolean };
        calls: { change: number; isPositive: boolean };
        meetings: { change: number; isPositive: boolean };
    } | null>(null);

    const weekDates = useMemo(() => getWeekDates(), []);

    useEffect(() => { setMounted(true); }, []);

    // ============================================
    // FETCH DATA
    // ============================================

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersRes, blocksRes, actionsRes, activitiesRes, trendsRes, dailyActivityRes] = await Promise.all([
                fetch("/api/users?role=SDR,BUSINESS_DEVELOPER"),
                fetch(`/api/planning?startDate=${formatDate(weekDates[0])}&endDate=${formatDate(weekDates[4])}`),
                fetch("/api/actions/stats"),
                fetch("/api/actions/recent?limit=8"),
                fetch("/api/analytics/team-trends"),
                fetch(`/api/analytics/daily-activity?startDate=${formatDate(weekDates[0])}&endDate=${formatDate(weekDates[4])}`),
            ]);

            const usersJson = await usersRes.json();
            const blocksJson = await blocksRes.json();
            const actionsJson = await actionsRes.json();
            const activitiesJson = await activitiesRes.json();
            const trendsJson = await trendsRes.json();
            const dailyActivityJson = await dailyActivityRes.json();

            let teamMembers: TeamMember[] = [];
            let scheduleBlocks: ScheduleBlock[] = [];
            let actionStats: Record<string, any> = {};
            let dailyActivityData: Record<string, Record<string, number>> = {};

            if (usersJson.success) {
                teamMembers = usersJson.data.users || usersJson.data || [];
            }
            if (blocksJson.success) {
                scheduleBlocks = blocksJson.data.blocks || blocksJson.data || [];
            }
            if (actionsJson.success) {
                actionStats = actionsJson.data || {};
            }
            if (trendsJson.success) {
                setTrendData(trendsJson.data);
            }
            if (dailyActivityJson.success) {
                dailyActivityData = dailyActivityJson.data || {};
            }
            if (activitiesJson.success) {
                setRecentActivities(activitiesJson.data || []);
            }

            // Fetch SDR activity status
            const sdrAndBd = teamMembers.filter(m => ["SDR", "BUSINESS_DEVELOPER"].includes(m.role));
            const activityByUserId = new Map<string, { isActive: boolean; status: string; lastSeenMinutesAgo: number | null }>();
            if (sdrAndBd.length > 0) {
                try {
                    const ids = sdrAndBd.map((m) => m.id).join(",");
                    const activityRes = await fetch(`/api/sdr/activity/batch?userIds=${encodeURIComponent(ids)}`);
                    const activityJson = await activityRes.json();
                    if (activityJson.success && activityJson.data) {
                        for (const [uid, raw] of Object.entries(activityJson.data as Record<string, { isActive: boolean; status: string; lastSeenMinutesAgo: number | null }>)) {
                            const isActive = raw?.isActive ?? false;
                            const status = raw?.status ?? "offline";
                            const lastSeenMinutesAgo = typeof raw?.lastSeenMinutesAgo === "number"
                                ? raw.lastSeenMinutesAgo
                                : null;
                            activityByUserId.set(uid, { isActive, status, lastSeenMinutesAgo });
                        }
                    }
                } catch { /* fallback: all offline */ }
            }

            // Compute metrics for each member
            const membersWithMetrics = teamMembers.map((member, index) => {
                const memberBlocks = scheduleBlocks.filter(b => b.sdrId === member.id);
                const memberStats = actionStats[member.id] || {};

                const dailyHours = weekDates.map((date, dayIndex) => {
                    const dateStr = formatDate(date);
                    const dayBlocks = memberBlocks.filter(b => b.date.split("T")[0] === dateStr);
                    const scheduled = dayBlocks.reduce((sum, b) => sum + calcHours(b.startTime, b.endTime), 0);
                    const memberActivityData = dailyActivityData[member.id] || {};
                    const completed = memberActivityData[dateStr] || 0;

                    return {
                        day: ["L", "M", "M", "J", "V"][dayIndex],
                        date: dateStr,
                        scheduled,
                        completed,
                    };
                });

                const scheduledHoursThisWeek = dailyHours.reduce((sum, d) => sum + d.scheduled, 0);
                const completedHoursThisWeek = dailyHours.reduce((sum, d) => sum + d.completed, 0);

                const now = new Date();
                const currentDateStr = formatDate(now);
                const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

                const activeBlock = memberBlocks.find(b => {
                    const blockDate = b.date.split("T")[0];
                    return blockDate === currentDateStr &&
                        b.startTime <= currentTime &&
                        b.endTime > currentTime &&
                        b.status !== "CANCELLED";
                });

                const activityEntry = activityByUserId.get(member.id);
                const isActiveFromChrono = activityEntry?.isActive === true;

                let status: "online" | "busy" | "away" | "offline" = "offline";
                if (isActiveFromChrono) {
                    status = activeBlock?.status === "IN_PROGRESS" ? "busy" : "online";
                } else if (activeBlock) {
                    status = activeBlock.status === "IN_PROGRESS" ? "busy" : "online";
                } else if (member.isActive) {
                    const hasBlockToday = memberBlocks.some(b => b.date.split("T")[0] === currentDateStr);
                    status = hasBlockToday ? "away" : "offline";
                }

                const callsThisWeek = memberStats.callsThisWeek || member._count?.actions || 0;
                const meetingsBookedThisWeek = memberStats.meetingsThisWeek || 0;
                const callsToday = memberStats.callsToday || 0;
                const conversionRate = memberStats.conversionRate ||
                    (callsThisWeek > 0 ? Number(((meetingsBookedThisWeek / callsThisWeek) * 100).toFixed(1)) : 0);

                return {
                    ...member,
                    metrics: {
                        scheduledHoursThisWeek,
                        scheduledHoursThisMonth: scheduledHoursThisWeek * 4,
                        completedHoursThisWeek,
                        completedHoursThisMonth: completedHoursThisWeek * 4,
                        callsToday,
                        callsThisWeek,
                        callsThisMonth: memberStats.callsThisMonth || callsThisWeek * 4,
                        avgCallsPerHour: completedHoursThisWeek > 0
                            ? Number((callsThisWeek / completedHoursThisWeek).toFixed(1))
                            : 0,
                        meetingsBooked: memberStats.meetingsBooked || meetingsBookedThisWeek,
                        meetingsBookedThisWeek,
                        conversionRate,
                        lastActiveAt: activityEntry?.lastSeenMinutesAgo != null
                            ? new Date(now.getTime() - activityEntry.lastSeenMinutesAgo * 60000).toISOString()
                            : null,
                        lastSeenMinutesAgo: activityEntry?.lastSeenMinutesAgo ?? null,
                        currentMission: activeBlock?.mission?.name || null,
                        activeBlockId: activeBlock?.id || null,
                        status,
                        dailyHours,
                        currentStreak: 0,
                        weeklyRank: index + 1,
                        monthlyScore: memberStats.monthlyScore || (callsThisWeek + meetingsBookedThisWeek * 10),
                    },
                };
            });

            // Sort by weekly performance
            membersWithMetrics.sort((a, b) => {
                const aScore = (a.metrics?.callsThisWeek || 0) + (a.metrics?.meetingsBookedThisWeek || 0) * 10;
                const bScore = (b.metrics?.callsThisWeek || 0) + (b.metrics?.meetingsBookedThisWeek || 0) * 10;
                return bScore - aScore;
            });

            membersWithMetrics.forEach((m, i) => {
                if (m.metrics) m.metrics.weeklyRank = i + 1;
            });

            setMembers(membersWithMetrics);
            setBlocks(scheduleBlocks);

        } catch (err) {
            console.error("Error fetching team data:", err);
            showError("Erreur", "Impossible de charger les données de l'équipe");
        } finally {
            setIsLoading(false);
        }
    }, [weekDates, showError]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ============================================
    // COMPUTED VALUES
    // ============================================

    const filteredMembers = useMemo(() => {
        return members.filter(m => {
            const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.email.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = roleFilter === "all" || m.role === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [members, searchQuery, roleFilter]);

    const teamStats: TeamStats = useMemo(() => {
        const stats = {
            totalMembers: members.length,
            activeMembers: members.filter(m => m.metrics?.status !== "offline").length,
            totalScheduledHours: members.reduce((sum, m) => sum + (m.metrics?.scheduledHoursThisWeek || 0), 0),
            totalCompletedHours: members.reduce((sum, m) => sum + (m.metrics?.completedHoursThisWeek || 0), 0),
            utilizationRate: 0,
            totalCalls: members.reduce((sum, m) => sum + (m.metrics?.callsThisWeek || 0), 0),
            totalMeetings: members.reduce((sum, m) => sum + (m.metrics?.meetingsBookedThisWeek || 0), 0),
            avgConversionRate: 0,
        };

        if (stats.totalScheduledHours > 0) {
            stats.utilizationRate = Math.round((stats.totalCompletedHours / stats.totalScheduledHours) * 100);
        }
        if (stats.totalCalls > 0) {
            stats.avgConversionRate = Number(((stats.totalMeetings / stats.totalCalls) * 100).toFixed(1));
        }

        return stats;
    }, [members]);

    // ============================================
    // TAB BAR (shared)
    // ============================================

    const tabBar = (
        <div className="flex items-center bg-slate-100 rounded-xl p-1 w-fit">
            <button
                onClick={() => setTab("equipe")}
                className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    activeTab === "equipe"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                )}
            >
                <Users className="w-4 h-4" />
                Équipe
            </button>
            <button
                onClick={() => setTab("reglages")}
                className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    activeTab === "reglages"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                )}
            >
                <Settings className="w-4 h-4" />
                Réglages
            </button>
        </div>
    );

    // ============================================
    // RENDER — Réglages tab
    // ============================================

    if (activeTab === "reglages") {
        return (
            <div className={`space-y-6 pb-10 max-w-[1520px] mx-auto ${mounted ? "team-page-mounted" : ""}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Équipe & Réglages</h1>
                        <p className="text-[14px] text-slate-500 mt-1">
                            Gestion des utilisateurs et paramètres
                        </p>
                    </div>
                    {tabBar}
                </div>
                <ReglagesTab />
            </div>
        );
    }

    // ============================================
    // LOADING STATE (Équipe tab only)
    // ============================================

    if (isLoading && members.length === 0) {
        return (
            <div className={`space-y-6 pb-10 max-w-[1520px] mx-auto ${mounted ? "team-page-mounted" : ""}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Équipe & Réglages</h1>
                        <p className="text-[14px] text-slate-500 mt-1">
                            Suivi temps réel et performance de votre équipe commerciale
                        </p>
                    </div>
                    {tabBar}
                </div>
                <div className="flex items-center justify-center py-32">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                            <Loader2 className="w-7 h-7 text-white animate-spin" />
                        </div>
                        <div className="text-center">
                            <p className="text-base font-medium text-slate-700">Chargement de l'équipe</p>
                            <p className="text-sm text-slate-400 mt-1">Récupération des données...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER — Équipe tab
    // ============================================

    return (
        <div className={`team-page space-y-6 pb-10 max-w-[1520px] mx-auto ${mounted ? "team-page-mounted" : ""}`}>

            {/* ═══════════════════════════════════════
                HEADER — Clean, Apple-style
               ═══════════════════════════════════════ */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Équipe & Réglages</h1>
                    <p className="text-[14px] text-slate-500 mt-1">
                        Suivi temps réel et performance de votre équipe commerciale
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    {tabBar}
                    <button
                        onClick={fetchData}
                        className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all"
                        title="Rafraîchir"
                    >
                        <RefreshCw className={cn("w-4 h-4 text-slate-500", isLoading && "animate-spin")} />
                    </button>
                    <button className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all">
                        <Download className="w-4 h-4 text-slate-500" />
                    </button>
                    <button className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200 hover:-translate-y-0.5">
                        <UserPlus className="w-4 h-4" />
                        Ajouter
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════
                STAT CARDS — 4 KPIs
               ═══════════════════════════════════════ */}
            <div className="grid grid-cols-4 gap-5">
                <StatCard
                    icon={Users}
                    label="Équipe active"
                    value={`${teamStats.activeMembers}/${teamStats.totalMembers}`}
                    subValue="membres en ligne"
                    accent="from-indigo-500 to-indigo-600"
                />
                <StatCard
                    icon={Clock}
                    label="Heures cette semaine"
                    value={formatHours(teamStats.totalCompletedHours)}
                    subValue={`${teamStats.utilizationRate}% utilisation`}
                    trend={trendData?.hours ? { value: trendData.hours.change, isPositive: trendData.hours.isPositive } : undefined}
                    accent="from-emerald-500 to-emerald-600"
                />
                <StatCard
                    icon={Phone}
                    label="Appels totaux"
                    value={teamStats.totalCalls}
                    subValue="cette semaine"
                    trend={trendData?.calls ? { value: trendData.calls.change, isPositive: trendData.calls.isPositive } : undefined}
                    accent="from-blue-500 to-blue-600"
                />
                <StatCard
                    icon={Calendar}
                    label="RDV décrochés"
                    value={teamStats.totalMeetings}
                    subValue={`${teamStats.avgConversionRate}% conversion`}
                    trend={trendData?.meetings ? { value: trendData.meetings.change, isPositive: trendData.meetings.isPositive } : undefined}
                    accent="from-amber-500 to-amber-600"
                />
            </div>

            {/* ═══════════════════════════════════════
                MAIN CONTENT — 1/3 sidebar + 2/3 main
               ═══════════════════════════════════════ */}
            <div className="grid grid-cols-[1fr_2fr] gap-6">

                {/* LEFT SIDEBAR: Leaderboard + Activity */}
                <div className="space-y-5">
                    {/* Leaderboard */}
                    <div className="team-panel">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <Trophy className="w-4.5 h-4.5 text-amber-600" />
                                </div>
                                <h2 className="text-[15px] font-bold text-slate-900">Classement</h2>
                            </div>
                            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                                {(["calls", "meetings", "hours"] as const).map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setLeaderboardMetric(m)}
                                        className={cn(
                                            "text-[11px] px-2.5 py-1.5 rounded-md font-semibold transition-all",
                                            leaderboardMetric === m
                                                ? "bg-white text-slate-900 shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        {m === "calls" ? "Appels" : m === "meetings" ? "RDV" : "Heures"}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <Leaderboard members={members} metric={leaderboardMetric} />
                    </div>

                    {/* Activity Feed */}
                    <div className="team-panel">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                                <Activity className="w-4.5 h-4.5 text-violet-600" />
                            </div>
                            <h2 className="text-[15px] font-bold text-slate-900">Activité récente</h2>
                        </div>
                        <ActivityFeed activities={recentActivities} />
                    </div>
                </div>

                {/* RIGHT MAIN: Heatmap + Search + Members */}
                <div className="space-y-5">

                    {/* Utilization Heatmap */}
                    <div className="team-panel">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <BarChart3 className="w-4.5 h-4.5 text-emerald-600" />
                                </div>
                                <h2 className="text-[15px] font-bold text-slate-900">Utilisation hebdomadaire</h2>
                            </div>
                            <span className="text-[13px] text-slate-400 font-medium">
                                Semaine du {weekDates[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            </span>
                        </div>
                        <UtilizationHeatmap members={members} />
                    </div>

                    {/* Search + Filter bar */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Rechercher un membre..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-[14px] bg-white hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:outline-none transition-all"
                            />
                        </div>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="px-4 py-2.5 border border-slate-200 rounded-xl text-[14px] bg-white hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:outline-none transition-all min-w-[150px]"
                        >
                            <option value="all">Tous les rôles</option>
                            <option value="SDR">SDR</option>
                            <option value="BUSINESS_DEVELOPER">Business Dev</option>
                        </select>

                        {/* View toggle — Apple segmented control */}
                        <div className="flex items-center bg-slate-100 rounded-xl p-1">
                            <button
                                onClick={() => setViewMode("cards")}
                                className={cn(
                                    "p-2 rounded-lg transition-all",
                                    viewMode === "cards"
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                                title="Vue grille"
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={cn(
                                    "p-2 rounded-lg transition-all",
                                    viewMode === "list"
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                                title="Vue liste"
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Team members — card or list view */}
                    {viewMode === "cards" ? (
                        <div className="grid grid-cols-2 gap-4">
                            {filteredMembers.map((member) => (
                                <MemberCard
                                    key={member.id}
                                    member={member}
                                    onViewDetails={() => {
                                        window.location.href = `/manager/team/${member.id}`;
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="team-panel !p-0 divide-y divide-slate-100">
                            {filteredMembers.map((member) => (
                                <MemberListRow
                                    key={member.id}
                                    member={member}
                                    onViewDetails={() => {
                                        window.location.href = `/manager/team/${member.id}`;
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {filteredMembers.length === 0 && (
                        <div className="text-center py-16 team-panel">
                            <Users className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                            <p className="text-[15px] font-medium text-slate-500 mb-1">Aucun membre trouvé</p>
                            <p className="text-[13px] text-slate-400">Essayez de modifier vos filtres</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
