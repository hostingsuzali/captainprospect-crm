"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
    Card,
    Badge,
    Button,
    PageHeader,
    StatCard,
    EmptyState,
    StatCardSkeleton,
    CardSkeleton,
    useToast,
} from "@/components/ui";
import {
    Target,
    Phone,
    MessageSquare,
    Calendar,
    TrendingUp,
    Download,
    Building2,
    User,
    Clock,
    CheckCircle2,
    RefreshCw,
    Sparkles,
    ArrowRight,
    Video,
    BarChart3,
    FileDown,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientOnboardingModal } from "@/components/client/ClientOnboardingModal";

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

interface Opportunity {
    id: string;
    needSummary: string;
    urgency: "SHORT" | "MEDIUM" | "LONG";
    estimatedMin?: number;
    estimatedMax?: number;
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
        industry?: string;
    };
}

interface MissionList {
    id: string;
    name: string;
    type?: string;
}

interface Mission {
    id: string;
    name: string;
    isActive: boolean;
    lists?: MissionList[];
    _count?: { sdrAssignments: number };
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

const URGENCY_LABELS: Record<string, { label: string; class: string }> = {
    SHORT: { label: "Court terme", class: "text-rose-700 bg-rose-50 border-rose-200" },
    MEDIUM: { label: "Moyen terme", class: "text-amber-700 bg-amber-50 border-amber-200" },
    LONG: { label: "Long terme", class: "text-emerald-700 bg-emerald-50 border-emerald-200" },
};

const PERIOD_OPTIONS = [
    { value: "today", label: "Aujourd'hui" },
    { value: "week", label: "7 jours" },
    { value: "month", label: "30 jours" },
];

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon apres-midi";
    return "Bonsoir";
}

// ============================================
// PERIOD SELECTOR COMPONENT
// ============================================

function PeriodSelector({
    period,
    onChange,
}: {
    period: string;
    onChange: (v: string) => void;
}) {
    return (
        <div
            className="flex rounded-xl overflow-hidden bg-white/10 backdrop-blur border border-white/20"
            role="group"
            aria-label="Periode de temps"
        >
            {PERIOD_OPTIONS.map((p) => (
                <button
                    key={p.value}
                    onClick={() => onChange(p.value)}
                    aria-pressed={period === p.value}
                    className={cn(
                        "px-4 py-2.5 text-sm font-medium transition-all",
                        period === p.value
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-white/90 hover:bg-white/10"
                    )}
                >
                    {p.label}
                </button>
            ))}
        </div>
    );
}

// ============================================
// OPPORTUNITY CARD COMPONENT
// ============================================

function OpportunityCard({ opp, formatDate }: { opp: Opportunity; formatDate: (s: string) => string }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className="client-opp-card group bg-white rounded-2xl border border-slate-200 p-6 hover:border-indigo-200 hover:shadow-lg transition-all duration-200"
            role="article"
            tabIndex={0}
            aria-label={`Opportunite ${opp.company.name}`}
        >
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Building2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{opp.company.name}</h3>
                        <span
                            className={cn(
                                "text-xs font-medium px-2.5 py-1 rounded-full border",
                                URGENCY_LABELS[opp.urgency]?.class ?? "bg-slate-100 text-slate-600 border-slate-200"
                            )}
                        >
                            {URGENCY_LABELS[opp.urgency]?.label ?? opp.urgency}
                        </span>
                        {opp.handedOff && (
                            <Badge variant="success">Transmis</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-sm text-slate-500">
                        <User className="w-4 h-4 flex-shrink-0" />
                        <span>
                            {[opp.contact.firstName, opp.contact.lastName].filter(Boolean).join(" ") || "\u2014"}
                            {opp.contact.title && ` \u00b7 ${opp.contact.title}`}
                        </span>
                    </div>
                    {opp.needSummary && (
                        <div className="mt-3">
                            <p className={cn(
                                "text-sm text-slate-600 leading-relaxed",
                                !expanded && "line-clamp-2"
                            )}>
                                {opp.needSummary}
                            </p>
                            {opp.needSummary.length > 120 && (
                                <button
                                    onClick={() => setExpanded(!expanded)}
                                    className="flex items-center gap-1 mt-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                                    aria-expanded={expanded}
                                >
                                    {expanded ? (
                                        <>Voir moins <ChevronUp className="w-3 h-3" /></>
                                    ) : (
                                        <>Voir plus <ChevronDown className="w-3 h-3" /></>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between mt-4 pt-4 border-t border-slate-100 gap-2">
                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                            <Clock className="w-4 h-4" />
                            {opp.handedOffAt
                                ? `Transmis le ${formatDate(opp.handedOffAt)}`
                                : `Cree le ${formatDate(opp.createdAt)}`}
                        </div>
                        {(opp.estimatedMin != null || opp.estimatedMax != null) && (
                            <span className="text-sm font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg">
                                {[opp.estimatedMin, opp.estimatedMax]
                                    .filter(Boolean)
                                    .map((v) => `${v?.toLocaleString()}\u20ac`)
                                    .join(" \u2013 ")}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================
// MAIN DASHBOARD PAGE
// ============================================

export default function ClientPortal() {
    const { data: session, update } = useSession();
    const toast = useToast();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [meetings, setMeetings] = useState<ClientMeeting[]>([]);
    const [period, setPeriod] = useState("month");
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Onboarding modal state
    const [dismissedForThisVisit, setDismissedForThisVisit] = useState(false);
    const showOnboarding =
        session?.user?.role === "CLIENT" &&
        !(session.user as { clientOnboardingDismissedPermanently?: boolean })?.clientOnboardingDismissedPermanently &&
        !dismissedForThisVisit;

    const handleDismissOnboardingPermanently = async () => {
        const res = await fetch("/api/client/onboarding-dismissed", { method: "PATCH" });
        if (!res.ok) throw new Error("Failed to dismiss");
        await update();
    };

    const clientId = (session?.user as { clientId?: string })?.clientId;
    const userName = session?.user?.name?.split(" ")[0] ?? "Client";

    const fetchData = useCallback(async (refresh = false) => {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        try {
            const [statsRes, oppsRes, missionsRes, meetingsRes] = await Promise.all([
                fetch(`/api/stats?period=${period}`),
                fetch("/api/opportunities?limit=10"),
                fetch("/api/missions?isActive=true"),
                clientId ? fetch(`/api/clients/${clientId}/meetings`) : Promise.resolve(null),
            ]);

            const [statsJson, oppsJson, missionsJson, meetingsJson] = await Promise.all([
                statsRes.json(),
                oppsRes.json(),
                missionsRes.json(),
                meetingsRes?.ok ? meetingsRes.json() : Promise.resolve(null),
            ]);

            if (statsJson.success) setStats(statsJson.data);
            if (oppsJson.success) setOpportunities(Array.isArray(oppsJson.data) ? oppsJson.data : []);
            if (missionsJson.success) setMissions(Array.isArray(missionsJson.data) ? missionsJson.data : []);
            if (meetingsJson?.success) {
                const data = meetingsJson.data as MeetingsResponse;
                setMeetings(data?.allMeetings ?? []);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast.error("Erreur de chargement", "Impossible de charger les donnees du tableau de bord");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [period, clientId, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        // Trigger staggered mount animation
        const timer = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(timer);
    }, []);

    const CLIENT_STATS = [
        { label: "Missions en cours", value: stats?.activeMissions ?? 0, icon: Target, iconBg: "bg-indigo-100", iconColor: "text-indigo-600" },
        { label: "Entreprises contactees", value: stats?.totalActions ?? 0, icon: Phone, iconBg: "bg-violet-100", iconColor: "text-violet-600" },
        { label: "Personnes interessees", value: stats?.resultBreakdown?.INTERESTED ?? 0, icon: MessageSquare, iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
        { label: "RDV pris pour vous", value: stats?.meetingsBooked ?? 0, icon: Calendar, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
    ];

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });

    const exportOpportunitiesCsv = () => {
        if (opportunities.length === 0) return;
        try {
            const headers = ["Entreprise", "Contact", "Titre", "Besoin", "Urgence", "Transmis", "Date"];
            const rows = opportunities.map((o) => [
                o.company.name,
                [o.contact.firstName, o.contact.lastName].filter(Boolean).join(" ") || "-",
                o.contact.title || "-",
                (o.needSummary || "").replace(/"/g, '""'),
                URGENCY_LABELS[o.urgency]?.label ?? o.urgency,
                o.handedOff ? "Oui" : "Non",
                formatDate(o.handedOffAt || o.createdAt),
            ]);
            const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
            const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `opportunites-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Export reussi", `${opportunities.length} opportunite(s) exportee(s)`);
        } catch {
            toast.error("Erreur d'export", "Impossible d'exporter les opportunites");
        }
    };

    const exportMissionCsv = async (missionId: string) => {
        try {
            const res = await fetch(`/api/client/missions/${missionId}/export`);
            if (!res.ok) throw new Error("Export echoue");
            const blob = await res.blob();
            const disposition = res.headers.get("Content-Disposition");
            const filename = disposition?.match(/filename="(.+)"/)?.[1] ?? `mission-${missionId}.csv`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Export reussi", "Le fichier a ete telecharge");
        } catch {
            toast.error("Erreur d'export", "Impossible d'exporter la mission");
        }
    };

    const exportListCsv = async (listId: string, listName: string) => {
        try {
            const res = await fetch(`/api/lists/${listId}/export`);
            if (!res.ok) throw new Error("Export echoue");
            const blob = await res.blob();
            const disposition = res.headers.get("Content-Disposition");
            const filename = disposition?.match(/filename="(.+)"/)?.[1] ?? `${listName.replace(/[^a-z0-9]/gi, "_")}.csv`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Export reussi", `"${listName}" telecharge`);
        } catch {
            toast.error("Erreur d'export", "Impossible d'exporter la liste");
        }
    };

    // ============================================
    // LOADING SKELETON STATE
    // ============================================

    if (isLoading && !stats) {
        return (
            <div className="space-y-8">
                {/* Hero skeleton */}
                <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-8 shadow-xl">
                    <div className="space-y-3">
                        <div className="h-4 w-32 rounded bg-white/20 animate-pulse" />
                        <div className="h-8 w-64 rounded bg-white/20 animate-pulse" />
                        <div className="h-4 w-80 rounded bg-white/10 animate-pulse" />
                    </div>
                </div>

                {/* Stats skeleton */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <StatCardSkeleton key={i} />
                    ))}
                </div>

                {/* Content skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <CardSkeleton hasHeader lines={3} />
                        <CardSkeleton hasHeader lines={3} />
                    </div>
                    <div className="space-y-4">
                        <CardSkeleton hasHeader={false} lines={2} />
                        <CardSkeleton hasHeader={false} lines={2} />
                        <CardSkeleton hasHeader={false} lines={2} />
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // MAIN RENDER
    // ============================================

    return (
        <div className={cn("space-y-8", mounted && "client-dashboard-mounted")}>
            {/* Hero Header */}
            <PageHeader
                variant="hero"
                title="Votre tableau de bord"
                subtitle="Suivi en temps reel de vos missions et des contacts qualifies"
                icon={
                    <span className="flex items-center gap-2 text-indigo-300 text-sm font-medium">
                        <Sparkles className="w-4 h-4" />
                        {getGreeting()}, {userName}
                    </span>
                }
                actions={
                    <div className="flex items-center gap-3">
                        <PeriodSelector period={period} onChange={setPeriod} />
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => fetchData(true)}
                            disabled={isRefreshing}
                            aria-busy={isRefreshing}
                            aria-label="Actualiser les donnees"
                            className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                            <span className="hidden sm:inline">Actualiser</span>
                        </Button>
                    </div>
                }
            />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-live="polite">
                {CLIENT_STATS.map((stat) => (
                    <StatCard
                        key={stat.label}
                        label={stat.label}
                        value={stat.value}
                        icon={stat.icon}
                        iconBg={stat.iconBg}
                        iconColor={stat.iconColor}
                        className="client-kpi-card"
                    />
                ))}
            </div>

            {/* Conversion Rate Banner */}
            {stats && stats.totalActions > 0 && (
                <Card className="border-0 bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                            <BarChart3 className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold">Taux de conversion (RDV / contacts)</h3>
                            <p className="text-slate-300 text-sm mt-0.5">
                                {stats.meetingsBooked} RDV pour {stats.totalActions} entreprises contactees
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-bold text-emerald-400 tabular-nums">
                                {stats.conversionRate?.toFixed(1) ?? 0}%
                            </span>
                        </div>
                    </div>
                </Card>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Opportunities */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-slate-900">
                                Contacts qualifies pour vous
                            </h2>
                            <Badge variant="primary">{opportunities.length}</Badge>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={exportOpportunitiesCsv}
                            disabled={opportunities.length === 0}
                            aria-label="Exporter les opportunites en CSV"
                            className="gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Exporter CSV
                        </Button>
                    </div>

                    {opportunities.length === 0 ? (
                        <EmptyState
                            icon={Sparkles}
                            title="Aucun contact qualifie pour le moment"
                            description="Les personnes interessees par vos offres apparaitront ici des qu'elles seront identifiees par notre equipe."
                        />
                    ) : (
                        <div className="space-y-4">
                            {opportunities.map((opp) => (
                                <OpportunityCard key={opp.id} opp={opp} formatDate={formatDate} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar: Missions + Meetings + CTA */}
                <div className="space-y-6">
                    {/* Missions */}
                    <div className="client-panel">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-500" />
                            Vos missions
                        </h2>
                        {missions.length === 0 ? (
                            <EmptyState
                                icon={Target}
                                title="Aucune mission en cours"
                                description="Vos missions apparaitront ici une fois lancees."
                                variant="inline"
                            />
                        ) : (
                            <div className="space-y-3">
                                {missions.map((mission) => (
                                    <Card key={mission.id} className="border-slate-200 bg-white overflow-hidden">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 truncate">{mission.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    Equipe dediee
                                                    {mission._count?.sdrAssignments != null && ` \u00b7 ${mission._count.sdrAssignments} SDR(s)`}
                                                </p>
                                            </div>
                                            <Badge variant={mission.isActive ? "success" : "default"}>
                                                {mission.isActive ? "En cours" : "Pause"}
                                            </Badge>
                                        </div>
                                        {/* Export options */}
                                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => exportMissionCsv(mission.id)}
                                                    aria-label={`Exporter la mission ${mission.name}`}
                                                    className="gap-1.5 text-xs h-8"
                                                >
                                                    <FileDown className="w-3.5 h-3.5" />
                                                    Exporter (CSV)
                                                </Button>
                                                {(mission.lists ?? []).map((list) => (
                                                    <Button
                                                        key={list.id}
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => exportListCsv(list.id, list.name)}
                                                        aria-label={`Exporter la liste ${list.name}`}
                                                        className="gap-1.5 text-xs h-8"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        {list.name}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Meetings */}
                    {meetings.length > 0 && (
                        <div className="client-panel">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <Video className="w-5 h-5 text-indigo-500" />
                                RDV planifies
                            </h2>
                            <div className="space-y-3">
                                {meetings.slice(0, 5).map((m) => (
                                    <Card
                                        key={m.id}
                                        className="border-slate-200 bg-white"
                                        role="article"
                                        tabIndex={0}
                                        aria-label={`RDV avec ${[m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "Contact"}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                <Calendar className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 truncate">
                                                    {[m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "Contact"} &middot; {m.contact.company.name}
                                                </p>
                                                <p className="text-xs text-slate-500">{m.campaign.mission.name}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{formatDate(m.createdAt)}</p>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Contact CTA */}
                    <Link href="/client/contact">
                        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 hover:border-indigo-300 transition-all cursor-pointer group shadow-md hover:shadow-lg">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                                    <MessageSquare className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-indigo-900">Contacter l&apos;equipe</p>
                                    <p className="text-sm text-indigo-700">Echanger avec les SDR de vos missions</p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-indigo-500 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Card>
                    </Link>

                    {/* Results CTA */}
                    <Link href="/client/results">
                        <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:border-slate-300 transition-all cursor-pointer group shadow-sm hover:shadow-md mt-3">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                                    <BarChart3 className="w-6 h-6 text-slate-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-900">Voir les resultats</p>
                                    <p className="text-sm text-slate-500">Analyse detaillee de vos missions</p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Card>
                    </Link>
                </div>
            </div>

            {/* Info Notice */}
            <Card className="border-slate-200 bg-slate-50/80" role="note" aria-label="Information sur les donnees">
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-medium text-slate-900">Donnees a jour</h3>
                        <p className="text-sm text-slate-600 mt-1">
                            Les indicateurs et contacts sont mis a jour automatiquement. Les opportunites vous sont transmises des qu&apos;elles sont qualifiees.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Client onboarding modal */}
            <ClientOnboardingModal
                isOpen={showOnboarding}
                onClose={() => setDismissedForThisVisit(true)}
                onDismissPermanently={handleDismissOnboardingPermanently}
            />
        </div>
    );
}
