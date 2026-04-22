"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Target, ExternalLink } from "lucide-react";
import { Button, Badge, DataTable, EmptyState, TableSkeleton, ProgressBar, type Column } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import { SideDetailPanel } from "@/app/manager/_shared/SideDetailPanel";
import { MISSION_STATUS_CONFIG, type MissionStatusValue } from "@/lib/constants/missionStatus";
import type { ClientShellData } from "../ClientDetailShell";
import { useClientNavState } from "../_hooks/useClientNavState";
import { MissionDetailPanel } from "../_panels/MissionDetailPanel";

interface MissionRow {
    id: string;
    name: string;
    status: MissionStatusValue;
    isActive: boolean;
    channels: string[];
    channel: string;
    startDate: string;
    endDate: string;
    _count: { sdrAssignments: number; campaigns: number; lists: number };
    sdrAssignments?: { sdr: { id: string; name: string } }[];
}

export function MissionsTab({ client }: { client: ClientShellData }) {
    const nav = useClientNavState();

    const query = useQuery({
        queryKey: qk.clientMissions(client.id),
        queryFn: async () => {
            const res = await fetch(`/api/missions?clientId=${client.id}&limit=100`);
            const json = await res.json();
            return (json?.data ?? []) as MissionRow[];
        },
        staleTime: 30_000,
    });

    const columns: Column<MissionRow>[] = [
        {
            key: "name",
            header: "Mission",
            render: (_, row) => (
                <div>
                    <div className="font-medium text-slate-900">{row.name}</div>
                    <div className="mt-0.5">
                        <IdChip id={row.id} />
                    </div>
                </div>
            ),
        },
        {
            key: "status",
            header: "Statut",
            render: (_, row) => {
                const meta = MISSION_STATUS_CONFIG[row.status];
                const variant: "default" | "success" | "warning" | "primary" | "outline" =
                    row.status === "ACTIVE"
                        ? "success"
                        : row.status === "PAUSED"
                        ? "warning"
                        : row.status === "COMPLETED"
                        ? "primary"
                        : "outline";
                return <Badge variant={variant}>{meta.label}</Badge>;
            },
        },
        {
            key: "channels",
            header: "Canaux",
            render: (_, row) => (
                <div className="flex flex-wrap gap-1">
                    {(row.channels?.length ? row.channels : [row.channel]).map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px]">
                            {c}
                        </Badge>
                    ))}
                </div>
            ),
        },
        {
            key: "sdrs",
            header: "SDRs",
            render: (_, row) => <span className="tabular-nums">{row._count.sdrAssignments}</span>,
        },
        {
            key: "period",
            header: "Période",
            render: (_, row) => {
                const start = new Date(row.startDate).getTime();
                const end = new Date(row.endDate).getTime();
                const now = Date.now();
                const progress = end <= start ? 0 : Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
                return (
                    <div className="min-w-[120px]">
                        <div className="text-xs text-slate-600 mb-1">
                            {new Date(row.startDate).toLocaleDateString("fr-FR")} → {new Date(row.endDate).toLocaleDateString("fr-FR")}
                        </div>
                        <ProgressBar value={progress} max={100} height="sm" />
                    </div>
                );
            },
        },
        {
            key: "actions",
            header: "",
            render: (_, row) => (
                <Link
                    href={`/manager/missions/${row.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-400 hover:text-indigo-600"
                    title="Ouvrir en pleine page"
                >
                    <ExternalLink className="w-4 h-4" />
                </Link>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Missions</h2>
                <Link href={`/manager/missions/new?clientId=${client.id}`}>
                    <Button variant="primary" size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Nouvelle mission
                    </Button>
                </Link>
            </div>

            {query.isLoading ? (
                <TableSkeleton rows={5} columns={6} />
            ) : query.error ? (
                <ErrorCard message="Impossible de charger les missions" onRetry={() => query.refetch()} />
            ) : (query.data ?? []).length === 0 ? (
                <EmptyState
                    icon={Target}
                    title="Aucune mission"
                    description="Créez la première mission pour ce client pour démarrer la prospection."
                    action={
                        <Link href={`/manager/missions/new?clientId=${client.id}`}>
                            <Button variant="primary">Nouvelle mission</Button>
                        </Link>
                    }
                />
            ) : (
                <DataTable
                    data={query.data ?? []}
                    columns={columns}
                    keyField="id"
                    onRowClick={(row) => nav.setM(row.id)}
                    searchable
                    searchFields={["name" as keyof MissionRow]}
                    searchPlaceholder="Rechercher une mission..."
                    pagination
                    pageSize={10}
                />
            )}

            <SideDetailPanel
                isOpen={!!nav.m}
                onClose={() => nav.setM(null)}
                title={nav.m ? "Détail de la mission" : undefined}
                fullPageHref={nav.m ? `/manager/missions/${nav.m}` : undefined}
                topOffset={0}
            >
                {nav.m && <MissionDetailPanel missionId={nav.m} />}
            </SideDetailPanel>
        </div>
    );
}

export default MissionsTab;
