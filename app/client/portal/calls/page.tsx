"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, Badge, Button } from "@/components/ui";
import {
    Phone,
    Loader2,
    Filter,
    X,
    Building2,
    User,
    ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// RESULT LABELS (French) — no SDR/BD shown
// ============================================

const RESULT_LABELS: Record<string, { label: string; class: string }> = {
    NO_RESPONSE: { label: "Pas de réponse", class: "bg-slate-100 text-slate-700 border-slate-200" },
    BAD_CONTACT: { label: "Mauvais contact", class: "bg-amber-50 text-amber-700 border-amber-200" },
    INTERESTED: { label: "Intéressé", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    CALLBACK_REQUESTED: { label: "Rappel demandé", class: "bg-blue-50 text-blue-700 border-blue-200" },
    MEETING_BOOKED: { label: "RDV pris", class: "bg-violet-50 text-violet-700 border-violet-200" },
    MEETING_CANCELLED: { label: "RDV annulé", class: "bg-red-50 text-red-700 border-red-200" },
    DISQUALIFIED: { label: "Disqualifié", class: "bg-rose-50 text-rose-700 border-rose-200" },
    ENVOIE_MAIL: { label: "Email envoyé", class: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

// ============================================
// TYPES
// ============================================

type FilterType = "all" | "companies" | "contacts";

interface RecentCall {
    id: string;
    createdAt: string;
    result: string;
    note?: string;
    contact?: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        title: string | null;
        company: { id: string; name: string };
    };
    company?: { id: string; name: string };
    campaign?: {
        id: string;
        name: string;
        mission: { id: string; name: string };
    };
}

interface RecentCallsResponse {
    calls: RecentCall[];
    total: number;
}

// ============================================
// CLIENT PORTAL — APPELS RÉCENTS
// ============================================

export default function ClientPortalCallsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const clientId = (session?.user as { clientId?: string })?.clientId;

    const filterParam = (searchParams.get("filter") as FilterType) || "all";
    const [filter, setFilter] = useState<FilterType>(filterParam);
    const [calls, setCalls] = useState<RecentCall[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [filterOpen, setFilterOpen] = useState(false);

    useEffect(() => {
        setFilter((searchParams.get("filter") as FilterType) || "all");
    }, [searchParams]);

    useEffect(() => {
        if (!clientId) return;
        const fetchCalls = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams();
                if (filter && filter !== "all") params.set("filter", filter);
                const res = await fetch(`/api/clients/${clientId}/recent-calls?${params.toString()}`);
                const json = await res.json();
                if (json.success && json.data) {
                    const data = json.data as RecentCallsResponse;
                    setCalls(data.calls ?? []);
                    setTotal(data.total ?? 0);
                }
            } catch (err) {
                console.error("Failed to fetch recent calls:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCalls();
    }, [clientId, filter]);

    const handleFilterChange = (value: FilterType) => {
        setFilterOpen(false);
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all") params.delete("filter");
        else params.set("filter", value);
        router.push(`/client/portal/calls?${params.toString()}`);
    };

    const clearFilters = () => {
        setFilterOpen(false);
        router.push("/client/portal/calls");
    };

    const hasActiveFilters = filter !== "all";
    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    const displayName = (call: RecentCall): string => {
        if (call.contact) {
            const name = [call.contact.firstName, call.contact.lastName].filter(Boolean).join(" ").trim();
            return name || call.contact.company?.name || "Contact";
        }
        return call.company?.name ?? "Entreprise";
    };

    const isCompanyOnly = (call: RecentCall) => !!call.company && !call.contact;

    if (!clientId) {
        return (
            <div className="flex items-center justify-center py-20">
                <p className="text-slate-500">Chargement de votre session...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in p-2 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-900">
                        Appels récents
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Les appels effectués sur vos missions — résultat et note
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 flex flex-col items-center">
                        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Total</span>
                        <span className="text-xl font-bold text-indigo-700">{total}</span>
                    </div>
                </div>
            </div>

            {/* Filters: Tous / Entreprises uniquement / Contacts uniquement */}
            <div className="sticky top-4 z-30">
                <div className="bg-white/90 backdrop-blur-md border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-full p-2 pl-6 flex flex-col md:flex-row items-center gap-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 whitespace-nowrap">
                        <Filter className="w-4 h-4 text-indigo-500" />
                        <span>Filtrer :</span>
                    </div>
                    <div className="relative flex-1 w-full flex flex-wrap items-center gap-2 py-1">
                        <button
                            type="button"
                            onClick={() => setFilterOpen((o) => !o)}
                            className="flex items-center gap-2 min-w-[200px] h-10 px-3 text-sm font-medium text-slate-900 bg-white/80 border border-slate-200 rounded-full hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        >
                            <span className="truncate">
                                {filter === "all" && "Tous les appels"}
                                {filter === "companies" && "Entreprises uniquement"}
                                {filter === "contacts" && "Contacts uniquement"}
                            </span>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 ml-auto shrink-0", filterOpen && "rotate-180")} />
                        </button>
                        {filterOpen && (
                            <>
                                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setFilterOpen(false)} />
                                <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[220px]">
                                    <button
                                        type="button"
                                        onClick={() => handleFilterChange("all")}
                                        className={cn(
                                            "w-full text-left px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
                                            filter === "all" ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        Tous les appels
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleFilterChange("companies")}
                                        className={cn(
                                            "w-full text-left px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                                            filter === "companies" ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        <Building2 className="w-4 h-4" />
                                        Entreprises uniquement
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleFilterChange("contacts")}
                                        className={cn(
                                            "w-full text-left px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                                            filter === "contacts" ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        <User className="w-4 h-4" />
                                        Contacts uniquement
                                    </button>
                                </div>
                            </>
                        )}
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="rounded-full hover:bg-red-50 hover:text-red-600 px-4"
                            >
                                <X className="w-4 h-4 mr-2" />
                                Effacer
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
                        <p className="text-slate-500">Chargement des appels...</p>
                    </div>
                </div>
            ) : calls.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-100 ring-1 ring-slate-100">
                        <Phone className="w-10 h-10 text-indigo-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Aucun appel</h3>
                    <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                        Les appels réalisés sur vos missions apparaîtront ici.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5">
                    {calls.map((call) => {
                        const resultConfig = RESULT_LABELS[call.result] ?? { label: call.result, class: "bg-slate-100 text-slate-700 border-slate-200" };
                        const name = displayName(call);
                        const isCompany = isCompanyOnly(call);
                        return (
                            <Card
                                key={call.id}
                                className="border-slate-100 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-6">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                        {isCompany ? (
                                            <Building2 className="w-6 h-6 text-indigo-600" />
                                        ) : (
                                            <User className="w-6 h-6 text-indigo-600" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-lg font-bold text-slate-900">{name}</h3>
                                            {call.contact?.company && !isCompany && (
                                                <span className="text-slate-500 text-sm flex items-center gap-1">
                                                    <Building2 className="w-3.5 h-3.5" />
                                                    {call.contact.company.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <Badge className={cn("border text-xs font-medium", resultConfig.class)}>
                                                {resultConfig.label}
                                            </Badge>
                                            {call.campaign?.mission && (
                                                <span className="text-xs text-slate-500">
                                                    {call.campaign.mission.name}
                                                </span>
                                            )}
                                        </div>
                                        {call.note && (
                                            <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100 italic">
                                                {call.note}
                                            </p>
                                        )}
                                        <p className="mt-2 text-xs text-slate-400">
                                            {formatDate(call.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
