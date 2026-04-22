"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Megaphone, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button, Badge, DataTable, EmptyState, TableSkeleton, type Column } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import { SideDetailPanel } from "@/app/manager/_shared/SideDetailPanel";
import type { MissionShellData } from "../MissionDetailShell";
import { useMissionNavState } from "../_hooks/useMissionNavState";
import { CampaignDetailPanel } from "../_panels/CampaignDetailPanel";

interface Campaign {
    id: string;
    name: string;
    isActive: boolean;
    icp?: string | null;
    mission?: { id: string; name: string };
    _count?: { actions: number };
    createdAt: string;
}

export function CampaignsTab({ mission }: { mission: MissionShellData }) {
    const nav = useMissionNavState();

    const query = useQuery({
        queryKey: qk.missionCampaigns(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/campaigns?missionId=${mission.id}&limit=100`);
            const json = await res.json();
            return (json?.data ?? []) as Campaign[];
        },
        staleTime: 30_000,
    });

    const columns: Column<Campaign>[] = [
        {
            key: "name",
            header: "Nom",
            render: (_, row) => (
                <div>
                    <div className="font-medium text-slate-900">{row.name}</div>
                    <IdChip id={row.id} length={6} className="mt-0.5" />
                </div>
            ),
        },
        {
            key: "isActive",
            header: "Statut",
            render: (_, row) => <Badge variant={row.isActive ? "success" : "outline"}>{row.isActive ? "Active" : "Inactive"}</Badge>,
        },
        {
            key: "actions",
            header: "Actions",
            render: (_, row) => <span className="tabular-nums">{row._count?.actions ?? 0}</span>,
        },
        {
            key: "icp",
            header: "ICP",
            render: (_, row) => (
                <span className="text-xs text-slate-600 truncate max-w-[280px] block">{row.icp || "—"}</span>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Campagnes</h2>
                <Link href={`/manager/missions/${mission.id}/campaigns/new`}>
                    <Button variant="primary" size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Nouvelle campagne
                    </Button>
                </Link>
            </div>

            {query.isLoading ? (
                <TableSkeleton rows={5} columns={4} />
            ) : query.error ? (
                <ErrorCard message="Impossible de charger les campagnes" onRetry={() => query.refetch()} />
            ) : (query.data ?? []).length === 0 ? (
                <EmptyState
                    icon={Megaphone}
                    title="Aucune campagne"
                    description="Créez votre première campagne pour structurer votre prospection."
                />
            ) : (
                <DataTable
                    data={query.data ?? []}
                    columns={columns}
                    keyField="id"
                    onRowClick={(row) => nav.setC(row.id)}
                    searchable
                    searchPlaceholder="Rechercher..."
                    searchFields={["name" as keyof Campaign]}
                    pagination
                    pageSize={10}
                />
            )}

            <SideDetailPanel
                isOpen={!!nav.c}
                onClose={() => nav.setC(null)}
                title={nav.c ? "Campagne" : undefined}
            >
                {nav.c && <CampaignDetailPanel campaignId={nav.c} missionId={mission.id} />}
            </SideDetailPanel>
        </div>
    );
}

export default CampaignsTab;
