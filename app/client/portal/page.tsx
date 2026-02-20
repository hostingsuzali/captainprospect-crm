"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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
    DateRangeFilter,
    getPresetRange,
    toISO,
    type DateRangeValue,
    type DateRangePreset,
} from "@/components/dashboard/DateRangeFilter";
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
    ArrowRight,
    Sparkles,
    Video,
    BarChart3,
    FileDown,
    ChevronDown,
    ChevronUp,
    Loader2,
    Mail,
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

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon apres-midi";
    return "Bonsoir";
}

// ============================================
// OPPORTUNITY CARD COMPONENT
// ============================================

function OpportunityCard({ opp, formatDate }: { opp: Opportunity; formatDate: (s: string) => string }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className="client-opp-card group bg-white rounded-xl border border-[#E8EBF0] p-6 hover:border-[#C5C8D4] hover:shadow-md transition-all duration-150"
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
                        <h3 className="font-semibold text-[#12122A]">{opp.company.name}</h3>
                        <span
                            className={cn(
                                "text-xs font-medium px-2.5 py-1 rounded-full border",
                                URGENCY_LABELS[opp.urgency]?.class ?? "bg-[#F4F6F9] text-[#8B8BA7] border-[#E8EBF0]"
                            )}
                        >
                            {URGENCY_LABELS[opp.urgency]?.label ?? opp.urgency}
                        </span>
                        {opp.handedOff && (
                            <Badge variant="success">Transmis</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-sm text-[#8B8BA7]">
                        <User className="w-4 h-4 flex-shrink-0" />
                        <span>
                            {[opp.contact.firstName, opp.contact.lastName].filter(Boolean).join(" ") || "\u2014"}
                            {opp.contact.title && ` \u00b7 ${opp.contact.title}`}
                        </span>
                    </div>
                    {opp.needSummary && (
                        <div className="mt-3">
                            <p className={cn(
                                "text-sm text-[#8B8BA7] leading-relaxed",
                                !expanded && "line-clamp-2"
                            )}>
                                {opp.needSummary}
                            </p>
                            {opp.needSummary.length > 120 && (
                                <button
                                    onClick={() => setExpanded(!expanded)}
                                    className="flex items-center gap-1 mt-1.5 text-xs font-medium text-[#7C5CFC] hover:text-[#6C4CE0] transition-colors"
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
                    <div className="flex flex-wrap items-center justify-between mt-4 pt-4 border-t border-[#E8EBF0] gap-2">
                        <div className="flex items-center gap-1.5 text-sm text-[#8B8BA7]">
                            <Clock className="w-4 h-4" />
                            {opp.handedOffAt
                                ? `Transmis le ${formatDate(opp.handedOffAt)}`
                                : `Cree le ${formatDate(opp.createdAt)}`}
                        </div>
                        {(opp.estimatedMin != null || opp.estimatedMax != null) && (
                            <span className="text-sm font-semibold text-[#12122A] bg-[#F4F6F9] px-2.5 py-1 rounded-lg">
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
    const [emailActivity, setEmailActivity] = useState<{
        connected: boolean;
        sentThisWeek: number;
        opens: number;
        replies: number;
    } | null>(null);
    const [dateRange, setDateRange] = useState<DateRangeValue>(() => {
        const { start, end } = getPresetRange("monthToDate");
        return { preset: "monthToDate", startDate: toISO(start), endDate: toISO(end) };
    });
    const [dateFilterOpen, setDateFilterOpen] = useState(false);
    const dateFilterRef = useRef<HTMLDivElement>(null);
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
            let start = dateRange.startDate;
            let end = dateRange.endDate;
            if (!start || !end) {
                const r = getPresetRange((dateRange.preset as DateRangePreset) || "monthToDate");
                start = toISO(r.start);
                end = toISO(r.end);
            }
            const statsUrl = start && end ? `/api/stats?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}` : "/api/stats";
            const [statsRes, oppsRes, missionsRes, meetingsRes, emailActivityRes] = await Promise.all([
                fetch(statsUrl),
                fetch("/api/opportunities?limit=10"),
                fetch("/api/missions?isActive=true"),
                clientId ? fetch(`/api/clients/${clientId}/meetings`) : Promise.resolve(null),
                fetch("/api/client/email-activity"),
            ]);

            const [statsJson, oppsJson, missionsJson, meetingsJson, emailActivityJson] = await Promise.all([
                statsRes.json(),
                oppsRes.json(),
                missionsRes.json(),
                meetingsRes?.ok ? meetingsRes.json() : Promise.resolve(null),
                emailActivityRes?.ok ? emailActivityRes.json() : Promise.resolve(null),
            ]);

            if (statsJson.success) setStats(statsJson.data);
            if (oppsJson.success) setOpportunities(Array.isArray(oppsJson.data) ? oppsJson.data : []);
            if (missionsJson.success) setMissions(Array.isArray(missionsJson.data) ? missionsJson.data : []);
            if (meetingsJson?.success) {
                const data = meetingsJson.data as MeetingsResponse;
                setMeetings(data?.allMeetings ?? []);
            }
            if (emailActivityJson?.success && emailActivityJson.data) {
                setEmailActivity(emailActivityJson.data);
            } else {
                setEmailActivity(null);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast.error("Erreur de chargement", "Impossible de charger les donnees du tableau de bord");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [dateRange, clientId, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        // Trigger staggered mount animation
        const timer = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(timer);
    }, []);

    const CLIENT_STATS = [
        { label: "Missions en cours", value: stats?.activeMissions ?? 0, icon: Target, iconBg: "bg-[#EEF2FF]", iconColor: "text-[#7C5CFC]" },
        { label: "Entreprises contactees", value: stats?.totalActions ?? 0, icon: Phone, iconBg: "bg-[#EEF2FF]", iconColor: "text-[#7C5CFC]" },
        { label: "Personnes interessees", value: stats?.resultBreakdown?.INTERESTED ?? 0, icon: MessageSquare, iconBg: "bg-[#ECFDF5]", iconColor: "text-[#10B981]" },
        { label: "RDV pris pour vous", value: stats?.meetingsBooked ?? 0, icon: Calendar, iconBg: "bg-[#FFF7ED]", iconColor: "text-[#F59E0B]" },
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

    const dateRangeLabel = dateRange.preset ? PRESET_LABELS[dateRange.preset] : "Plage de dates";

    if (isLoading && !stats) {
        return (
            <div className="min-h-full bg-[#F4F6F9] p-6">
                <div className="flex flex-col items-center justify-center py-32">
                    <Loader2 className="w-8 h-8 text-[#7C5CFC] animate-spin" />
                    <p className="text-[13px] text-[#8B8BA7] font-medium mt-4">Chargement du tableau de bord...</p>
                </div>
            </div>
        );
    }

    // ============================================
    // MAIN RENDER
    // ============================================

    return (
        <div className={cn("min-h-full bg-[#F4F6F9] p-6 space-y-6", mounted && "client-dashboard-mounted")}>
            {/* Page Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-bold text-[#12122A] tracking-tight">
                        Votre tableau de bord
                    </h1>
                    <p className="text-[13px] text-[#8B8BA7] mt-0.5">
                        {dateRangeLabel} · {getGreeting()}, {userName}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative" ref={dateFilterRef}>
                        <button
                            type="button"
                            onClick={() => setDateFilterOpen((o) => !o)}
                            className="flex items-center gap-2 h-10 px-4 text-sm font-medium text-[#12122A] bg-white border border-[#E8EBF0] rounded-lg hover:bg-[#F4F6F9] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/50"
                        >
                            <Calendar className="w-4 h-4 text-[#7C5CFC]" />
                            <span>{dateRangeLabel}</span>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-[#8B8BA7] ml-1", dateFilterOpen && "rotate-180")} />
                        </button>
                        {dateFilterOpen && (
                            <>
                                <div className="fixed inset-0 z-[100]" aria-hidden onClick={() => setDateFilterOpen(false)} />
                                <div className="absolute right-0 top-full mt-1 z-[110] max-w-[calc(100vw-2rem)]">
                                    <DateRangeFilter
                                        value={dateRange}
                                        onChange={setDateRange}
                                        onClose={() => setDateFilterOpen(false)}
                                        isOpen={true}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => fetchData(true)}
                        disabled={isRefreshing}
                        className="w-8 h-8 rounded-lg border border-[#E8EBF0] flex items-center justify-center text-[#8B8BA7] hover:text-[#12122A] hover:border-[#C5C8D4] transition-colors duration-150 disabled:opacity-50 bg-white"
                        title="Rafraîchir"
                        aria-label="Actualiser les donnees"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                    </button>
                </div>
            </div>

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
                        className="bg-white border-[#E8EBF0] rounded-xl hover:border-[#C5C8D4] transition-colors duration-150 [&_p]:text-[#12122A] [&_[class*='text-slate']]:text-[#8B8BA7]"
                    />
                ))}
            </div>

            {/* Conversion Rate Banner */}
            {stats && stats.totalActions > 0 && (
                <div className="bg-gradient-to-br from-[#1A1040] to-[#12122A] rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-[#7C5CFC]/10 rounded-full blur-3xl" />
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#7C5CFC]/20 flex items-center justify-center">
                            <BarChart3 className="w-7 h-7 text-[#A78BFA]" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-white">Taux de conversion (RDV / contacts)</h3>
                            <p className="text-[#8B8BA7] text-sm mt-0.5">
                                {stats.meetingsBooked} RDV pour {stats.totalActions} entreprises contactees
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-bold text-[#10B981] tabular-nums">
                                {stats.conversionRate?.toFixed(1) ?? 0}%
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Opportunities */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-[#12122A]">
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
                        <h2 className="text-lg font-semibold text-[#12122A] mb-4 flex items-center gap-2">
                            <Target className="w-5 h-5 text-[#7C5CFC]" />
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
                                    <Card key={mission.id} className="border-[#E8EBF0] bg-white overflow-hidden rounded-xl hover:border-[#C5C8D4] transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-4 h-4 text-[#7C5CFC]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-[#12122A] truncate">{mission.name}</p>
                                                <p className="text-xs text-[#8B8BA7]">
                                                    Equipe dediee
                                                    {mission._count?.sdrAssignments != null && ` \u00b7 ${mission._count.sdrAssignments} SDR(s)`}
                                                </p>
                                            </div>
                                            <Badge variant={mission.isActive ? "success" : "default"}>
                                                {mission.isActive ? "En cours" : "Pause"}
                                            </Badge>
                                        </div>
                                        {/* Export options */}
                                        <div className="mt-3 pt-3 border-t border-[#E8EBF0] space-y-2">
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

                    {/* Email Activity */}
                    <div className="client-panel">
                        <h2 className="text-lg font-semibold text-[#12122A] mb-4 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-[#7C5CFC]" />
                            Activité email
                        </h2>
                        <Link href="/client/portal/email">
                            <Card className="border-[#E8EBF0] bg-white hover:border-[#C5C8D4] hover:shadow-md transition-all cursor-pointer group rounded-xl">
                                {emailActivity?.connected ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-[#8B8BA7]">
                                            Depuis votre boîte connectée
                                        </p>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <p className="text-xl font-bold text-[#12122A] tabular-nums">
                                                    {emailActivity.sentThisWeek}
                                                </p>
                                                <p className="text-xs text-[#8B8BA7]">envoyés cette semaine</p>
                                            </div>
                                            <div>
                                                <p className="text-xl font-bold text-[#12122A] tabular-nums">
                                                    {emailActivity.opens}
                                                </p>
                                                <p className="text-xs text-[#8B8BA7]">ouvertures</p>
                                            </div>
                                            <div>
                                                <p className="text-xl font-bold text-[#12122A] tabular-nums">
                                                    {emailActivity.replies}
                                                </p>
                                                <p className="text-xs text-[#8B8BA7]">réponses</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-1 text-sm font-medium text-[#7C5CFC] group-hover:underline">
                                            Voir Mon Email
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="text-sm text-[#8B8BA7]">
                                            Connectez votre boîte pour voir l&apos;activité
                                        </p>
                                        <ArrowRight className="w-5 h-5 text-[#7C5CFC] group-hover:translate-x-1 transition-transform flex-shrink-0" />
                                    </div>
                                )}
                            </Card>
                        </Link>
                    </div>

                    {/* Recent Meetings */}
                    {meetings.length > 0 && (
                        <div className="client-panel">
                            <h2 className="text-lg font-semibold text-[#12122A] mb-4 flex items-center gap-2">
                                <Video className="w-5 h-5 text-[#7C5CFC]" />
                                RDV planifies
                            </h2>
                            <div className="space-y-3">
                                {meetings.slice(0, 5).map((m) => (
                                    <Card
                                        key={m.id}
                                        className="border-[#E8EBF0] bg-white rounded-xl"
                                        role="article"
                                        tabIndex={0}
                                        aria-label={`RDV avec ${[m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "Contact"}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                <Calendar className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-[#12122A] truncate">
                                                    {[m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "Contact"} &middot; {m.contact.company.name}
                                                </p>
                                                <p className="text-xs text-[#8B8BA7]">{m.campaign.mission.name}</p>
                                                <p className="text-xs text-[#8B8BA7]/80 mt-0.5">{formatDate(m.createdAt)}</p>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Contact CTA */}
                    <Link href="/client/contact">
                        <Card className="border-[#E8EBF0] bg-white hover:border-[#C5C8D4] hover:shadow-md transition-all cursor-pointer group rounded-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] flex items-center justify-center group-hover:bg-[#E0E7FF] transition-colors">
                                    <MessageSquare className="w-6 h-6 text-[#7C5CFC]" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-[#12122A]">Contacter l&apos;equipe</p>
                                    <p className="text-sm text-[#8B8BA7]">Echanger avec les SDR de vos missions</p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-[#7C5CFC] group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Card>
                    </Link>

                    {/* Results CTA */}
                    <Link href="/client/results">
                        <Card className="border-[#E8EBF0] bg-white hover:border-[#C5C8D4] transition-all cursor-pointer group rounded-xl mt-3">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] flex items-center justify-center group-hover:bg-[#E0E7FF] transition-colors">
                                    <BarChart3 className="w-6 h-6 text-[#7C5CFC]" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-[#12122A]">Voir les resultats</p>
                                    <p className="text-sm text-[#8B8BA7]">Analyse detaillee de vos missions</p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-[#7C5CFC] group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Card>
                    </Link>
                </div>
            </div>

            {/* Info Notice */}
            <Card className="border-[#E8EBF0] bg-white rounded-xl" role="note" aria-label="Information sur les donnees">
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-5 h-5 text-[#7C5CFC]" />
                    </div>
                    <div>
                        <h3 className="font-medium text-[#12122A]">Donnees a jour</h3>
                        <p className="text-sm text-[#8B8BA7] mt-1">
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
