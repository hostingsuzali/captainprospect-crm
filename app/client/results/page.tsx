"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Button, Badge, Modal, useToast } from "@/components/ui";
import {
    Download, Search, X, Calendar, Building2, User,
    Lightbulb, ArrowRight, Mail, Phone, Loader2,
    Target, PhoneCall, Percent, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ResultsSkeleton } from "@/components/client/skeletons";

interface DashboardStats {
    totalActions: number;
    meetingsBooked: number;
    contactsReached: number;
    monthlyObjective: number;
    activeMissions: number;
    conversionRate: number;
}

interface Meeting {
    id: string;
    createdAt: string;
    callbackDate?: string | null;
    note?: string | null;
    result?: string;
    contact: {
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
        email?: string | null;
        phone?: string | null;
        company: { name: string; industry?: string | null };
    };
    campaign: { name: string; mission: { id: string; name: string } };
    sdr?: { name: string | null } | null;
    meetingFeedback?: {
        outcome: string;
        recontactRequested: string;
        clientNote?: string | null;
    } | null;
}

interface Mission { id: string; name: string }

type Mode = "chiffres" | "liste";

const OUTCOME_LABELS: Record<string, { label: string; class: string }> = {
    POSITIVE: { label: "Positif", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    NEUTRAL: { label: "Neutre", class: "bg-blue-50 text-blue-700 border-blue-200" },
    NEGATIVE: { label: "Negatif", class: "bg-red-50 text-red-700 border-red-200" },
    NO_SHOW: { label: "Pas eu lieu", class: "bg-slate-100 text-slate-600 border-slate-200" },
};

const MONTH_NAMES = [
    "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

export default function ClientResultsPage() {
    const { data: session } = useSession();
    const toast = useToast();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [mode, setMode] = useState<Mode>("chiffres");
    const [searchQuery, setSearchQuery] = useState("");
    const [missionFilter, setMissionFilter] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

    const clientId = (session?.user as { clientId?: string })?.clientId;
    const now = new Date();
    const currentMonth = MONTH_NAMES[now.getMonth()];
    const currentYear = now.getFullYear();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            const startDate = monthStart.toISOString().split("T")[0];
            const endDate = monthEnd.toISOString().split("T")[0];

            const [statsRes, meetingsRes, missionsRes] = await Promise.all([
                fetch(`/api/stats?startDate=${startDate}&endDate=${endDate}`),
                clientId ? fetch(`/api/clients/${clientId}/meetings`) : Promise.resolve(null),
                fetch("/api/missions?isActive=true"),
            ]);

            const [statsJson, meetingsJson, missionsJson] = await Promise.all([
                statsRes.json(),
                meetingsRes?.ok ? meetingsRes.json() : Promise.resolve(null),
                missionsRes.json(),
            ]);

            if (statsJson.success) setStats(statsJson.data);
            if (meetingsJson?.success) setMeetings(meetingsJson.data?.allMeetings ?? []);
            if (missionsJson.success) {
                const missionList: Mission[] = (missionsJson.data ?? []).map((m: Mission) => ({ id: m.id, name: m.name }));
                setMissions(missionList);
            }
        } catch (error) {
            console.error("Failed to fetch:", error);
            toast.error("Erreur de chargement", "Impossible de charger les resultats");
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredMeetings = useMemo(() => {
        let list = meetings;
        if (missionFilter) {
            list = list.filter((m) => m.campaign.mission.id === missionFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((m) => {
                const name = [m.contact.firstName, m.contact.lastName].join(" ").toLowerCase();
                const company = m.contact.company.name.toLowerCase();
                const note = (m.note || "").toLowerCase();
                return name.includes(q) || company.includes(q) || note.includes(q);
            });
        }
        return list.sort((a, b) => new Date(b.callbackDate || b.createdAt).getTime() - new Date(a.callbackDate || a.createdAt).getTime());
    }, [meetings, searchQuery, missionFilter]);

    const bestSegment = useMemo(() => {
        const industryMap = new Map<string, number>();
        for (const m of meetings) {
            const ind = m.contact.company.industry || "Autre";
            industryMap.set(ind, (industryMap.get(ind) || 0) + 1);
        }
        let best = { name: "—", count: 0 };
        for (const [name, count] of industryMap) {
            if (count > best.count) best = { name, count };
        }
        return best;
    }, [meetings]);

    const exportCSV = () => {
        try {
            const headers = ["Nom", "Titre", "Entreprise", "Date", "Resultat", "Note SDR"];
            const rows = filteredMeetings.map((m) => [
                [m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "-",
                m.contact.title || "-",
                m.contact.company.name,
                new Date(m.callbackDate || m.createdAt).toLocaleDateString("fr-FR"),
                m.meetingFeedback ? (OUTCOME_LABELS[m.meetingFeedback.outcome]?.label ?? "—") : "En attente",
                (m.note || "").replace(/"/g, '""'),
            ]);
            const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
            const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `resultats-rdv-${now.getMonth() + 1}-${now.getFullYear()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Export reussi", `${filteredMeetings.length} RDV exporte(s)`);
        } catch {
            toast.error("Erreur d'export");
        }
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

    if (isLoading && !stats) return <ResultsSkeleton />;

    const meetingsCount = stats?.meetingsBooked ?? 0;
    const objective = stats?.monthlyObjective ?? 10;
    const contactRate = stats && stats.totalActions > 0
        ? Math.round((stats.contactsReached / stats.totalActions) * 100)
        : 0;

    const statRows = [
        {
            icon: Target,
            label: "RDV obtenus",
            value: meetingsCount,
            suffix: "",
            subtext: `objectif : ${objective}`,
            color: "from-[#6C3AFF] to-[#7C5CFC]",
            bgColor: "from-violet-50 to-indigo-50",
            hasProgress: true,
        },
        {
            icon: PhoneCall,
            label: "Appels realises",
            value: stats?.totalActions ?? 0,
            suffix: "",
            subtext: null,
            color: "from-blue-500 to-cyan-500",
            bgColor: "from-blue-50 to-cyan-50",
            hasProgress: false,
        },
        {
            icon: Percent,
            label: "Taux de contact",
            value: contactRate,
            suffix: "%",
            subtext: null,
            color: "from-emerald-500 to-teal-500",
            bgColor: "from-emerald-50 to-teal-50",
            hasProgress: false,
        },
        {
            icon: Trophy,
            label: "Meilleur segment",
            value: null,
            suffix: "",
            subtext: bestSegment.count > 0 ? `+${bestSegment.count} RDV` : null,
            color: "from-amber-500 to-orange-500",
            bgColor: "from-amber-50 to-orange-50",
            hasProgress: false,
            textValue: bestSegment.name,
        },
    ];

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-up">
                <div>
                    <h1 className="text-2xl font-bold text-[#12122A] tracking-tight">Resultats</h1>
                    <p className="text-sm text-[#6B7194] mt-1">
                        {currentMonth} {currentYear}
                        {missions[0]?.name && <> &middot; <span className="font-medium text-[#4A4B6A]">{missions[0].name}</span></>}
                    </p>
                </div>
                <div className="flex items-center bg-white/80 backdrop-blur-sm rounded-xl border border-[#E8EBF0] p-1 shadow-sm">
                    <button
                        onClick={() => setMode("chiffres")}
                        className={cn(
                            "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300",
                            mode === "chiffres"
                                ? "bg-gradient-to-r from-[#6C3AFF] to-[#7C5CFC] text-white shadow-md shadow-[#7C5CFC]/20"
                                : "text-[#6B7194] hover:text-[#12122A]"
                        )}
                    >
                        Chiffres
                    </button>
                    <button
                        onClick={() => setMode("liste")}
                        className={cn(
                            "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300",
                            mode === "liste"
                                ? "bg-gradient-to-r from-[#6C3AFF] to-[#7C5CFC] text-white shadow-md shadow-[#7C5CFC]/20"
                                : "text-[#6B7194] hover:text-[#12122A]"
                        )}
                    >
                        Liste des RDV
                    </button>
                </div>
            </div>

            {/* MODE 1: Chiffres */}
            {mode === "chiffres" && (
                <div className="space-y-4 animate-fade-up stagger-children">
                    {statRows.map((row) => {
                        const Icon = row.icon;
                        return (
                            <div
                                key={row.label}
                                className="premium-card p-5 md:p-6"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-sm",
                                        row.bgColor
                                    )}>
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center",
                                            row.color
                                        )}>
                                            <Icon className="w-4 h-4 text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[#6B7194]">{row.label}</p>
                                        {row.hasProgress && (
                                            <div className="mt-2">
                                                <ProgressBar value={meetingsCount} max={objective} height="sm" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        {row.value !== null ? (
                                            <AnimatedNumber
                                                value={row.value}
                                                className="text-3xl font-black text-[#12122A]"
                                                formatFn={row.suffix ? (n) => `${n}${row.suffix}` : undefined}
                                            />
                                        ) : (
                                            <span className="text-xl font-bold text-[#12122A]">{row.textValue}</span>
                                        )}
                                        {row.subtext && (
                                            <p className="text-xs text-[#A0A3BD] mt-0.5">{row.subtext}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <p className="text-xs text-[#A0A3BD] pt-2 text-center">Periode : {currentMonth} {currentYear}</p>
                </div>
            )}

            {/* MODE 2: Liste des RDV */}
            {mode === "liste" && (
                <div className="space-y-4 animate-fade-up">
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                            <input
                                type="text"
                                placeholder="Rechercher par nom, entreprise, note..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-11 pl-10 pr-9 rounded-full border border-[#E8EBF0] bg-white/80 backdrop-blur-sm text-sm placeholder:text-[#A0A3BD] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/30 focus:border-[#7C5CFC]/50 shadow-sm transition-all"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A3BD] hover:text-[#12122A] transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {missions.length > 1 && (
                            <select
                                value={missionFilter}
                                onChange={(e) => setMissionFilter(e.target.value)}
                                className="h-11 px-4 rounded-xl border border-[#E8EBF0] bg-white/80 backdrop-blur-sm text-sm text-[#12122A] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/30 shadow-sm"
                            >
                                <option value="">Toutes les missions</option>
                                {missions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        )}
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl hover:border-[#7C5CFC]/30 hover:text-[#7C5CFC] transition-all" onClick={exportCSV} disabled={filteredMeetings.length === 0}>
                                <Download className="w-4 h-4" /> CSV
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl no-print hover:border-[#7C5CFC]/30 hover:text-[#7C5CFC] transition-all" onClick={() => window.print()}>
                                Imprimer
                            </Button>
                        </div>
                    </div>

                    {/* Meeting dossier list */}
                    {filteredMeetings.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-[#E8EBF0] shadow-sm">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F4F6F9] to-[#E8EBF0] flex items-center justify-center mx-auto mb-4">
                                <Calendar className="w-7 h-7 text-[#A0A3BD]" />
                            </div>
                            <h3 className="text-lg font-semibold text-[#12122A] mb-1">Aucun rendez-vous enregistre</h3>
                            <p className="text-sm text-[#6B7194] max-w-sm mx-auto">
                                Les rendez-vous planifies par votre equipe apparaitront ici avec leur contexte complet.
                            </p>
                        </div>
                    ) : (
                        <div className="stagger-children space-y-3 print-container">
                            {filteredMeetings.map((m) => {
                                const contactName = [m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "Contact";
                                const outcomeInfo = m.meetingFeedback
                                    ? OUTCOME_LABELS[m.meetingFeedback.outcome] ?? { label: "—", class: "bg-slate-100" }
                                    : { label: "En attente", class: "bg-amber-50 text-amber-700 border-amber-200" };

                                return (
                                    <div
                                        key={m.id}
                                        className="premium-card p-5 group"
                                    >
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0 space-y-1.5">
                                                <p className="font-bold text-[#12122A]">
                                                    {contactName}
                                                    {m.contact.title && <span className="font-normal text-[#6B7194]"> &middot; {m.contact.title}</span>}
                                                    <span className="font-normal text-[#6B7194]"> &middot; {m.contact.company.name}</span>
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm text-[#A0A3BD]">
                                                        {formatDate(m.callbackDate || m.createdAt)}
                                                    </span>
                                                    <span className="text-[#E8EBF0]">&middot;</span>
                                                    <Badge className={cn("text-xs border font-medium", outcomeInfo.class)}>
                                                        {outcomeInfo.label}
                                                    </Badge>
                                                </div>
                                                {m.note && (
                                                    <p className="text-sm text-[#6B7194] italic line-clamp-2">
                                                        Note SDR : &ldquo;{m.note}&rdquo;
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-1.5 text-xs text-[#7C5CFC] hover:text-[#6C3AFF] hover:bg-[#7C5CFC]/5 rounded-lg flex-shrink-0 no-print font-semibold"
                                                onClick={() => setSelectedMeeting(m)}
                                            >
                                                Voir detail <ArrowRight className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            {selectedMeeting && (
                <Modal isOpen={!!selectedMeeting} onClose={() => setSelectedMeeting(null)} title="Detail du rendez-vous" size="lg">
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-[#F8F7FF] to-[#F4F6F9] border border-[#E8EBF0]/60">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C5CFC] to-[#A78BFA] flex items-center justify-center shadow-sm shadow-[#7C5CFC]/20">
                                <Calendar className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-lg font-bold text-[#12122A]">
                                {new Date(selectedMeeting.callbackDate || selectedMeeting.createdAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-[#F8F7FF] to-[#F4F6F9] rounded-2xl p-5 space-y-2 border border-[#E8EBF0]/50">
                                <div className="flex items-center gap-2 text-xs font-semibold text-[#7C5CFC] uppercase"><User className="w-3.5 h-3.5" /> Contact</div>
                                <p className="text-lg font-bold text-[#12122A]">
                                    {[selectedMeeting.contact.firstName, selectedMeeting.contact.lastName].filter(Boolean).join(" ")}
                                </p>
                                <p className="text-sm text-[#6B7194]">{selectedMeeting.contact.title ?? "—"}</p>
                                {selectedMeeting.contact.email && (
                                    <a href={`mailto:${selectedMeeting.contact.email}`} className="flex items-center gap-2 text-sm text-[#6B7194] hover:text-[#7C5CFC] transition-colors">
                                        <Mail className="w-4 h-4" /> {selectedMeeting.contact.email}
                                    </a>
                                )}
                            </div>
                            <div className="bg-gradient-to-br from-[#F8F7FF] to-[#F4F6F9] rounded-2xl p-5 space-y-2 border border-[#E8EBF0]/50">
                                <div className="flex items-center gap-2 text-xs font-semibold text-[#7C5CFC] uppercase"><Building2 className="w-3.5 h-3.5" /> Societe</div>
                                <p className="text-lg font-bold text-[#12122A]">{selectedMeeting.contact.company.name}</p>
                                {selectedMeeting.contact.company.industry && (
                                    <p className="text-sm text-[#6B7194]">Secteur : {selectedMeeting.contact.company.industry}</p>
                                )}
                            </div>
                        </div>
                        {selectedMeeting.note && (
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <Lightbulb className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <span className="text-sm font-bold text-amber-800">Note SDR</span>
                                </div>
                                <p className="text-sm text-amber-800 italic leading-relaxed">{selectedMeeting.note}</p>
                            </div>
                        )}
                        {selectedMeeting.meetingFeedback && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50/80">
                                <span className="text-sm text-[#6B7194]">Retour client :</span>
                                <Badge className={cn("text-xs border font-medium", OUTCOME_LABELS[selectedMeeting.meetingFeedback.outcome]?.class)}>
                                    {OUTCOME_LABELS[selectedMeeting.meetingFeedback.outcome]?.label}
                                </Badge>
                            </div>
                        )}
                        <div className="flex justify-end pt-4 border-t border-[#E8EBF0]">
                            <Button
                                variant="primary"
                                size="sm"
                                className="rounded-xl bg-gradient-to-r from-[#6C3AFF] to-[#7C5CFC] hover:from-[#5B2AEE] hover:to-[#6C4CE0] shadow-sm"
                                onClick={() => setSelectedMeeting(null)}
                            >
                                Fermer
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
