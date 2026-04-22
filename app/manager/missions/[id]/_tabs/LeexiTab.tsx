"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mic, Search, Clock, User } from "lucide-react";
import {
    Button,
    EmptyState,
    Skeleton,
    Input,
    Badge,
} from "@/components/ui";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import { IdChip } from "@/app/manager/_shared/IdChip";
import type { MissionShellData } from "../MissionDetailShell";

interface LeexiCall {
    id: string;
    title: string;
    date: string | null;
    duration: number;
    companyName: string;
    participantNames: string[];
    hasRecap: boolean;
}

function formatDuration(seconds: number) {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function LeexiTab({ mission }: { mission: MissionShellData }) {
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");

    const callsQuery = useQuery({
        queryKey: ["leexi", "calls", debounced],
        queryFn: async () => {
            const qs = new URLSearchParams();
            if (debounced) qs.set("q", debounced);
            const res = await fetch(`/api/leexi/calls?${qs.toString()}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erreur");
            return (json?.data?.calls ?? []) as LeexiCall[];
        },
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Mic className="w-5 h-5 text-indigo-600" /> Leexi
                </h2>
                <Badge variant="outline">{mission.name}</Badge>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-end gap-3">
                <Input
                    label="Rechercher un appel Leexi"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Titre, entreprise, participant..."
                    icon={<Search className="w-4 h-4" />}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") setDebounced(query);
                    }}
                />
                <Button variant="primary" onClick={() => setDebounced(query)}>
                    Rechercher
                </Button>
            </div>

            {callsQuery.isLoading ? (
                <Skeleton className="h-40" />
            ) : callsQuery.error ? (
                <ErrorCard message={(callsQuery.error as Error).message || "Erreur"} onRetry={() => callsQuery.refetch()} />
            ) : (callsQuery.data ?? []).length === 0 ? (
                <EmptyState
                    icon={Mic}
                    title="Aucun appel Leexi"
                    description={debounced ? "Aucun résultat pour cette recherche." : "Lancez une recherche pour importer des CR Leexi dans les sessions du client."}
                />
            ) : (
                <ul className="space-y-2">
                    {(callsQuery.data ?? []).map((call) => (
                        <li key={call.id} className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                            <Mic className="w-4 h-4 text-indigo-500 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-slate-900 truncate">{call.title}</span>
                                    <IdChip id={call.id} length={8} />
                                    {call.hasRecap && <Badge variant="success">CR dispo</Badge>}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                                    <span className="inline-flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {formatDuration(call.duration)}
                                    </span>
                                    <span>{formatDate(call.date)}</span>
                                    {call.companyName && <span>· {call.companyName}</span>}
                                    {call.participantNames.length > 0 && (
                                        <span className="inline-flex items-center gap-1">
                                            <User className="w-3 h-3" /> {call.participantNames.slice(0, 3).join(", ")}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default LeexiTab;
