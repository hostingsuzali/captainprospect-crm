"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Copy, BarChart3 } from "lucide-react";
import {
    Button,
    Badge,
    EmptyState,
    Skeleton,
    Tabs,
    useToast,
    Input,
    Select,
} from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { MissionShellData } from "../MissionDetailShell";

interface ActionStatus {
    id: string;
    name: string;
    label?: string;
    color?: string;
    isPositive?: boolean;
    order?: number;
}

interface ActionStatsEntry {
    status: string;
    label?: string;
    count: number;
    color?: string;
}

export function ActionsTab({ mission }: { mission: MissionShellData }) {
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();

    const [tab, setTab] = useState<"stats" | "statuses">("stats");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [sdrId, setSdrId] = useState("");

    const statsQuery = useQuery({
        queryKey: qk.missionActionStats(mission.id, { from, to, sdrId }),
        queryFn: async () => {
            const qs = new URLSearchParams();
            if (from) qs.set("from", from);
            if (to) qs.set("to", to);
            if (sdrId) qs.set("sdrId", sdrId);
            const res = await fetch(`/api/missions/${mission.id}/action-stats?${qs.toString()}`);
            const json = await res.json();
            return (json?.data ?? []) as ActionStatsEntry[];
        },
        enabled: tab === "stats",
    });

    const statusesQuery = useQuery({
        queryKey: qk.missionActionStatuses(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/missions/${mission.id}/action-statuses`);
            const json = await res.json();
            return (json?.data ?? []) as ActionStatus[];
        },
        enabled: tab === "statuses",
    });

    const copyDefaults = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/missions/${mission.id}/action-statuses/copy-default`, {
                method: "POST",
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
        },
        onSuccess: () => {
            success("Statuts par défaut copiés");
            queryClient.invalidateQueries({ queryKey: qk.missionActionStatuses(mission.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const totals = useMemo(() => {
        const data = statsQuery.data ?? [];
        return data.reduce((sum, e) => sum + e.count, 0);
    }, [statsQuery.data]);

    const sdrOptions = useMemo(
        () => [
            { value: "", label: "Tous les SDR" },
            ...(mission.sdrAssignments ?? []).map((a) => ({ value: a.sdr.id, label: a.sdr.name })),
        ],
        [mission.sdrAssignments]
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-600" /> Actions
                </h2>
            </div>

            <Tabs
                tabs={[
                    { id: "stats", label: "Statistiques" },
                    { id: "statuses", label: "Statuts configurés" },
                ]}
                activeTab={tab}
                onTabChange={(id) => setTab(id as typeof tab)}
                variant="pills"
            />

            {tab === "stats" && (
                <>
                    <div className="grid grid-cols-3 gap-3 bg-white border border-slate-200 rounded-xl p-4">
                        <Input type="date" label="Du" value={from} onChange={(e) => setFrom(e.target.value)} />
                        <Input type="date" label="Au" value={to} onChange={(e) => setTo(e.target.value)} />
                        <Select label="SDR" value={sdrId} onChange={setSdrId} options={sdrOptions} />
                    </div>

                    {statsQuery.isLoading ? (
                        <Skeleton className="h-40" />
                    ) : statsQuery.error ? (
                        <ErrorCard message="Erreur" onRetry={() => statsQuery.refetch()} />
                    ) : totals === 0 ? (
                        <EmptyState icon={BarChart3} title="Aucune action" description="Aucune action enregistrée sur cette période." />
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                            <div className="text-sm text-slate-600 mb-2">
                                <span className="font-semibold text-slate-900 tabular-nums">{totals}</span> actions
                            </div>
                            {(statsQuery.data ?? []).map((e) => {
                                const pct = totals > 0 ? (e.count / totals) * 100 : 0;
                                return (
                                    <div key={e.status} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-700">{e.label ?? e.status}</span>
                                            <span className="tabular-nums text-slate-600">
                                                {e.count} <span className="text-xs text-slate-400">({pct.toFixed(1)}%)</span>
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: e.color ?? "#6366f1",
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {tab === "statuses" && (
                <>
                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => copyDefaults.mutate()} isLoading={copyDefaults.isPending}>
                            <Copy className="w-4 h-4 mr-1" /> Copier les statuts par défaut
                        </Button>
                    </div>

                    {statusesQuery.isLoading ? (
                        <Skeleton className="h-40" />
                    ) : statusesQuery.error ? (
                        <ErrorCard message="Erreur" onRetry={() => statusesQuery.refetch()} />
                    ) : (statusesQuery.data ?? []).length === 0 ? (
                        <EmptyState icon={Activity} title="Aucun statut" description="Copiez les statuts par défaut pour démarrer." />
                    ) : (
                        <ul className="space-y-2">
                            {(statusesQuery.data ?? [])
                                .slice()
                                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                .map((s) => (
                                    <li key={s.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                                        <span
                                            className="w-3 h-3 rounded-full shrink-0"
                                            style={{ backgroundColor: s.color ?? "#94a3b8" }}
                                        />
                                        <span className="font-medium text-slate-900 flex-1">{s.label ?? s.name}</span>
                                        {s.isPositive && <Badge variant="success">Positif</Badge>}
                                    </li>
                                ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}

export default ActionsTab;
