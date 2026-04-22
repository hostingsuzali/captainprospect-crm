"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, CalendarDays, Sparkles, AlertCircle } from "lucide-react";
import {
    Button,
    Badge,
    EmptyState,
    Skeleton,
    Tabs,
    useToast,
    DataTable,
    type Column,
} from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { MissionShellData } from "../MissionDetailShell";
import { useMissionNavState } from "../_hooks/useMissionNavState";

interface MissionPlan {
    id: string;
    month: string;
    status: string;
    totalActions?: number;
    targetActions?: number;
    createdAt: string;
}

interface MonthPlan {
    id: string;
    month: string;
    sdrId: string;
    sdrName?: string;
    workingDays?: number;
    plannedActions?: number;
}

export function PlanningTab({ mission }: { mission: MissionShellData }) {
    const nav = useMissionNavState();
    const sub = nav.sub ?? "plans";
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();

    const plansQuery = useQuery({
        queryKey: qk.missionPlans(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/mission-plans?missionId=${mission.id}`);
            const json = await res.json();
            return (json?.data ?? []) as MissionPlan[];
        },
        enabled: sub === "plans",
    });

    const monthPlansQuery = useQuery({
        queryKey: qk.missionMonthPlans(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/mission-month-plans?missionId=${mission.id}`);
            const json = await res.json();
            return (json?.data ?? []) as MonthPlan[];
        },
        enabled: sub === "month-plans",
    });

    const generate = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/mission-plans/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ missionId: mission.id }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            success("Plan généré");
            queryClient.invalidateQueries({ queryKey: qk.missionPlans(mission.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const plansColumns: Column<MissionPlan>[] = [
        { header: "Mois", accessor: (r) => <span className="font-medium text-slate-900">{r.month}</span>, key: "month" },
        { header: "Statut", accessor: (r) => <Badge variant="outline">{r.status}</Badge>, key: "status" },
        {
            header: "Actions",
            accessor: (r) => (
                <span className="text-sm tabular-nums">
                    {r.totalActions ?? 0}{r.targetActions ? ` / ${r.targetActions}` : ""}
                </span>
            ),
            key: "actions",
        },
        { header: "ID", accessor: (r) => <IdChip id={r.id} length={6} />, key: "id" },
    ];

    const monthPlansColumns: Column<MonthPlan>[] = [
        { header: "Mois", accessor: (r) => <span className="font-medium">{r.month}</span>, key: "month" },
        { header: "SDR", accessor: (r) => r.sdrName ?? r.sdrId, key: "sdr" },
        {
            header: "Jours ouvrés",
            accessor: (r) => <span className="tabular-nums">{r.workingDays ?? "—"}</span>,
            key: "workingDays",
        },
        {
            header: "Actions prévues",
            accessor: (r) => <span className="tabular-nums">{r.plannedActions ?? 0}</span>,
            key: "plannedActions",
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    Planification
                </h2>
                {sub === "plans" && (
                    <Button variant="primary" size="sm" onClick={() => generate.mutate()} isLoading={generate.isPending}>
                        <Sparkles className="w-4 h-4 mr-1" /> Générer un plan
                    </Button>
                )}
            </div>

            <Tabs
                tabs={[
                    { id: "plans", label: "Plans globaux" },
                    { id: "month-plans", label: "Plans mensuels" },
                    { id: "schedule", label: "Schedule blocks" },
                ]}
                activeTab={sub}
                onTabChange={(id) => nav.setSub(id)}
                variant="pills"
            />

            {sub === "plans" && (
                <>
                    {plansQuery.isLoading ? (
                        <Skeleton className="h-40" />
                    ) : plansQuery.error ? (
                        <ErrorCard message="Impossible de charger les plans" onRetry={() => plansQuery.refetch()} />
                    ) : (plansQuery.data ?? []).length === 0 ? (
                        <EmptyState icon={CalendarDays} title="Aucun plan" description="Générez un plan à partir des paramètres de la mission." />
                    ) : (
                        <DataTable data={plansQuery.data ?? []} columns={plansColumns} />
                    )}
                </>
            )}

            {sub === "month-plans" && (
                <>
                    {monthPlansQuery.isLoading ? (
                        <Skeleton className="h-40" />
                    ) : monthPlansQuery.error ? (
                        <ErrorCard message="Impossible de charger les plans mensuels" onRetry={() => monthPlansQuery.refetch()} />
                    ) : (monthPlansQuery.data ?? []).length === 0 ? (
                        <EmptyState icon={CalendarDays} title="Aucun plan mensuel" />
                    ) : (
                        <DataTable data={monthPlansQuery.data ?? []} columns={monthPlansColumns} />
                    )}
                </>
            )}

            {sub === "schedule" && (
                <EmptyState
                    icon={AlertCircle}
                    title="Schedule blocks"
                    description="La liste des blocs de planning n'est pas encore exposée par l'API. Cette section sera activée dans une prochaine itération."
                />
            )}
        </div>
    );
}

export default PlanningTab;
