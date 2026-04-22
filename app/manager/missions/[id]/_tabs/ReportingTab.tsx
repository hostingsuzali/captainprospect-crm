"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Calendar as CalendarIcon, Activity, CheckCircle2 } from "lucide-react";
import {
    Button,
    EmptyState,
    Skeleton,
    Input,
    StatCard,
} from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { MissionShellData } from "../MissionDetailShell";

interface AnalyticsRange {
    earliestDate?: string | null;
    latestDate?: string | null;
}

interface ActionStatsEntry {
    status: string;
    label?: string;
    count: number;
    color?: string;
}

export function ReportingTab({ mission }: { mission: MissionShellData }) {
    const rangeQuery = useQuery({
        queryKey: qk.missionAnalyticsRange(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/analytics/mission-date-range?missionId=${mission.id}`);
            const json = await res.json();
            return (json?.data ?? json) as AnalyticsRange;
        },
    });

    const [from, setFrom] = useState<string>("");
    const [to, setTo] = useState<string>("");

    useEffect(() => {
        if (rangeQuery.data && !from && !to) {
            setFrom(rangeQuery.data.earliestDate?.slice(0, 10) ?? mission.startDate.slice(0, 10));
            setTo(rangeQuery.data.latestDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
        }
    }, [rangeQuery.data, from, to, mission.startDate]);

    const statsQuery = useQuery({
        queryKey: qk.missionReporting(mission.id, from, to),
        queryFn: async () => {
            const qs = new URLSearchParams();
            if (from) qs.set("from", from);
            if (to) qs.set("to", to);
            const res = await fetch(`/api/missions/${mission.id}/action-stats?${qs.toString()}`);
            const json = await res.json();
            return (json?.data ?? []) as ActionStatsEntry[];
        },
        enabled: !!from && !!to,
    });

    const total = useMemo(() => (statsQuery.data ?? []).reduce((s, e) => s + e.count, 0), [statsQuery.data]);
    const meetings = useMemo(
        () =>
            (statsQuery.data ?? [])
                .filter((e) =>
                    ["MEETING_BOOKED", "RDV", "MEETING"].includes(e.status.toUpperCase())
                )
                .reduce((s, e) => s + e.count, 0),
        [statsQuery.data]
    );
    const positives = useMemo(
        () =>
            (statsQuery.data ?? [])
                .filter((e) => ["INTERESTED", "POSITIVE"].includes(e.status.toUpperCase()))
                .reduce((s, e) => s + e.count, 0),
        [statsQuery.data]
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" /> Reporting
                </h2>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-end gap-3">
                <Input type="date" label="Du" value={from} onChange={(e) => setFrom(e.target.value)} />
                <Input type="date" label="Au" value={to} onChange={(e) => setTo(e.target.value)} />
                <Button variant="outline" size="sm" onClick={() => statsQuery.refetch()}>
                    <CalendarIcon className="w-4 h-4 mr-1" /> Actualiser
                </Button>
            </div>

            {statsQuery.isLoading ? (
                <Skeleton className="h-40" />
            ) : statsQuery.error ? (
                <ErrorCard message="Erreur" onRetry={() => statsQuery.refetch()} />
            ) : total === 0 ? (
                <EmptyState icon={BarChart3} title="Aucune donnée" description="Aucune action sur la période sélectionnée." />
            ) : (
                <>
                    <div className="grid grid-cols-3 gap-3">
                        <StatCard label="Actions totales" value={total.toLocaleString("fr-FR")} icon={Activity} iconBg="bg-indigo-100" iconColor="text-indigo-600" />
                        <StatCard label="RDV pris" value={meetings.toLocaleString("fr-FR")} icon={CalendarIcon} iconBg="bg-emerald-100" iconColor="text-emerald-600" />
                        <StatCard label="Positifs" value={positives.toLocaleString("fr-FR")} icon={CheckCircle2} iconBg="bg-pink-100" iconColor="text-pink-600" />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                        <h3 className="text-sm font-semibold text-slate-900 mb-2">Répartition par statut</h3>
                        {(statsQuery.data ?? []).map((e) => {
                            const pct = total > 0 ? (e.count / total) * 100 : 0;
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
                                            style={{ width: `${pct}%`, backgroundColor: e.color ?? "#6366f1" }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

export default ReportingTab;
