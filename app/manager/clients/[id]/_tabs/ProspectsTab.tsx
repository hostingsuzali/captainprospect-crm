"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, Database, Tag, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button, Badge, Skeleton, EmptyState, Tabs } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { ClientShellData } from "../ClientDetailShell";
import { useClientNavState } from "../_hooks/useClientNavState";

interface ProspectSource {
    id: string;
    name: string;
    kind?: string;
    isActive: boolean;
    _count?: { profiles?: number };
}

interface ProspectRule {
    id: string;
    name: string;
    priority?: number;
    isActive: boolean;
    description?: string | null;
}

export function ProspectsTab({ client }: { client: ClientShellData }) {
    const nav = useClientNavState();
    const sub = nav.sub ?? "sources";

    const sourcesQuery = useQuery({
        queryKey: qk.clientProspectSources(client.id),
        queryFn: async () => {
            const res = await fetch(`/api/prospects/sources?clientId=${client.id}`);
            const json = await res.json();
            return (json?.data ?? []) as ProspectSource[];
        },
        enabled: sub === "sources",
    });

    const rulesQuery = useQuery({
        queryKey: qk.clientProspectRules(client.id),
        queryFn: async () => {
            const res = await fetch(`/api/prospects/rules?clientId=${client.id}`);
            const json = await res.json();
            return (json?.data ?? []) as ProspectRule[];
        },
        enabled: sub === "rules",
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Filter className="w-5 h-5 text-indigo-600" />
                    Prospection
                </h2>
                <Link href={`/manager/prospects?clientId=${client.id}`}>
                    <Button variant="outline" size="sm">
                        Configurer <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </Button>
                </Link>
            </div>

            <Tabs
                tabs={[
                    { id: "sources", label: "Sources", badge: sourcesQuery.data?.length },
                    { id: "rules", label: "Règles", badge: rulesQuery.data?.length },
                ]}
                activeTab={sub}
                onTabChange={(id) => nav.setSub(id)}
                variant="pills"
            />

            {sub === "sources" && (
                <>
                    {sourcesQuery.isLoading ? (
                        <Skeleton className="h-40" />
                    ) : sourcesQuery.error ? (
                        <ErrorCard message="Erreur" onRetry={() => sourcesQuery.refetch()} />
                    ) : (sourcesQuery.data ?? []).length === 0 ? (
                        <EmptyState icon={Database} title="Aucune source" description="Ajoutez des sources de prospection depuis la page Prospection." />
                    ) : (
                        <ul className="space-y-2">
                            {(sourcesQuery.data ?? []).map((s) => (
                                <li key={s.id} className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-slate-900">{s.name}</span>
                                            <IdChip id={s.id} length={6} />
                                            {s.kind && <Badge variant="outline">{s.kind}</Badge>}
                                        </div>
                                    </div>
                                    <Badge variant={s.isActive ? "success" : "outline"}>
                                        {s.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {sub === "rules" && (
                <>
                    {rulesQuery.isLoading ? (
                        <Skeleton className="h-40" />
                    ) : rulesQuery.error ? (
                        <ErrorCard message="Erreur" onRetry={() => rulesQuery.refetch()} />
                    ) : (rulesQuery.data ?? []).length === 0 ? (
                        <EmptyState icon={Tag} title="Aucune règle" description="Créez des règles d'orchestration depuis la page Prospection." />
                    ) : (
                        <ul className="space-y-2">
                            {(rulesQuery.data ?? []).map((r) => (
                                <li key={r.id} className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-slate-900">{r.name}</span>
                                            <IdChip id={r.id} length={6} />
                                            {r.priority !== undefined && <Badge variant="outline">prio {r.priority}</Badge>}
                                        </div>
                                        {r.description && <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>}
                                    </div>
                                    <Badge variant={r.isActive ? "success" : "outline"}>
                                        {r.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}

export default ProspectsTab;
