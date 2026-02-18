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
    Filter,
} from "lucide-react";
import Link from "next/link";

// ============================================
// TYPES
// ============================================

interface Mission {
    id: string;
    name: string;
    objective?: string;
    channel: "CALL" | "EMAIL" | "LINKEDIN";
    isActive: boolean;
    startDate?: string;
    endDate?: string;
    client?: {
        id: string;
        name: string;
    };
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
        className: "mgr-channel-call"
    },
    EMAIL: {
        icon: Mail,
        label: "Email",
        className: "mgr-channel-email"
    },
    LINKEDIN: {
        icon: Linkedin,
        label: "LinkedIn",
        className: "mgr-channel-linkedin"
    },
};

// ============================================
// MISSIONS PAGE
// ============================================

export default function MissionsPage() {
    const [missions, setMissions] = useState<Mission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [channelFilter, setChannelFilter] = useState<string>("all");
    const { error: showError } = useToast();

    // ============================================
    // FETCH MISSIONS
    // ============================================

    const fetchMissions = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== "all") {
                params.set("isActive", statusFilter === "active" ? "true" : "false");
            }

            const res = await fetch(`/api/missions?${params.toString()}`);
            const json = await res.json();

            if (json.success) {
                setMissions(json.data);
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
    }, [statusFilter]);

    // ============================================
    // FILTER MISSIONS
    // ============================================

    const filteredMissions = missions.filter(mission => {
        const matchesSearch = !searchQuery ||
            mission.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            mission.client?.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesChannel = channelFilter === "all" || mission.channel === channelFilter;

        return matchesSearch && matchesChannel;
    });

    // ============================================
    // STATS
    // ============================================

    const stats = {
        total: missions.length,
        active: missions.filter(m => m.isActive).length,
        paused: missions.filter(m => !m.isActive).length,
    };

    if (isLoading && missions.length === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-sm text-slate-500">Chargement des missions...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Premium Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Missions</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Gérez vos missions client et leurs campagnes
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchMissions}
                        className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                    <Link
                        href="/manager/missions/new"
                        className="mgr-btn-primary flex items-center gap-2 h-10 px-5 text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Nouvelle mission
                    </Link>
                </div>
            </div>

            {/* Premium Stats Cards */}
            <div className="grid grid-cols-3 gap-5">
                <div className="mgr-stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <Target className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                            <p className="text-sm text-slate-500">Total missions</p>
                        </div>
                    </div>
                </div>
                <div className="mgr-stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
                            <p className="text-sm text-slate-500">Actives</p>
                        </div>
                    </div>
                </div>
                <div className="mgr-stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-amber-600">{stats.paused}</p>
                            <p className="text-sm text-slate-500">En pause</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Filters */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher une mission..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="mgr-search-input w-full h-11 pl-12 pr-10 text-sm text-slate-900"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    )}
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-11 px-4 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                >
                    <option value="all">Tous les statuts</option>
                    <option value="active">Actif</option>
                    <option value="paused">En pause</option>
                </select>
                <select
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                    className="h-11 px-4 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                >
                    <option value="all">Tous les canaux</option>
                    <option value="CALL">📞 Appel</option>
                    <option value="EMAIL">📧 Email</option>
                    <option value="LINKEDIN">💼 LinkedIn</option>
                </select>
            </div>

            {/* Missions List */}
            {filteredMissions.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <Target className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        {searchQuery || channelFilter !== "all"
                            ? "Aucune mission trouvée"
                            : "Aucune mission créée"}
                    </h3>
                    <p className="text-sm text-slate-500 mb-6">
                        {searchQuery || channelFilter !== "all"
                            ? "Essayez d'autres filtres"
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
                <div className="space-y-4">
                    {filteredMissions.map((mission, index) => {
                        const channel = CHANNEL_CONFIG[mission.channel];
                        const ChannelIcon = channel.icon;

                        return (
                            <Link
                                key={mission.id}
                                href={`/manager/missions/${mission.id}`}
                                className="mgr-mission-card group flex items-start gap-4 block"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {/* Client Logo */}
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-lg font-bold text-indigo-600 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                                    {mission.client?.name?.[0] || "M"}
                                </div>

                                {/* Mission Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap mb-1">
                                        <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                            {mission.name}
                                        </h3>
                                        <span className={mission.isActive ? "mgr-badge-active" : "mgr-badge-paused"}>
                                            {mission.isActive ? "Actif" : "Pause"}
                                        </span>
                                        <span className={`mgr-channel-badge ${channel.className}`}>
                                            <ChannelIcon className="w-3 h-3" />
                                            {channel.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        {mission.client?.name}
                                        {mission.objective && ` · ${mission.objective}`}
                                    </p>

                                    {/* Stats */}
                                    <div className="flex items-center gap-6 mt-3">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Users className="w-4 h-4 text-slate-400" />
                                            <span className="text-slate-600">
                                                {mission._count.sdrAssignments} SDR{mission._count.sdrAssignments > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Target className="w-4 h-4 text-slate-400" />
                                            <span className="text-slate-600">
                                                {mission._count.campaigns} campagne{mission._count.campaigns > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <span className="text-slate-600">
                                                {mission._count.lists} liste{mission._count.lists > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Arrow */}
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
