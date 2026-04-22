"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, List as ListIcon } from "lucide-react";
import Link from "next/link";
import { Button, Badge, DataTable, EmptyState, TableSkeleton, type Column } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import { SideDetailPanel } from "@/app/manager/_shared/SideDetailPanel";
import type { MissionShellData } from "../MissionDetailShell";
import { useMissionNavState } from "../_hooks/useMissionNavState";
import { ListDetailPanel } from "../_panels/ListDetailPanel";

interface ListRow {
    id: string;
    name: string;
    type: string;
    isActive?: boolean;
    commercialInterlocuteurId?: string | null;
    _count?: { companies: number; contacts?: number };
    createdAt: string;
}

export function ListsTab({ mission }: { mission: MissionShellData }) {
    const nav = useMissionNavState();

    const query = useQuery({
        queryKey: qk.missionLists(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/lists?missionId=${mission.id}&limit=200`);
            const json = await res.json();
            return (json?.data ?? []) as ListRow[];
        },
        staleTime: 30_000,
    });

    const columns: Column<ListRow>[] = [
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
            key: "type",
            header: "Type",
            render: (_, row) => <Badge variant="outline">{row.type}</Badge>,
        },
        {
            key: "companies",
            header: "Entreprises",
            render: (_, row) => <span className="tabular-nums">{row._count?.companies ?? 0}</span>,
        },
        {
            key: "status",
            header: "Statut",
            render: (_, row) => <Badge variant={row.isActive ? "success" : "outline"}>{row.isActive ? "Active" : "Inactive"}</Badge>,
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Listes</h2>
                <Link href={`/manager/lists/new?missionId=${mission.id}`}>
                    <Button variant="primary" size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Nouvelle liste
                    </Button>
                </Link>
            </div>

            {query.isLoading ? (
                <TableSkeleton rows={5} columns={4} />
            ) : query.error ? (
                <ErrorCard message="Impossible de charger les listes" onRetry={() => query.refetch()} />
            ) : (query.data ?? []).length === 0 ? (
                <EmptyState icon={ListIcon} title="Aucune liste" description="Créez une liste pour cibler votre prospection." />
            ) : (
                <DataTable
                    data={query.data ?? []}
                    columns={columns}
                    keyField="id"
                    onRowClick={(row) => nav.setL(row.id)}
                    searchable
                    searchFields={["name" as keyof ListRow]}
                    searchPlaceholder="Rechercher..."
                    pagination
                    pageSize={10}
                />
            )}

            <SideDetailPanel
                isOpen={!!nav.l}
                onClose={() => nav.setL(null)}
                title={nav.l ? "Liste" : undefined}
            >
                {nav.l && <ListDetailPanel listId={nav.l} missionId={mission.id} />}
            </SideDetailPanel>
        </div>
    );
}

export default ListsTab;
