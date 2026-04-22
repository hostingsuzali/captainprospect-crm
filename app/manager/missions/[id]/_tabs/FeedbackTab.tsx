"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ThumbsUp, Star, MessageCircle, Search } from "lucide-react";
import {
    EmptyState,
    Skeleton,
    Input,
    StatCard,
    Badge,
} from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { MissionShellData } from "../MissionDetailShell";

interface FeedbackRow {
    id: string;
    score: number;
    review?: string | null;
    objections?: string | null;
    missionComment?: string | null;
    submittedAt: string;
    sdr: { id: string; name: string; email: string };
    mission?: { id: string; name: string } | null;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function FeedbackTab({ mission }: { mission: MissionShellData }) {
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [search, setSearch] = useState("");

    const query = useQuery({
        queryKey: qk.missionFeedback(mission.id, { from, to }),
        queryFn: async () => {
            const qs = new URLSearchParams();
            qs.set("missionId", mission.id);
            if (from) qs.set("from", from);
            if (to) qs.set("to", to);
            const res = await fetch(`/api/manager/sdr-feedback?${qs.toString()}`);
            const json = await res.json();
            return (json?.data ?? []) as FeedbackRow[];
        },
    });

    const filtered = useMemo(() => {
        const rows = query.data ?? [];
        if (!search) return rows;
        const q = search.toLowerCase();
        return rows.filter(
            (r) =>
                r.sdr.name.toLowerCase().includes(q) ||
                (r.review ?? "").toLowerCase().includes(q) ||
                (r.objections ?? "").toLowerCase().includes(q) ||
                (r.missionComment ?? "").toLowerCase().includes(q)
        );
    }, [query.data, search]);

    const avg = useMemo(() => {
        const rows = query.data ?? [];
        if (rows.length === 0) return 0;
        return rows.reduce((s, r) => s + r.score, 0) / rows.length;
    }, [query.data]);

    const total = query.data?.length ?? 0;
    const withObjections = useMemo(() => (query.data ?? []).filter((r) => !!r.objections).length, [query.data]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5 text-indigo-600" /> Feedback SDR
                </h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <StatCard
                    label="Feedbacks"
                    value={total}
                    icon={MessageCircle}
                    iconBg="bg-indigo-100"
                    iconColor="text-indigo-600"
                />
                <StatCard
                    label="Score moyen"
                    value={avg.toFixed(1)}
                    icon={Star}
                    iconBg="bg-amber-100"
                    iconColor="text-amber-600"
                />
                <StatCard
                    label="Avec objections"
                    value={withObjections}
                    icon={ThumbsUp}
                    iconBg="bg-pink-100"
                    iconColor="text-pink-600"
                />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-3">
                <Input type="date" label="Du" value={from} onChange={(e) => setFrom(e.target.value)} />
                <Input type="date" label="Au" value={to} onChange={(e) => setTo(e.target.value)} />
                <Input
                    label="Recherche"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="SDR, contenu..."
                    icon={<Search className="w-4 h-4" />}
                />
            </div>

            {query.isLoading ? (
                <Skeleton className="h-40" />
            ) : query.error ? (
                <ErrorCard message="Erreur" onRetry={() => query.refetch()} />
            ) : filtered.length === 0 ? (
                <EmptyState icon={MessageCircle} title="Aucun feedback" description="Aucun feedback SDR ne correspond aux filtres." />
            ) : (
                <ul className="space-y-3">
                    {filtered.map((f) => (
                        <li key={f.id} className="bg-white border border-slate-200 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-slate-900">{f.sdr.name}</span>
                                    <IdChip id={f.id} length={6} />
                                    <span className="text-xs text-slate-500">{formatDate(f.submittedAt)}</span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                            key={i}
                                            className={`w-4 h-4 ${i < f.score ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                                        />
                                    ))}
                                </div>
                            </div>
                            {f.review && <p className="text-sm text-slate-700 mb-2">{f.review}</p>}
                            {f.objections && (
                                <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                                    <span className="font-medium text-amber-800">Objections : </span>
                                    <span className="text-amber-900">{f.objections}</span>
                                </div>
                            )}
                            {f.missionComment && (
                                <div className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-2">
                                    <span className="font-medium text-slate-700">Commentaire mission : </span>
                                    <span className="text-slate-800">{f.missionComment}</span>
                                </div>
                            )}
                            {f.mission && (
                                <Badge variant="outline" className="mt-2">{f.mission.name}</Badge>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default FeedbackTab;
