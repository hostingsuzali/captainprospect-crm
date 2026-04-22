"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, Globe } from "lucide-react";
import { EmptyState, Skeleton, Badge } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { MissionShellData } from "../MissionDetailShell";

interface ProspectSource {
    id: string;
    name: string;
    type?: string;
    url?: string | null;
    isActive?: boolean;
    clientId?: string | null;
    missionId?: string | null;
    defaultMissionId?: string | null;
}

export function ProspectSourcesTab({ mission }: { mission: MissionShellData }) {
    const query = useQuery({
        queryKey: qk.missionProspectSources(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/prospects/sources?clientId=${mission.clientId}`);
            const json = await res.json();
            return (json?.data ?? []) as ProspectSource[];
        },
    });

    const filtered = useMemo(() => {
        const rows = query.data ?? [];
        return rows.filter(
            (r) =>
                r.missionId === mission.id ||
                r.defaultMissionId === mission.id ||
                (!r.missionId && !r.defaultMissionId)
        );
    }, [query.data, mission.id]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Filter className="w-5 h-5 text-indigo-600" /> Sources de prospects
                </h2>
            </div>

            {query.isLoading ? (
                <Skeleton className="h-40" />
            ) : query.error ? (
                <ErrorCard message="Erreur" onRetry={() => query.refetch()} />
            ) : filtered.length === 0 ? (
                <EmptyState icon={Filter} title="Aucune source" description="Aucune source de prospects associée à cette mission." />
            ) : (
                <ul className="space-y-2">
                    {filtered.map((s) => (
                        <li key={s.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                            <Globe className="w-4 h-4 text-slate-400" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-slate-900 truncate">{s.name}</span>
                                    <IdChip id={s.id} length={6} />
                                    {s.type && <Badge variant="outline" className="text-[10px]">{s.type}</Badge>}
                                    <Badge variant={s.isActive ? "success" : "outline"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                                </div>
                                {s.url && <div className="text-xs text-slate-500 truncate">{s.url}</div>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default ProspectSourcesTab;
