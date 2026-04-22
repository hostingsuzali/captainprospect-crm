"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ExternalLink, Building2, Users, Filter } from "lucide-react";
import { Badge, Skeleton, Tabs } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";

interface ListData {
    id: string;
    name: string;
    type: string;
    isActive?: boolean;
    companies?: { id: string; name: string; status?: string }[];
    _count?: { companies: number };
    commercialInterlocuteur?: { id: string; firstName: string; lastName: string; title?: string } | null;
    audienceFilter?: unknown;
}

export function ListDetailPanel({ listId, missionId }: { listId: string; missionId: string }) {
    const [innerTab, setInnerTab] = useState<"overview" | "companies" | "filters">("overview");
    const query = useQuery({
        queryKey: qk.missionList(missionId, listId),
        queryFn: async () => {
            const res = await fetch(`/api/lists/${listId}`);
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json.data as ListData;
        },
        enabled: !!listId,
    });

    if (query.isLoading) {
        return (
            <div className="p-5 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    if (query.error || !query.data) {
        return (
            <div className="p-5">
                <ErrorCard message="Impossible de charger la liste" onRetry={() => query.refetch()} />
            </div>
        );
    }

    const list = query.data;
    const companiesCount = list._count?.companies ?? list.companies?.length ?? 0;

    return (
        <div className="p-5 space-y-4">
            <div>
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-slate-900">{list.name}</h3>
                    <IdChip id={list.id} />
                    <Badge variant="outline">{list.type}</Badge>
                    <Badge variant={list.isActive ? "success" : "outline"}>{list.isActive ? "Active" : "Inactive"}</Badge>
                </div>
                <Link
                    href={`/manager/lists/${list.id}`}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1"
                >
                    Ouvrir la liste <ExternalLink className="w-3 h-3" />
                </Link>
            </div>

            <Tabs
                tabs={[
                    { id: "overview", label: "Vue d'ensemble" },
                    { id: "companies", label: "Entreprises", badge: companiesCount },
                    { id: "filters", label: "Filtres" },
                ]}
                activeTab={innerTab}
                onTabChange={(id) => setInnerTab(id as typeof innerTab)}
                variant="pills"
            />

            {innerTab === "overview" && (
                <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                        <StatBlock icon={<Building2 className="w-4 h-4" />} label="Entreprises" value={companiesCount} />
                        <StatBlock icon={<Users className="w-4 h-4" />} label="Commerciale" value={list.commercialInterlocuteur ? `${list.commercialInterlocuteur.firstName} ${list.commercialInterlocuteur.lastName}` : "—"} />
                    </div>
                </div>
            )}

            {innerTab === "companies" && (
                <div className="space-y-2">
                    {(list.companies ?? []).length === 0 ? (
                        <p className="text-sm text-slate-500 py-6 text-center">Aucune entreprise</p>
                    ) : (
                        (list.companies ?? []).slice(0, 20).map((c) => (
                            <Link
                                key={c.id}
                                href={`/manager/companies/${c.id}`}
                                className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                            >
                                <Building2 className="w-4 h-4 text-slate-400" />
                                <span className="flex-1 text-sm text-slate-900 truncate">{c.name}</span>
                                {c.status && <Badge variant="outline" className="text-[10px]">{c.status}</Badge>}
                            </Link>
                        ))
                    )}
                    {(list.companies?.length ?? 0) > 20 && (
                        <p className="text-xs text-slate-500 text-center pt-1">
                            {(list.companies?.length ?? 0) - 20} entreprises supplémentaires — voir la page liste.
                        </p>
                    )}
                </div>
            )}

            {innerTab === "filters" && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Filter className="w-4 h-4 text-slate-400" />
                        Configuration des filtres d&apos;audience
                    </div>
                    <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
                        {list.audienceFilter ? JSON.stringify(list.audienceFilter, null, 2) : "Aucun filtre défini"}
                    </pre>
                </div>
            )}
        </div>
    );
}

function StatBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-1 text-slate-400 mb-1 text-xs">{icon} {label}</div>
            <div className="text-lg font-semibold text-slate-900 tabular-nums">{value}</div>
        </div>
    );
}

export default ListDetailPanel;
