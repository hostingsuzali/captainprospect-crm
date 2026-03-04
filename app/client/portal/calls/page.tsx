"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { Loader2, PhoneCall, Search, X, Building2, Clock, Filter } from "lucide-react";

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

export default function ClientPortalCallsPage() {
    const { error: showError } = useToast();
    const [calls, setCalls] = useState<CallItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [resultFilter, setResultFilter] = useState<string>("all");

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
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        return haystack.includes(search.toLowerCase());
    });

    return (
        <div className="min-h-full bg-[#F3F4F8] p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                            <PhoneCall className="w-4 h-4" />
                        </span>
                        Historique des appels
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Vue détaillée des appels effectués dans vos campagnes.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher (contact, entreprise, campagne...)"
                        className="w-full h-10 pl-9 pr-8 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        value={resultFilter}
                        onChange={(e) => setResultFilter(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    >
                        <option value="all">Tous les résultats</option>
                        <option value="MEETING_BOOKED">RDV pris</option>
                        <option value="CALLBACK_REQUESTED">Rappel demandé</option>
                        <option value="INTERESTED">Intéressé</option>
                        <option value="NO_RESPONSE">Pas de réponse</option>
                        <option value="DISQUALIFIED">Disqualifié</option>
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                        <span className="text-sm">Chargement de l&apos;historique d&apos;appels...</span>
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-200 rounded-2xl py-16 px-6 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <PhoneCall className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-900">Aucun appel trouvé</p>
                    <p className="mt-1 text-xs text-slate-500">
                        Ajustez vos filtres ou réessayez plus tard.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
                        <div className="grid grid-cols-[140px,1fr,1fr,120px,90px] gap-4">
                            <span>Date</span>
                            <span>Contact / Entreprise</span>
                            <span>Mission / Campagne</span>
                            <span>Résultat</span>
                            <span className="text-right">Durée</span>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {filtered.map((call) => {
                            const contactName = [call.contact?.firstName, call.contact?.lastName]
                                .filter(Boolean)
                                .join(" ") || "Contact inconnu";
                            const companyName =
                                call.contact?.company?.name || call.company?.name || "Entreprise inconnue";
                            const duration =
                                typeof call.duration === "number" && call.duration > 0
                                    ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s`
                                    : "—";
                            return (
                                <div
                                    key={call.id}
                                    className="px-4 py-3 text-sm hover:bg-slate-50/70 transition-colors"
                                >
                                    <div className="grid grid-cols-[140px,1fr,1fr,120px,90px] gap-4 items-center">
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{formatDateTime(call.callbackDate || call.createdAt)}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 text-slate-900 font-medium truncate">
                                                {contactName}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate">
                                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="truncate">{companyName}</span>
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-medium text-slate-800 truncate">
                                                {call.campaign.mission.name}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">
                                                {call.campaign.name}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                                                {call.result}
                                            </span>
                                        </div>
                                        <div className="text-right text-xs text-slate-500">
                                            {duration}
                                        </div>
                                    </div>
                                    {call.note && (
                                        <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
                                            « {call.note} »
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

