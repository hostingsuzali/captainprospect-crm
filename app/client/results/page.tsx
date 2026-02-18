"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
    Card,
    Badge,
    Button,
    StatCard,
    EmptyState,
    useToast,
} from "@/components/ui";
import {
    Target,
    Phone,
    Calendar,
    TrendingUp,
    Download,
    Building2,
    BarChart3,
    RefreshCw,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    CheckCircle2,
    Clock,
    Users,
    Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface DashboardStats {
    totalActions: number;
    meetingsBooked: number;
    opportunities: number;
    activeMissions: number;
    conversionRate: number;
    resultBreakdown: {
        INTERESTED: number;
    };
}

interface Mission {
    id: string;
    name: string;
    isActive: boolean;
    _count?: {
        sdrAssignments: number;
        actions: number;
        opportunities: number;
        meetings: number;
    };
}

interface Opportunity {
    id: string;
    needSummary: string;
    urgency: "SHORT" | "MEDIUM" | "LONG";
    handedOff: boolean;
    handedOffAt?: string;
    createdAt: string;
    contact: {
        firstName?: string;
        lastName?: string;
        title?: string;
    };
    company: {
        name: string;
    };
}

interface ClientMeeting {
    id: string;
    createdAt: string;
    contact: {
        firstName?: string;
        lastName?: string;
        title?: string;
        company: { name: string };
    };
    campaign: {
        name: string;
        mission: { name: string };
    };
}

interface MeetingsResponse {
    totalMeetings: number;
    allMeetings: ClientMeeting[];
}

const PERIOD_OPTIONS = [
    { value: "week", label: "Semaine" },
    { value: "month", label: "Mois" },
    { value: "quarter", label: "Trimestre" },
] as const;

// ============================================
// MAIN RESULTS PAGE
// ============================================

export default function ClientResultsPage() {
    const { data: session } = useSession();
    const toast = useToast();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [meetings, setMeetings] = useState<ClientMeeting[]>([]);
    const [period, setPeriod] = useState("month");
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [mounted, setMounted] = useState(false);

    const clientId = (session?.user as { clientId?: string })?.clientId;

    const fetchData = useCallback(async (refresh = false) => {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        try {
            const [statsRes, missionsRes, oppsRes, meetingsRes] = await Promise.all([
                fetch(`/api/stats?period=${period}`),
                fetch("/api/missions?isActive=true"),
                fetch("/api/opportunities?limit=50"),
                clientId ? fetch(`/api/clients/${clientId}/meetings`) : Promise.resolve(null),
            ]);

            const [statsJson, missionsJson, oppsJson, meetingsJson] = await Promise.all([
                statsRes.json(),
                missionsRes.json(),
                oppsRes.json(),
                meetingsRes?.ok ? meetingsRes.json() : Promise.resolve(null),
            ]);

            if (statsJson.success) setStats(statsJson.data);
            if (missionsJson.success) setMissions(Array.isArray(missionsJson.data) ? missionsJson.data : []);
            if (oppsJson.success) setOpportunities(Array.isArray(oppsJson.data) ? oppsJson.data : []);
            if (meetingsJson?.success) {
                const data = meetingsJson.data as MeetingsResponse;
                setMeetings(data?.allMeetings ?? []);
            }
        } catch (error) {
            console.error("Failed to fetch:", error);
            toast.error("Erreur de chargement", "Impossible de charger les resultats");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [period, clientId, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(timer);
    }, []);

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });

    const exportAllCsv = () => {
        try {
            const headers = ["Entreprise", "Contact", "Titre", "Besoin", "Urgence", "Transmis", "Date"];
            const rows = opportunities.map((o) => [
                o.company.name,
                [o.contact.firstName, o.contact.lastName].filter(Boolean).join(" ") || "-",
                o.contact.title || "-",
                (o.needSummary || "").replace(/"/g, '""'),
                o.urgency,
                o.handedOff ? "Oui" : "Non",
                formatDate(o.handedOffAt || o.createdAt),
            ]);
            const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
            const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `resultats-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Export reussi", `${opportunities.length} resultat(s) exporte(s)`);
        } catch {
            toast.error("Erreur d'export", "Impossible d'exporter les resultats");
        }
    };

    const conversionRate = stats?.conversionRate ?? 0;

    // ============================================
    // LOADING SKELETON
    // ============================================

    if (isLoading && !stats) {
        return (
            <div className="min-h-full bg-[#F4F6F9] p-6">
                <div className="flex flex-col items-center justify-center py-32">
                    <div className="w-8 h-8 border-2 border-[#7C5CFC] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[13px] text-[#8B8BA7] font-medium mt-4">Chargement des resultats...</p>
                </div>
            </div>
        );
    }

    // ============================================
    // ACTIVITY FEED — combine opps + meetings chronologically
    // ============================================

    type ActivityItem = {
        id: string;
        type: "opportunity" | "meeting";
        date: string;
        title: string;
        subtitle: string;
        mission?: string;
    };

    const activityFeed: ActivityItem[] = [
        ...opportunities.slice(0, 10).map((o) => ({
            id: `opp-${o.id}`,
            type: "opportunity" as const,
            date: o.handedOffAt || o.createdAt,
            title: o.company.name,
            subtitle: [o.contact.firstName, o.contact.lastName].filter(Boolean).join(" ") || "Contact",
        })),
        ...meetings.slice(0, 10).map((m) => ({
            id: `mtg-${m.id}`,
            type: "meeting" as const,
            date: m.createdAt,
            title: `RDV - ${m.contact.company.name}`,
            subtitle: [m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "Contact",
            mission: m.campaign.mission.name,
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15);

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className={cn("min-h-full bg-[#F4F6F9] p-6 space-y-6", mounted && "client-dashboard-mounted")}>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-bold text-[#12122A] tracking-tight">Resultats</h1>
                    <p className="text-[13px] text-[#8B8BA7] mt-0.5">Analyse detaillee de la performance de vos missions</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div
                        className="flex rounded-lg overflow-hidden bg-white border border-[#E8EBF0]"
                        role="group"
                        aria-label="Periode"
                    >
                        {PERIOD_OPTIONS.map((p) => (
                            <button
                                key={p.value}
                                onClick={() => setPeriod(p.value)}
                                aria-pressed={period === p.value}
                                className={cn(
                                    "px-3 py-1.5 text-[12px] font-medium transition-colors duration-150",
                                    period === p.value
                                        ? "bg-[#7C5CFC] text-white"
                                        : "text-[#8B8BA7] hover:text-[#12122A]"
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <Button
                            variant="ghost"
                            size="sm"
                            onClick={exportAllCsv}
                            disabled={opportunities.length === 0}
                            aria-label="Exporter tous les resultats"
                            className="gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Exporter CSV
                        </Button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-live="polite">
                <StatCard
                    label="Missions actives"
                    value={stats?.activeMissions ?? 0}
                    icon={Target}
                    iconBg="bg-[#EEF2FF]"
                    iconColor="text-[#7C5CFC]"
                    className="bg-white border-[#E8EBF0] rounded-xl hover:border-[#C5C8D4] [&_p]:text-[#12122A] [&_[class*='text-slate']]:text-[#8B8BA7]"
                />
                <StatCard
                    label="Entreprises contactees"
                    value={stats?.totalActions ?? 0}
                    icon={Phone}
                    iconBg="bg-[#EEF2FF]"
                    iconColor="text-[#7C5CFC]"
                    className="bg-white border-[#E8EBF0] rounded-xl hover:border-[#C5C8D4] [&_p]:text-[#12122A] [&_[class*='text-slate']]:text-[#8B8BA7]"
                />
                <StatCard
                    label="Personnes interessees"
                    value={stats?.resultBreakdown?.INTERESTED ?? 0}
                    icon={Users}
                    iconBg="bg-[#ECFDF5]"
                    iconColor="text-[#10B981]"
                    className="bg-white border-[#E8EBF0] rounded-xl hover:border-[#C5C8D4] [&_p]:text-[#12122A] [&_[class*='text-slate']]:text-[#8B8BA7]"
                />
                <StatCard
                    label="RDV obtenus"
                    value={stats?.meetingsBooked ?? 0}
                    icon={Calendar}
                    iconBg="bg-[#FFF7ED]"
                    iconColor="text-[#F59E0B]"
                    className="bg-white border-[#E8EBF0] rounded-xl hover:border-[#C5C8D4] [&_p]:text-[#12122A] [&_[class*='text-slate']]:text-[#8B8BA7]"
                />
            </div>

            {/* Conversion & Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Conversion Card */}
                <Card className="lg:col-span-1 border-[#E8EBF0] bg-white rounded-xl">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-[#7C5CFC]" />
                            </div>
                            <h3 className="font-semibold text-[#12122A]">Taux de conversion</h3>
                        </div>

                        <div className="text-center py-4">
                            <span className="text-5xl font-bold text-[#12122A] tabular-nums">
                                {conversionRate.toFixed(1)}%
                            </span>
                            <p className="text-sm text-[#8B8BA7] mt-2">RDV / entreprises contactees</p>
                        </div>

                        {/* Visual bar */}
                        <div className="space-y-2">
                            <div className="h-3 w-full bg-[#F4F6F9] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-[#7C5CFC] to-[#A78BFA] rounded-full transition-all duration-700"
                                    style={{ width: `${Math.min(conversionRate, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-[#8B8BA7]">
                                <span>0%</span>
                                <span>50%</span>
                                <span>100%</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[#E8EBF0] text-sm text-[#8B8BA7]">
                            <div className="flex justify-between">
                                <span>Entreprises contactees</span>
                                <span className="font-semibold text-[#12122A]">{stats?.totalActions ?? 0}</span>
                            </div>
                            <div className="flex justify-between mt-2">
                                <span>RDV obtenus</span>
                                <span className="font-semibold text-[#12122A]">{stats?.meetingsBooked ?? 0}</span>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Mission Performance */}
                <Card className="lg:col-span-2 border-[#E8EBF0] bg-white rounded-xl">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
                                    <BarChart3 className="w-5 h-5 text-[#7C5CFC]" />
                                </div>
                                <h3 className="font-semibold text-[#12122A]">Performance par mission</h3>
                            </div>
                            <Badge variant="primary">{missions.length} mission(s)</Badge>
                        </div>

                        {missions.length === 0 ? (
                            <EmptyState
                                icon={Target}
                                title="Aucune mission"
                                description="Les performances de vos missions apparaitront ici."
                                variant="inline"
                            />
                        ) : (
                            <div className="space-y-3">
                                {/* Table header */}
                                <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-[#8B8BA7] uppercase tracking-wider">
                                    <div className="col-span-5">Mission</div>
                                    <div className="col-span-2 text-center">SDRs</div>
                                    <div className="col-span-2 text-center">Statut</div>
                                    <div className="col-span-3 text-right">Actions</div>
                                </div>

                                {missions.map((mission) => (
                                    <div
                                        key={mission.id}
                                        className="client-mission-row grid grid-cols-12 gap-3 items-center"
                                    >
                                        <div className="col-span-5 flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-4 h-4 text-[#7C5CFC]" />
                                            </div>
                                            <span className="font-medium text-[#12122A] truncate">{mission.name}</span>
                                        </div>
                                        <div className="col-span-2 text-center text-sm text-[#8B8BA7]">
                                            {mission._count?.sdrAssignments ?? "-"}
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <Badge variant={mission.isActive ? "success" : "default"} className="text-xs">
                                                {mission.isActive ? "En cours" : "Pause"}
                                            </Badge>
                                        </div>
                                        <div className="col-span-3 flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs gap-1"
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch(`/api/client/missions/${mission.id}/export`);
                                                        if (!res.ok) throw new Error();
                                                        const blob = await res.blob();
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement("a");
                                                        a.href = url;
                                                        a.download = `${mission.name.replace(/[^a-z0-9]/gi, "_")}.csv`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                        toast.success("Export reussi");
                                                    } catch {
                                                        toast.error("Erreur d'export");
                                                    }
                                                }}
                                                aria-label={`Exporter ${mission.name}`}
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                CSV
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Activity Feed */}
            <Card className="border-[#E8EBF0] bg-white rounded-xl">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
                            <Clock className="w-5 h-5 text-[#7C5CFC]" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-[#12122A]">Activite recente</h3>
                            <p className="text-sm text-[#8B8BA7]">Derniers contacts et rendez-vous</p>
                        </div>
                    </div>

                    {activityFeed.length === 0 ? (
                        <EmptyState
                            icon={Zap}
                            title="Aucune activite"
                            description="L'activite de vos missions apparaitra ici."
                            variant="inline"
                        />
                    ) : (
                        <div className="space-y-1">
                            {activityFeed.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#F4F6F9] transition-colors"
                                    role="article"
                                    tabIndex={0}
                                >
                                    <div className={cn(
                                        "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                                        item.type === "meeting"
                                            ? "bg-[#ECFDF5]"
                                            : "bg-[#EEF2FF]"
                                    )}>
                                        {item.type === "meeting" ? (
                                            <Calendar className="w-4 h-4 text-emerald-600" />
                                        ) : (
                                            <Building2 className="w-4 h-4 text-[#7C5CFC]" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[#12122A] truncate">{item.title}</p>
                                        <p className="text-xs text-[#8B8BA7] truncate">
                                            {item.subtitle}
                                            {item.mission && ` \u00b7 ${item.mission}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <Badge
                                            variant={item.type === "meeting" ? "success" : "primary"}
                                            className="text-xs"
                                        >
                                            {item.type === "meeting" ? "RDV" : "Contact"}
                                        </Badge>
                                        <span className="text-xs text-[#8B8BA7] whitespace-nowrap">
                                            {formatDate(item.date)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
