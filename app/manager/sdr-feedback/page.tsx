"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackItem = {
    id: string;
    score: number;
    review: string;
    objections: string | null;
    missionComment: string | null;
    pagePath: string | null;
    submittedAt: string;
    sdr: {
        id: string;
        name: string;
        email: string;
    };
    mission: {
        id: string;
        name: string;
    } | null;
    missions: Array<{
        mission: {
            id: string;
            name: string;
        };
    }>;
};

function toInputDate(value: Date): string {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export default function ManagerSdrFeedbackPage() {
    const [items, setItems] = useState<FeedbackItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [from, setFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return toInputDate(d);
    });
    const [to, setTo] = useState(() => toInputDate(new Date()));

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ from, to, limit: "300" });
            const res = await fetch(`/api/manager/sdr-feedback?${params.toString()}`);
            const json = await res.json();
            if (!json.success) {
                setError(json.error ?? "Impossible de charger les avis SDR");
                setItems([]);
                return;
            }
            setItems(json.data as FeedbackItem[]);
        } catch {
            setError("Erreur réseau");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [from, to]);

    useEffect(() => {
        void load();
    }, [load]);

    const stats = useMemo(() => {
        if (items.length === 0) {
            return { total: 0, avg: 0, objections: 0, comments: 0 };
        }
        const total = items.length;
        const avg = items.reduce((sum, item) => sum + item.score, 0) / total;
        const objections = items.filter((item) => !!item.objections?.trim()).length;
        const comments = items.filter((item) => !!item.missionComment?.trim()).length;
        return { total, avg, objections, comments };
    }, [items]);

    return (
        <div className="min-h-full bg-[#F4F6F9] p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                    <h1 className="text-[22px] font-bold text-[#12122A] tracking-tight">
                        Avis SDR
                    </h1>
                    <p className="text-[13px] text-[#8B8BA7] mt-0.5">
                        Retours quotidiens, objections terrain et commentaires mission.
                    </p>
                </div>
                <div className="flex items-end gap-2">
                    <div>
                        <label className="block text-[11px] text-[#8B8BA7] mb-1">Du</label>
                        <input
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="h-9 px-2.5 rounded-lg border border-[#E8EBF0] text-[12px] bg-white"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] text-[#8B8BA7] mb-1">Au</label>
                        <input
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="h-9 px-2.5 rounded-lg border border-[#E8EBF0] text-[12px] bg-white"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => void load()}
                        className="h-9 px-3 rounded-lg bg-[#7C5CFC] text-white text-[12px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Actualiser
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
                <div className="rounded-xl border border-[#E8EBF0] bg-white p-4">
                    <p className="text-[11px] text-[#8B8BA7]">Total avis</p>
                    <p className="text-[24px] font-bold text-[#12122A]">{stats.total}</p>
                </div>
                <div className="rounded-xl border border-[#E8EBF0] bg-white p-4">
                    <p className="text-[11px] text-[#8B8BA7]">Score moyen</p>
                    <p className="text-[24px] font-bold text-[#12122A]">{stats.avg.toFixed(1)} / 5</p>
                </div>
                <div className="rounded-xl border border-[#E8EBF0] bg-white p-4">
                    <p className="text-[11px] text-[#8B8BA7]">Avec objections</p>
                    <p className="text-[24px] font-bold text-[#12122A]">{stats.objections}</p>
                </div>
                <div className="rounded-xl border border-[#E8EBF0] bg-white p-4">
                    <p className="text-[11px] text-[#8B8BA7]">Avec commentaires mission</p>
                    <p className="text-[24px] font-bold text-[#12122A]">{stats.comments}</p>
                </div>
            </div>

            <div className="rounded-xl border border-[#E8EBF0] bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E8EBF0] flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#7C5CFC]" />
                    <h2 className="text-[14px] font-semibold text-[#12122A]">Derniers retours</h2>
                </div>

                {loading ? (
                    <div className="py-16 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-[#7C5CFC]" />
                    </div>
                ) : error ? (
                    <div className="px-4 py-8 text-[13px] text-red-600">{error}</div>
                ) : items.length === 0 ? (
                    <div className="px-4 py-10 text-[13px] text-[#8B8BA7]">
                        Aucun retour sur cette période.
                    </div>
                ) : (
                    <div className="divide-y divide-[#EEF1F6]">
                        {items.map((item) => (
                            <div key={item.id} className="p-4 space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                                    <span className="font-semibold text-[#12122A]">{item.sdr.name}</span>
                                    <span className="text-[#8B8BA7]">•</span>
                                    <span className="text-[#5A5A7A]">
                                        {new Date(item.submittedAt).toLocaleString("fr-FR")}
                                    </span>
                                    <span
                                        className={cn(
                                            "ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold",
                                            item.score >= 4
                                                ? "bg-emerald-50 text-emerald-700"
                                                : item.score >= 3
                                                  ? "bg-amber-50 text-amber-700"
                                                  : "bg-red-50 text-red-700",
                                        )}
                                    >
                                        {item.score}/5
                                    </span>
                                </div>

                                <p className="text-[13px] text-[#12122A] whitespace-pre-wrap">{item.review}</p>

                                {item.objections && (
                                    <p className="text-[12px] text-[#5A5A7A]">
                                        <span className="font-semibold text-[#12122A]">Objections:</span>{" "}
                                        {item.objections}
                                    </p>
                                )}
                                {item.missionComment && (
                                    <p className="text-[12px] text-[#5A5A7A]">
                                        <span className="font-semibold text-[#12122A]">Mission:</span>{" "}
                                        {item.missionComment}
                                    </p>
                                )}

                                <p className="text-[11px] text-[#8B8BA7]">
                                    Mission{item.missions?.length > 1 ? "s" : ""}:{" "}
                                    {item.missions?.length
                                        ? item.missions.map((m) => m.mission.name).join(", ")
                                        : item.mission?.name ?? "Aucune"}{" "}
                                    {item.pagePath ? `• Page: ${item.pagePath}` : ""}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
