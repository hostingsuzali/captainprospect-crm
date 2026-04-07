"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { Loader2, PhoneCall, Search, X, Building2, Clock, Filter, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallItem {
    id: string;
    createdAt: string;
    callbackDate?: string | null;
    result: string;
    note?: string | null;
    duration?: number | null;
    company?: {
        name: string;
        industry?: string | null;
        country?: string | null;
    } | null;
    contact?: {
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
        email?: string | null;
        phone?: string | null;
        company?: {
            name: string;
            industry?: string | null;
            country?: string | null;
        } | null;
    } | null;
    campaign: {
        name: string;
        mission: { name: string };
    };
}

const RESULT_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    MEETING_BOOKED:      { label: "RDV pris",          color: "text-emerald-700", bg: "bg-emerald-50 border border-emerald-200", dot: "bg-emerald-500" },
    CALLBACK_REQUESTED:  { label: "Rappel demandé",     color: "text-sky-700",     bg: "bg-sky-50 border border-sky-200",         dot: "bg-sky-500" },
    INTERESTED:          { label: "Intéressé",          color: "text-indigo-700",  bg: "bg-indigo-50 border border-indigo-200",   dot: "bg-indigo-500" },
    NO_RESPONSE:         { label: "Pas de réponse",     color: "text-slate-600",   bg: "bg-slate-50 border border-slate-200",     dot: "bg-slate-400" },
    DISQUALIFIED:        { label: "Disqualifié",        color: "text-red-700",     bg: "bg-red-50 border border-red-200",         dot: "bg-red-400" },
    VOICEMAIL:           { label: "Messagerie",         color: "text-amber-700",   bg: "bg-amber-50 border border-amber-200",     dot: "bg-amber-400" },
    NOT_INTERESTED:      { label: "Non intéressé",      color: "text-slate-600",   bg: "bg-slate-50 border border-slate-200",     dot: "bg-slate-400" },
    MEETING_CANCELLED:   { label: "RDV annulé",         color: "text-red-700",     bg: "bg-red-50 border border-red-200",         dot: "bg-red-400" },
};

function getResultConfig(result: string) {
    return RESULT_CONFIG[result] ?? { label: result, color: "text-slate-600", bg: "bg-slate-50 border border-slate-200", dot: "bg-slate-400" };
}

function formatDateTime(date: string) {
    const d = new Date(date);
    return d.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDuration(seconds: number | null | undefined): string {
    if (typeof seconds !== "number" || seconds <= 0) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ClientPortalCallsPage() {
    const { error: showError } = useToast();
    const [calls, setCalls] = useState<CallItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [resultFilter, setResultFilter] = useState<string>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            try {
                const res = await fetch("/api/client/calls");
                const json = await res.json();
                if (json.success) {
                    setCalls(json.data);
                } else {
                    showError("Erreur", json.error || "Impossible de charger l'historique d'appels");
                }
            } catch {
                showError("Erreur", "Impossible de charger l'historique d'appels");
            } finally {
                setIsLoading(false);
            }
        })();
    }, [showError]);

    const filtered = calls.filter((c) => {
        if (resultFilter !== "all" && c.result !== resultFilter) return false;
        if (!search.trim()) return true;
        const haystack = [
            c.contact?.firstName,
            c.contact?.lastName,
            c.contact?.title,
            c.contact?.email,
            c.contact?.phone,
            c.company?.name || c.contact?.company?.name,
            c.campaign.mission.name,
            c.campaign.name,
            c.note,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(search.toLowerCase());
    });

    const uniqueResults = Array.from(new Set(calls.map((c) => c.result)));

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-5">
            {/* Header */}
            <div style={{ animation: "callsFadeUp 0.35s ease both" }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-200">
                        <PhoneCall className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#12122A] tracking-tight">Historique des appels</h1>
                        <p className="text-xs text-[#6B7194] mt-0.5">Vue détaillée des appels effectués dans vos campagnes</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3" style={{ animation: "callsFadeUp 0.35s ease both", animationDelay: "50ms" }}>
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher (contact, entreprise...)"
                        className="w-full h-10 pl-9 pr-8 rounded-xl border border-[#E8EBF0] bg-white text-sm text-[#12122A] placeholder:text-[#A0A3BD] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/30 focus:border-[#7C5CFC]/40 shadow-sm"
                    />
                    {search && (
                        <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0A3BD] hover:text-[#6B7194]">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A3BD]" />
                    <select
                        value={resultFilter}
                        onChange={(e) => setResultFilter(e.target.value)}
                        className="h-10 pl-9 pr-8 rounded-xl border border-[#E8EBF0] bg-white text-sm text-[#12122A] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/30 shadow-sm appearance-none"
                    >
                        <option value="all">Tous les résultats</option>
                        {uniqueResults.map((r) => (
                            <option key={r} value={r}>{getResultConfig(r).label}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A3BD] pointer-events-none" />
                </div>
                {filtered.length !== calls.length && (
                    <span className="text-xs text-[#6B7194] bg-white border border-[#E8EBF0] px-3 py-1.5 rounded-full shadow-sm">
                        {filtered.length} / {calls.length} appels
                    </span>
                )}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-7 h-7 animate-spin text-[#7C5CFC]" />
                        <span className="text-sm text-[#6B7194]">Chargement de l&apos;historique…</span>
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-[#E8EBF0] rounded-2xl py-16 px-6 text-center" style={{ animation: "callsFadeUp 0.35s ease both" }}>
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[#F4F5FA] flex items-center justify-center">
                        <PhoneCall className="w-6 h-6 text-[#A0A3BD]" />
                    </div>
                    <p className="text-sm font-semibold text-[#12122A]">Aucun appel trouvé</p>
                    <p className="mt-1 text-xs text-[#6B7194]">Ajustez vos filtres ou réessayez plus tard.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-[#E8EBF0] overflow-hidden shadow-sm" style={{ animation: "callsFadeUp 0.35s ease both", animationDelay: "80ms" }}>
                    {/* Table header */}
                    <div className="hidden md:grid grid-cols-[160px,1fr,1fr,140px,90px,40px] gap-4 px-5 py-3 border-b border-[#F0F1F7] bg-[#FAFAFA]">
                        <span className="text-[11px] font-bold text-[#A0A3BD] uppercase tracking-wider">Date</span>
                        <span className="text-[11px] font-bold text-[#A0A3BD] uppercase tracking-wider">Contact / Entreprise</span>
                        <span className="text-[11px] font-bold text-[#A0A3BD] uppercase tracking-wider">Mission / Campagne</span>
                        <span className="text-[11px] font-bold text-[#A0A3BD] uppercase tracking-wider">Résultat</span>
                        <span className="text-[11px] font-bold text-[#A0A3BD] uppercase tracking-wider text-right">Durée</span>
                        <span />
                    </div>
                    <div className="divide-y divide-[#F5F6FA]">
                        {filtered.map((call, idx) => {
                            const contactName = [call.contact?.firstName, call.contact?.lastName].filter(Boolean).join(" ") || "Contact inconnu";
                            const companyName = call.contact?.company?.name || call.company?.name || "—";
                            const rc = getResultConfig(call.result);
                            const isExpanded = expandedId === call.id;
                            return (
                                <div
                                    key={call.id}
                                    className="transition-colors"
                                    style={{ animation: "callsFadeUp 0.3s ease both", animationDelay: `${80 + idx * 20}ms` }}
                                >
                                    <div
                                        className={cn(
                                            "px-5 py-3.5 hover:bg-[#FAFBFF] transition-colors cursor-pointer",
                                            isExpanded && "bg-[#FAFBFF]"
                                        )}
                                        onClick={() => setExpandedId(isExpanded ? null : call.id)}
                                    >
                                        {/* Mobile layout */}
                                        <div className="flex md:hidden items-start gap-3">
                                            <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", rc.dot)} />
                                            <div className="flex-1 min-w-0 space-y-0.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-semibold text-[#12122A] truncate">{contactName}</span>
                                                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0", rc.color, rc.bg)}>{rc.label}</span>
                                                </div>
                                                <p className="text-xs text-[#6B7194] truncate">{companyName} · {call.campaign.mission.name}</p>
                                                <p className="text-[11px] text-[#A0A3BD]">{formatDateTime(call.callbackDate || call.createdAt)}</p>
                                            </div>
                                        </div>
                                        {/* Desktop layout */}
                                        <div className="hidden md:grid grid-cols-[160px,1fr,1fr,140px,90px,40px] gap-4 items-center">
                                            <div className="flex items-center gap-1.5 text-xs text-[#6B7194]">
                                                <Clock className="w-3.5 h-3.5 text-[#A0A3BD] shrink-0" />
                                                <span>{formatDateTime(call.callbackDate || call.createdAt)}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-[#12122A] truncate">{contactName}</p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <Building2 className="w-3 h-3 text-[#A0A3BD] shrink-0" />
                                                    <span className="text-xs text-[#6B7194] truncate">{companyName}</span>
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-[#12122A] truncate">{call.campaign.mission.name}</p>
                                                <p className="text-xs text-[#6B7194] truncate">{call.campaign.name}</p>
                                            </div>
                                            <div>
                                                <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full", rc.color, rc.bg)}>
                                                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", rc.dot)} />
                                                    {rc.label}
                                                </span>
                                            </div>
                                            <div className="text-right text-xs text-[#6B7194] font-medium">
                                                {formatDuration(call.duration)}
                                            </div>
                                            <div className="flex justify-end">
                                                {call.note && (
                                                    <ChevronDown className={cn("w-4 h-4 text-[#A0A3BD] transition-transform duration-200", isExpanded && "rotate-180")} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Expanded note */}
                                    {isExpanded && call.note && (
                                        <div className="px-5 pb-3.5 -mt-1">
                                            <div className="ml-0 md:ml-[160px] md:pl-4 border-l-2 border-[#7C5CFC]/20 pl-3">
                                                <p className="text-xs text-[#6B7194] italic leading-relaxed">« {call.note} »</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes callsFadeUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: none; }
                }
            `}</style>
        </div>
    );
}
