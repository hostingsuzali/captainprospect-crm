"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Phone, Mail, Linkedin, Building2, User, CheckCircle2,
    XCircle, Ban, Loader2, Clock, Calendar, Sparkles, Filter, RotateCcw,
    RefreshCw, ArrowLeft, Target, BarChart3, TrendingUp, Search, CalendarPlus, ChevronRight
} from "lucide-react";
import { Card, Badge, Button, DataTable } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { UnifiedActionDrawer } from "@/components/drawers/UnifiedActionDrawer";
import { ACTION_RESULT_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface MissionItem {
    id: string;
    name: string;
    channel: string;
    client: { id: string; name: string };
    _count?: { actions: number; campaigns: number };
}

interface ActionRecord {
    id: string;
    contactId: string | null;
    companyId: string | null;
    contact: {
        id: string;
        firstName?: string | null;
        lastName?: string | null;
        company: { id: string; name: string };
    } | null;
    company: {
        id: string;
        name: string;
    } | null;
    sdr: {
        id: string;
        name: string;
    } | null;
    channel: string;
    result: string;
    note?: string;
    duration?: number;
    createdAt: string;
    _searchKey?: string;
}

const RESULT_ICON_MAP: Record<string, React.ReactNode> = {
    NO_RESPONSE: <XCircle className="w-4 h-4" />,
    BAD_CONTACT: <Ban className="w-4 h-4" />,
    INTERESTED: <Sparkles className="w-4 h-4" />,
    CALLBACK_REQUESTED: <Clock className="w-4 h-4" />,
    MEETING_BOOKED: <CalendarPlus className="w-4 h-4" />,
    DISQUALIFIED: <XCircle className="w-4 h-4" />,
    ENVOIE_MAIL: <Mail className="w-4 h-4" />,
};

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    CALL: Phone,
    EMAIL: Mail,
    LINKEDIN: Linkedin,
};

export default function ManagerProspectionPage() {
    // Step 1: Picker States
    const [missions, setMissions] = useState<MissionItem[]>([]);
    const [missionsLoading, setMissionsLoading] = useState(true);

    // Step 2: Selected Mission
    const [selectedMission, setSelectedMission] = useState<MissionItem | null>(null);

    // Dashboard Data
    const [actions, setActions] = useState<ActionRecord[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const [sdrFilter, setSdrFilter] = useState("");
    const [resultFilter, setResultFilter] = useState("");

    // SDR list for dropdown
    const [sdrOptions, setSdrOptions] = useState<{ id: string; name: string }[]>([]);

    // Drawer state
    const [drawerAction, setDrawerAction] = useState<ActionRecord | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/missions?isActive=true&limit=100")
            .then((res) => res.json())
            .then((json) => {
                if (!cancelled && json.success) setMissions(json.data);
            })
            .finally(() => { if (!cancelled) setMissionsLoading(false); });

        fetch("/api/users?role=SDR,BUSINESS_DEVELOPER")
            .then((res) => res.json())
            .then((json) => {
                if (!cancelled && json.success) setSdrOptions(Array.isArray(json.data) ? json.data : []);
            });

        return () => { cancelled = true; };
    }, []);

    const fetchMissionData = useCallback((missionId: string) => {
        setLoadingData(true);
        Promise.all([
            fetch(`/api/actions?missionId=${missionId}&limit=500`).then(r => r.json()),
            fetch(`/api/missions/${missionId}/action-stats`).then(r => r.json())
        ])
            .then(([actionsJson, statsJson]) => {
                if (actionsJson.success) {
                    setActions((actionsJson.data || []).map((a: ActionRecord) => ({
                        ...a,
                        _searchKey: `${a.contact?.firstName || ""} ${a.contact?.lastName || ""} ${a.company?.name || ""} ${a.contact?.company?.name || ""}`.toLowerCase()
                    })));
                }
                if (statsJson.success) {
                    setStats(statsJson.data);
                }
            })
            .finally(() => setLoadingData(false));
    }, []);

    useEffect(() => {
        if (selectedMission) {
            fetchMissionData(selectedMission.id);
        }
    }, [selectedMission, fetchMissionData]);

    const filteredActions = useMemo(() => {
        return actions.filter(a => {
            if (sdrFilter && a.sdr?.id !== sdrFilter) return false;
            if (resultFilter && a.result !== resultFilter) return false;
            if (search && !a._searchKey?.includes(search.toLowerCase())) return false;
            return true;
        });
    }, [actions, sdrFilter, resultFilter, search]);

    const statsConfig = {
        total: stats?.total || 0,
        rdv: stats?.resultBreakdown?.MEETING_BOOKED || 0,
        interested: stats?.resultBreakdown?.INTERESTED || 0,
        callbacks: stats?.resultBreakdown?.CALLBACK_REQUESTED || 0,
        rate: stats?.conversionRate || "0.00"
    };

    // Columns
    const columns: Column<ActionRecord>[] = [
        {
            key: "date",
            header: "Date et Heure",
            render: (v, row) => (
                <div className="text-sm text-slate-600">
                    <div className="font-medium text-slate-800">
                        {new Date(row.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </div>
                    <div className="text-xs text-slate-400">
                        {new Date(row.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                </div>
            ),
        },
        {
            key: "name",
            header: "Contact / Société",
            render: (_, row) => {
                const name = row.contact
                    ? `${row.contact.firstName || ""} ${row.contact.lastName || ""}`.trim() || row.company?.name || row.contact.company?.name
                    : row.company?.name;
                const cName = row.contact ? row.contact.company?.name : row.company?.name;
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            {row.contactId ? (
                                <User className="w-4 h-4 text-indigo-500" />
                            ) : (
                                <Building2 className="w-4 h-4 text-indigo-500" />
                            )}
                        </div>
                        <div>
                            <p className="font-medium text-slate-900 truncate max-w-[200px]">{name}</p>
                            {row.contact && cName && cName !== name && (
                                <p className="text-xs text-slate-500 truncate max-w-[200px]">{cName}</p>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            key: "sdr",
            header: "Effectué par",
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {row.sdr?.name?.[0] || "?"}
                    </div>
                    <span className="text-sm font-medium text-slate-700">{row.sdr?.name || "Inconnu"}</span>
                </div>
            )
        },
        {
            key: "result",
            header: "Résultat",
            render: (_, row) => (
                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 shadow-sm gap-1.5 py-1">
                    {RESULT_ICON_MAP[row.result] || <Target className="w-3.5 h-3.5" />}
                    {ACTION_RESULT_LABELS[row.result] || row.result}
                </Badge>
            ),
        },
        {
            key: "note",
            header: "Remarque / Durée",
            render: (_, row) => (
                <div className="max-w-[250px]">
                    {row.note ? (
                        <p className="text-sm text-slate-600 truncate" title={row.note}>{row.note}</p>
                    ) : (
                        <span className="text-xs text-slate-400 italic">Aucune note</span>
                    )}
                    {row.duration && (
                        <p className="text-xs text-slate-400 mt-0.5">
                            {Math.floor(row.duration / 60)}m {row.duration % 60}s
                        </p>
                    )}
                </div>
            )
        }
    ];

    if (!selectedMission) {
        return (
            <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <Phone className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Historique des Appels</h1>
                        <p className="text-sm text-slate-500 mt-0.5">Sélectionnez une mission pour afficher tous les appels et statistiques</p>
                    </div>
                </div>

                {missionsLoading ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                        <p className="text-slate-500 font-medium">Chargement des missions...</p>
                    </div>
                ) : missions.length === 0 ? (
                    <Card className="text-center py-20 border-dashed border-2 shadow-sm rounded-3xl">
                        <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-700">Aucune mission trouvée</h3>
                        <p className="text-slate-500 mt-1">Créez des missions pour pouvoir suivre leurs appels.</p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {missions.map((mission, index) => {
                            const ChannelIcon = CHANNEL_ICONS[mission.channel] ?? Phone;
                            return (
                                <Card
                                    key={mission.id}
                                    onClick={() => setSelectedMission(mission)}
                                    className="overflow-hidden cursor-pointer group hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 rounded-2xl"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="p-6 relative">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500 opacity-50" />

                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shadow-sm group-hover:-translate-y-1 transition-transform">
                                                <ChannelIcon className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                            </div>
                                        </div>

                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{mission.name}</h2>
                                            <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5 mt-1">
                                                <Building2 className="w-3.5 h-3.5" />
                                                {mission.client?.name ?? "Sans client"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Voir l'historique</span>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMission(null)} className="h-10 w-10 p-0 rounded-xl hover:bg-slate-100">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                            {selectedMission.name}
                        </h1>
                        <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Building2 className="w-4 h-4" />
                            {selectedMission.client.name} — Historique complet
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fetchMissionData(selectedMission.id)} className="gap-2 bg-white">
                        <RefreshCw className={cn("w-4 h-4", loadingData && "animate-spin")} />
                        Actualiser
                    </Button>
                </div>
            </div>

            {/* Premium Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="p-5 border-slate-200/60 shadow-sm rounded-2xl bg-white relative overflow-hidden">
                    <div className="flex flex-col gap-1 relative z-10">
                        <span className="text-sm font-medium text-slate-500">Actions totales</span>
                        <span className="text-3xl font-black text-slate-900">{statsConfig.total}</span>
                    </div>
                    <BarChart3 className="absolute -right-4 -bottom-4 w-20 h-20 text-slate-50/50 -rotate-12 pointer-events-none" />
                </Card>
                <Card className="p-5 border-indigo-100 shadow-sm rounded-2xl bg-gradient-to-br from-indigo-50 to-white relative overflow-hidden">
                    <div className="flex flex-col gap-1 relative z-10">
                        <span className="text-sm font-bold text-indigo-600/80">RDV Pris</span>
                        <span className="text-3xl font-black text-indigo-700">{statsConfig.rdv}</span>
                    </div>
                    <CalendarPlus className="absolute -right-4 -bottom-4 w-20 h-20 text-indigo-100 -rotate-12 pointer-events-none" />
                </Card>
                <Card className="p-5 border-emerald-100 shadow-sm rounded-2xl bg-gradient-to-br from-emerald-50 to-white relative overflow-hidden">
                    <div className="flex flex-col gap-1 relative z-10">
                        <span className="text-sm font-bold text-emerald-600/80">Intéressés</span>
                        <span className="text-3xl font-black text-emerald-700">{statsConfig.interested}</span>
                    </div>
                    <Sparkles className="absolute -right-4 -bottom-4 w-20 h-20 text-emerald-100 -rotate-12 pointer-events-none" />
                </Card>
                <Card className="p-5 border-amber-100 shadow-sm rounded-2xl bg-gradient-to-br from-amber-50 to-white relative overflow-hidden">
                    <div className="flex flex-col gap-1 relative z-10">
                        <span className="text-sm font-bold text-amber-600/80">Rappels demandés</span>
                        <span className="text-3xl font-black text-amber-700">{statsConfig.callbacks}</span>
                    </div>
                    <Clock className="absolute -right-4 -bottom-4 w-20 h-20 text-amber-100 -rotate-12 pointer-events-none" />
                </Card>
                <Card className="p-5 border-violet-100 shadow-sm rounded-2xl bg-gradient-to-br from-violet-50 to-white relative overflow-hidden">
                    <div className="flex flex-col gap-1 relative z-10">
                        <span className="text-sm font-bold text-violet-600/80">Taux Conv. RDV</span>
                        <span className="text-3xl font-black text-violet-700">{statsConfig.rate}%</span>
                    </div>
                    <TrendingUp className="absolute -right-4 -bottom-4 w-20 h-20 text-violet-100 -rotate-12 pointer-events-none" />
                </Card>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[250px] relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher par société ou contact..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    />
                </div>
                <div className="w-px h-8 bg-slate-200 hidden md:block" />
                <div className="flex items-center gap-3">
                    <select
                        value={sdrFilter}
                        onChange={(e) => setSdrFilter(e.target.value)}
                        className="h-10 px-3 text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 min-w-[150px]"
                    >
                        <option value="">Tous les utilisateurs</option>
                        {Array.isArray(sdrOptions) && sdrOptions.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                    </select>
                    <select
                        value={resultFilter}
                        onChange={(e) => setResultFilter(e.target.value)}
                        className="h-10 px-3 text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 min-w-[150px]"
                    >
                        <option value="">Tous les résultats</option>
                        {Object.entries(ACTION_RESULT_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                        ))}
                    </select>

                    {(sdrFilter || resultFilter || search) && (
                        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setSdrFilter(""); setResultFilter(""); }} className="h-10 px-3 text-slate-500 hover:text-red-600 hover:bg-red-50">
                            <RotateCcw className="w-4 h-4 mr-1.5" />
                            Réinitialiser
                        </Button>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                <DataTable
                    data={filteredActions}
                    columns={columns}
                    keyField={(row) => row.id}
                    loading={loadingData}
                    pagination
                    pageSize={20}
                    emptyMessage="Aucun appel/action trouvé pour cette mission avec ces filtres."
                    onRowClick={(row) => setDrawerAction(row)}
                />
            </div>

            {/* Quick Unified Drawer View */}
            {drawerAction && (
                <UnifiedActionDrawer
                    isOpen={!!drawerAction}
                    onClose={() => setDrawerAction(null)}
                    contactId={drawerAction.contactId || null}
                    companyId={drawerAction.companyId || drawerAction.contact?.company?.id || ""}
                    missionId={selectedMission.id}
                    missionName={selectedMission.name}
                />
            )}
        </div>
    );
}
