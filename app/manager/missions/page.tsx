"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui";
import {
    Plus,
    Search,
    Target,
    Users,
    Calendar,
    ChevronRight,
    RefreshCw,
    Phone,
    Mail,
    Linkedin,
    Loader2,
    X,
    Activity,
    Zap,
    TrendingUp,
    BarChart3,
    Clock,
    Globe,
    ArrowUpRight,
    ListChecks,
} from "lucide-react";
import Link from "next/link";
import { MissionQuickViewDrawer } from "./_components/MissionQuickViewDrawer";
import { NewMissionDialog } from "./_components/NewMissionDialog";
import { MISSION_STATUS_CONFIG, MISSION_STATUS_TABS } from "@/lib/constants/missionStatus";
import type { MissionStatusValue } from "@/lib/constants/missionStatus";

// ============================================
// TYPES
// ============================================

interface Mission {
    id: string;
    name: string;
    objective?: string;
    channel: "CALL" | "EMAIL" | "LINKEDIN";
    channels?: ("CALL" | "EMAIL" | "LINKEDIN")[];
    status: MissionStatusValue;
    isActive?: boolean;
    startDate?: string;
    endDate?: string;
    client?: {
        id: string;
        name: string;
    };
    sdrAssignments?: Array<{
        sdr: {
            id: string;
            name: string;
        };
    }>;
    _count: {
        sdrAssignments: number;
        campaigns: number;
        lists: number;
    };
}

// ============================================
// CHANNEL CONFIG
// ============================================

const CHANNEL_CONFIG = {
    CALL: {
        icon: Phone,
        label: "Appel",
        className: "mgr-channel-call",
        color: "from-blue-500 to-indigo-600",
        bgLight: "bg-blue-50",
        textColor: "text-blue-600",
    },
    EMAIL: {
        icon: Mail,
        label: "Email",
        className: "mgr-channel-email",
        color: "from-violet-500 to-purple-600",
        bgLight: "bg-violet-50",
        textColor: "text-violet-600",
    },
    LINKEDIN: {
        icon: Linkedin,
        label: "LinkedIn",
        className: "mgr-channel-linkedin",
        color: "from-sky-500 to-blue-600",
        bgLight: "bg-sky-50",
        textColor: "text-sky-600",
    },
};

// ============================================
// HELPER: Days since start
// ============================================
function getDaysActive(startDate?: string): number | null {
    if (!startDate) return null;
    const diff = Date.now() - new Date(startDate).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}

// ============================================
// MISSIONS PAGE
// ============================================

export default function MissionsPage() {
    const [missions, setMissions] = useState<Mission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [channelFilter, setChannelFilter] = useState<string>("all");
    const [page, setPage] = useState<number>(1);
    const [total, setTotal] = useState<number>(0);
    const [selectedMissionForDrawer, setSelectedMissionForDrawer] = useState<Mission | null>(null);
    const [showNewMissionDialog, setShowNewMissionDialog] = useState(false);
    const { error: showError } = useToast();

    const pageSize = 10;
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    const fetchMissions = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("limit", String(pageSize));
            if (statusFilter !== "all") {
                params.set("status", statusFilter);
            }
            if (debouncedSearchQuery.trim()) {
                params.set("search", debouncedSearchQuery.trim());
            }
            if (channelFilter !== "all") {
                params.set("channel", channelFilter);
            }
            const res = await fetch(`/api/missions?${params.toString()}`);
            const json = await res.json();
            if (json.success) {
                setMissions(json.data);
                if (json.pagination?.total != null) {
                    setTotal(json.pagination.total);
                } else {
                    setTotal(json.data.length);
                }
            } else {
                showError("Erreur", json.error || "Impossible de charger les missions");
            }
        } catch (err) {
            console.error("Failed to fetch missions:", err);
            showError("Erreur", "Impossible de charger les missions");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMissions();
    }, [statusFilter, page, debouncedSearchQuery, channelFilter]);

    // Reset to page 1 when search or channel filter changes
    useEffect(() => {
        setPage(1);
    }, [debouncedSearchQuery, channelFilter]);

    // Display missions from API (server-side search/filter across all pages)
    const filteredMissions = missions;

    const stats = {
        total: total || missions.length,
        active: missions.filter(m => m.status === "ACTIVE").length,
        paused: missions.filter(m => m.status === "PAUSED").length,
        totalMembers: missions.reduce((acc, m) => acc + (m._count?.sdrAssignments || 0), 0),
    };

    const totalPages = Math.max(1, Math.ceil((total || missions.length || 1) / pageSize));
    const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = total === 0 ? 0 : Math.min(total, startItem + (filteredMissions.length || missions.length) - 1);

    if (isLoading && missions.length === 0) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Target className="w-8 h-8 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-100 flex items-center justify-center">
                            <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" />
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-slate-700">Chargement des missions</p>
                        <p className="text-xs text-slate-400 mt-0.5">Veuillez patienter...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* ─── HERO HEADER ─── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-7 text-white">
                {/* Decorative orbs */}
                <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-10 w-64 h-64 rounded-full bg-violet-700/15 blur-3xl pointer-events-none" />
                <div className="absolute top-4 right-48 w-24 h-24 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />

                <div className="relative z-10">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                                    <Target className="w-4 h-4 text-indigo-300" />
                                </div>
                                <span className="text-xs font-medium text-indigo-300 uppercase tracking-widest">Centre de missions</span>
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight">Missions</h1>
                            <p className="text-sm text-slate-400 mt-1">Piloter, assigner et suivre vos missions client</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchMissions}
                                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all"
                                title="Actualiser"
                            >
                                <RefreshCw className={`w-4 h-4 text-white/70 ${isLoading ? "animate-spin" : ""}`} />
                            </button>
                            <button
                                onClick={() => setShowNewMissionDialog(true)}
                                className="flex items-center gap-2 h-10 px-5 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-indigo-50 transition-all shadow-lg shadow-black/20"
                            >
                                <Plus className="w-4 h-4" />
                                Nouvelle mission
                            </button>
                        </div>
                    </div>

                    {/* Stat counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex items-center gap-3 bg-white/8 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-sm">
                            <div className="w-9 h-9 rounded-lg bg-indigo-500/30 flex items-center justify-center shrink-0">
                                <BarChart3 className="w-4 h-4 text-indigo-300" />
                            </div>
                            <div>
                                <p className="text-xl font-bold leading-tight">{stats.total}</p>
                                <p className="text-xs text-slate-400">Total</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/8 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-sm">
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/30 flex items-center justify-center shrink-0">
                                <Zap className="w-4 h-4 text-emerald-300" />
                            </div>
                            <div>
                                <p className="text-xl font-bold leading-tight text-emerald-300">{stats.active}</p>
                                <p className="text-xs text-slate-400">Actives</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/8 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-sm">
                            <div className="w-9 h-9 rounded-lg bg-amber-500/30 flex items-center justify-center shrink-0">
                                <Clock className="w-4 h-4 text-amber-300" />
                            </div>
                            <div>
                                <p className="text-xl font-bold leading-tight text-amber-300">{stats.paused}</p>
                                <p className="text-xs text-slate-400">En pause</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/8 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-sm">
                            <div className="w-9 h-9 rounded-lg bg-violet-500/30 flex items-center justify-center shrink-0">
                                <Users className="w-4 h-4 text-violet-300" />
                            </div>
                            <div>
                                <p className="text-xl font-bold leading-tight text-violet-300">{stats.totalMembers}</p>
                                <p className="text-xs text-slate-400">Membres actifs</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── FILTERS ─── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center gap-3 shadow-sm">
                {/* Search */}
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher une mission ou un client..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-10 pl-10 pr-9 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder:text-slate-400 transition-all"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 transition-colors">
                            <X className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                    )}
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-slate-200 hidden sm:block" />

                {/* Status pill tabs */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    {MISSION_STATUS_TABS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => {
                                setStatusFilter(opt.value);
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === opt.value
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Channel filter */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    {[
                        { value: "all", label: "Tous" },
                        { value: "CALL", label: "Appel", icon: "📞" },
                        { value: "EMAIL", label: "Email", icon: "📧" },
                        { value: "LINKEDIN", label: "LinkedIn", icon: "💼" },
                    ].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setChannelFilter(opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${channelFilter === opt.value
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            {opt.icon ? `${opt.icon} ${opt.label}` : opt.label}
                        </button>
                    ))}
                </div>

                {/* Result count */}
                <div className="text-xs text-slate-400 font-medium ml-auto hidden sm:block">
                    {filteredMissions.length} / {total || missions.length} mission{(total || missions.length) !== 1 ? "s" : ""}
                </div>
            </div>

            {/* ─── MISSION CARDS ─── */}
            {filteredMissions.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-5 border border-slate-200">
                        <Target className="w-9 h-9 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">
                        {searchQuery || channelFilter !== "all" ? "Aucune mission trouvée" : "Aucune mission créée"}
                    </h3>
                    <p className="text-sm text-slate-500 mb-6">
                        {searchQuery || channelFilter !== "all"
                            ? "Modifiez vos filtres pour voir plus de résultats"
                            : "Créez votre première mission pour commencer"}
                    </p>
                    {!searchQuery && channelFilter === "all" && (
                        <Link href="/manager/missions/new" className="mgr-btn-primary inline-flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Créer une mission
                        </Link>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid gap-3">
                        {isLoading
                            ? Array.from({ length: pageSize }).map((_, index) => (
                                <div
                                    key={`skeleton-${index}`}
                                    className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden animate-pulse"
                                >
                                    <div className="flex items-center gap-5 px-6 py-5 pl-7">
                                        <div className="relative w-14 h-14 rounded-2xl bg-slate-100 flex-shrink-0" />
                                        <div className="flex-1 min-w-0 space-y-3">
                                            <div className="h-4 bg-slate-100 rounded w-1/3" />
                                            <div className="h-3 bg-slate-100 rounded w-1/2" />
                                            <div className="flex items-center gap-4">
                                                <div className="h-3 bg-slate-100 rounded w-16" />
                                                <div className="h-3 bg-slate-100 rounded w-16" />
                                                <div className="h-3 bg-slate-100 rounded w-24" />
                                            </div>
                                        </div>
                                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex-shrink-0" />
                                    </div>
                                </div>
                            ))
                            : filteredMissions.map((mission, index) => {
                                const channelsList = mission.channels?.length ? mission.channels : [mission.channel];
                                const channel = CHANNEL_CONFIG[mission.channel];
                                const ChannelIcon = channel.icon;
                                const daysActive = getDaysActive(mission.startDate);
                                const memberCount = mission._count.sdrAssignments;
                                const listCount = mission._count.lists;
                                const campaignCount = mission._count.campaigns;

                                return (
                                    <div
                                        key={mission.id}
                                        onClick={() => setSelectedMissionForDrawer(mission)}
                                        className="group relative bg-white border border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/8 transition-all duration-300 hover:-translate-y-0.5"
                                        style={{ animationDelay: `${index * 40}ms` }}
                                    >
                                        {/* Active status left bar */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-all duration-300 ${mission.status === "ACTIVE" ? "bg-gradient-to-b from-emerald-400 to-emerald-600" : mission.status === "PAUSED" ? "bg-gradient-to-b from-amber-300 to-amber-500" : "bg-gradient-to-b from-slate-200 to-slate-300"}`} />

                                        {/* Hover shimmer */}
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-r from-indigo-500/3 via-transparent to-transparent" />

                                        <div className="flex items-center gap-5 px-6 py-5 pl-7">

                                            {/* Client logo / avatar */}
                                            <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${channel.color} flex items-center justify-center text-xl font-bold text-white flex-shrink-0 shadow-md group-hover:scale-105 transition-transform duration-300`}>
                                                {mission.client?.name?.[0] || "M"}
                                                {/* Channel icon badge */}
                                                <div className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full ${channel.bgLight} border-2 border-white flex items-center justify-center shadow-sm`}>
                                                    <ChannelIcon className={`w-3 h-3 ${channel.textColor}`} />
                                                </div>
                                            </div>

                                            {/* Main info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                                    <h3 className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors text-base truncate">
                                                        {mission.name}
                                                    </h3>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${mission.status === "ACTIVE"
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : mission.status === "PAUSED"
                                                            ? "bg-amber-100 text-amber-700"
                                                            : "bg-slate-100 text-slate-600"
                                                        }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${mission.status === "ACTIVE" ? "bg-emerald-500" : mission.status === "PAUSED" ? "bg-amber-500" : "bg-slate-400"}`} />
                                                        {MISSION_STATUS_CONFIG[mission.status]?.label ?? mission.status}
                                                    </span>
                                                </div>

                                                <p className="text-sm text-slate-500 truncate mb-3">
                                                    {mission.client?.name}
                                                    {mission.objective && (
                                                        <span className="text-slate-400"> · {mission.objective}</span>
                                                    )}
                                                </p>

                                                {/* Meta row */}
                                                <div className="flex items-center flex-wrap gap-x-5 gap-y-1">
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <Target className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>{campaignCount} campagne{campaignCount !== 1 ? "s" : ""}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <ListChecks className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>{listCount} liste{listCount !== 1 ? "s" : ""}</span>
                                                    </div>
                                                    {daysActive !== null && (
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                            <Activity className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>{daysActive}j actif</span>
                                                        </div>
                                                    )}
                                                    {mission.startDate && (
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>
                                                                {new Date(mission.startDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                                                                {mission.endDate
                                                                    ? ` → ${new Date(mission.endDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`
                                                                    : " → en cours"}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right side: avatars + channel badge + arrow */}
                                            <div className="flex items-center gap-5 flex-shrink-0">
                                                {/* Team avatars */}
                                                <div className="hidden md:flex flex-col items-end gap-1">
                                                    {mission.sdrAssignments && mission.sdrAssignments.length > 0 ? (
                                                        <>
                                                            <div className="flex -space-x-2">
                                                                {mission.sdrAssignments.slice(0, 4).map((a, i) => (
                                                                    <div
                                                                        key={a.sdr.id}
                                                                        className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                                                                        style={{ zIndex: 10 - i }}
                                                                        title={a.sdr.name}
                                                                    >
                                                                        {a.sdr.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                                                    </div>
                                                                ))}
                                                                {mission.sdrAssignments.length > 4 && (
                                                                    <div className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-slate-600 shadow-sm z-0">
                                                                        +{mission.sdrAssignments.length - 4}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                {memberCount} membre{memberCount !== 1 ? "s" : ""}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-xs text-slate-300">
                                                            <Users className="w-3.5 h-3.5" />
                                                            <span className="italic">Aucun</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Channel pill(s) */}
                                                <div className="hidden lg:flex items-center gap-1.5 flex-wrap">
                                                    {channelsList.length === 1 ? (
                                                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${channel.bgLight} ${channel.textColor} border border-current/10`}>
                                                            <ChannelIcon className="w-3.5 h-3.5" />
                                                            {channel.label}
                                                        </div>
                                                    ) : (
                                                        channelsList.map((ch) => {
                                                            const cfg = CHANNEL_CONFIG[ch];
                                                            const Icon = cfg?.icon ?? ChannelIcon;
                                                            return (
                                                                <div key={ch} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${cfg?.bgLight ?? channel.bgLight} ${cfg?.textColor ?? channel.textColor} border border-current/10`}>
                                                                    <Icon className="w-3 h-3" />
                                                                    {cfg?.label ?? ch}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>

                                                {/* Arrow */}
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 group-hover:bg-indigo-600 border border-slate-100 group-hover:border-indigo-600 transition-all duration-300 shadow-sm">
                                                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors duration-300" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom progress bar — visual only, represents activity ratio */}
                                        {mission.status === "ACTIVE" && (
                                            <div className="px-7 pb-3">
                                                <div className="h-0.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all duration-700"
                                                        style={{ width: `${Math.min(100, ((listCount + campaignCount) / Math.max(1, listCount + campaignCount + 2)) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>

                    {/* Pagination controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
                            <span>
                                Affichage {startItem}-{endItem} sur {total} missions
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1 || isLoading}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Précédent
                                </button>
                                <span className="px-2">
                                    Page {page} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages || isLoading}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Suivant
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            <MissionQuickViewDrawer
                isOpen={!!selectedMissionForDrawer}
                onClose={() => setSelectedMissionForDrawer(null)}
                mission={selectedMissionForDrawer}
            />

            <NewMissionDialog
                isOpen={showNewMissionDialog}
                onClose={() => setShowNewMissionDialog(false)}
                onCreated={fetchMissions}
            />
        </div>
    );
}
