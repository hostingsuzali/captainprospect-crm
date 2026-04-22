"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Badge, Button, Skeleton, Tabs } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import { MISSION_STATUS_CONFIG, type MissionStatusValue } from "@/lib/constants/missionStatus";
import { ExternalLink, Users, Megaphone, Activity, Share2 } from "lucide-react";

interface MissionDetailData {
    id: string;
    name: string;
    status: MissionStatusValue;
    objective?: string | null;
    channels: string[];
    startDate: string;
    endDate: string;
    teamLeadSdr?: { id: string; name: string } | null;
    sdrAssignments: { id: string; sdr: { id: string; name: string; email: string } }[];
    campaigns: { id: string; name: string; isActive: boolean }[];
    stats?: { totalActions: number; meetingsBooked: number; opportunities: number };
}

export function MissionDetailPanel({ missionId }: { missionId: string }) {
    const [innerTab, setInnerTab] = useState<"details" | "sdrs" | "campaigns" | "stats" | "shared">("details");

    const query = useQuery({
        queryKey: qk.mission(missionId),
        queryFn: async () => {
            const res = await fetch(`/api/missions/${missionId}`);
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json.data as MissionDetailData;
        },
        enabled: !!missionId,
    });

    if (query.isLoading) {
        return (
            <div className="p-5 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    if (query.error || !query.data) {
        return (
            <div className="p-5">
                <ErrorCard message="Impossible de charger la mission" onRetry={() => query.refetch()} />
            </div>
        );
    }

    const mission = query.data;
    const statusMeta = MISSION_STATUS_CONFIG[mission.status];

    return (
        <div className="p-5 space-y-4">
            <div>
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-slate-900">{mission.name}</h3>
                    <IdChip id={mission.id} />
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <Badge variant={mission.status === "ACTIVE" ? "success" : "default"}>{statusMeta.label}</Badge>
                    {mission.channels.map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                    ))}
                </div>
                <Link
                    href={`/manager/missions/${mission.id}`}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-2"
                >
                    Ouvrir la page mission <ExternalLink className="w-3 h-3" />
                </Link>
            </div>

            <Tabs
                tabs={[
                    { id: "details", label: "Détails" },
                    { id: "sdrs", label: "SDRs", badge: mission.sdrAssignments.length },
                    { id: "campaigns", label: "Campagnes", badge: mission.campaigns.length },
                    { id: "stats", label: "Stats" },
                    { id: "shared", label: "Partage" },
                ]}
                activeTab={innerTab}
                onTabChange={(id) => setInnerTab(id as typeof innerTab)}
                variant="pills"
            />

            {innerTab === "details" && (
                <div className="space-y-3 text-sm">
                    <Field label="Objectif" value={mission.objective || "—"} />
                    <Field
                        label="Période"
                        value={`${new Date(mission.startDate).toLocaleDateString("fr-FR")} → ${new Date(
                            mission.endDate
                        ).toLocaleDateString("fr-FR")}`}
                    />
                    <Field label="Team Lead" value={mission.teamLeadSdr?.name || "—"} />
                </div>
            )}

            {innerTab === "sdrs" && (
                <div className="space-y-2">
                    {mission.sdrAssignments.length === 0 ? (
                        <p className="text-sm text-slate-500 py-6 text-center">Aucun SDR assigné</p>
                    ) : (
                        mission.sdrAssignments.map((a) => (
                            <div
                                key={a.id}
                                className="flex items-center gap-3 p-2 rounded-lg border border-slate-200"
                            >
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm text-indigo-700 font-medium">
                                    {a.sdr.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 truncate">{a.sdr.name}</div>
                                    <div className="text-xs text-slate-500 truncate">{a.sdr.email}</div>
                                </div>
                                <Users className="w-4 h-4 text-slate-400" />
                            </div>
                        ))
                    )}
                </div>
            )}

            {innerTab === "campaigns" && (
                <div className="space-y-2">
                    {mission.campaigns.length === 0 ? (
                        <p className="text-sm text-slate-500 py-6 text-center">Aucune campagne</p>
                    ) : (
                        mission.campaigns.map((c) => (
                            <Link
                                key={c.id}
                                href={`/manager/missions/${mission.id}?tab=campaigns&c=${c.id}`}
                                className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                            >
                                <Megaphone className="w-4 h-4 text-indigo-600" />
                                <span className="flex-1 text-sm text-slate-900">{c.name}</span>
                                <Badge variant={c.isActive ? "success" : "outline"} className="text-[10px]">
                                    {c.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </Link>
                        ))
                    )}
                </div>
            )}

            {innerTab === "stats" && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                    <StatBlock icon={<Activity className="w-4 h-4" />} label="Actions" value={mission.stats?.totalActions ?? 0} />
                    <StatBlock icon={<Users className="w-4 h-4" />} label="RDV" value={mission.stats?.meetingsBooked ?? 0} />
                    <StatBlock icon={<Share2 className="w-4 h-4" />} label="Opport." value={mission.stats?.opportunities ?? 0} />
                </div>
            )}

            {innerTab === "shared" && (
                <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600 mb-2">Gestion des rapports partagés depuis la page mission.</p>
                    <Link href={`/manager/missions/${mission.id}?tab=reporting`}>
                        <Button variant="outline" size="sm">Ouvrir la page mission</Button>
                    </Link>
                </div>
            )}
        </div>
    );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5">{label}</div>
            <div className="text-slate-900 whitespace-pre-wrap">{value}</div>
        </div>
    );
}

function StatBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
    return (
        <div className="p-3 bg-slate-50 rounded-lg text-center">
            <div className="flex items-center justify-center text-slate-400 mb-1">{icon}</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
            <div className="text-[11px] text-slate-500">{label}</div>
        </div>
    );
}

export default MissionDetailPanel;
