"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Loader2, MessageSquare, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
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
    const [search, setSearch] = useState("");
    const [from, setFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return toInputDate(d);
    });
    const [to, setTo] = useState(() => toInputDate(new Date()));
    const [selectedSdrId, setSelectedSdrId] = useState("all");
    const [selectedScore, setSelectedScore] = useState("all");
    const [objectionsFilter, setObjectionsFilter] = useState("all");
    const [missionCommentFilter, setMissionCommentFilter] = useState("all");
    const [sortBy, setSortBy] = useState<"submittedAt" | "score" | "sdr">("submittedAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 280);
        return () => window.clearTimeout(timeout);
    }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ from, to, limit: "500", sortBy, sortOrder });
            if (debouncedSearch) params.set("search", debouncedSearch);
            if (selectedSdrId !== "all") params.set("sdrId", selectedSdrId);
            if (selectedScore !== "all") {
                params.set("minScore", selectedScore);
                params.set("maxScore", selectedScore);
            }
            if (objectionsFilter !== "all") params.set("withObjections", objectionsFilter);
            if (missionCommentFilter !== "all") {
                params.set("withMissionComment", missionCommentFilter);
            }
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
    }, [from, to, debouncedSearch, selectedSdrId, selectedScore, objectionsFilter, missionCommentFilter, sortBy, sortOrder]);

    useEffect(() => {
        void load();
    }, [load]);

    const sdrOptions = useMemo(
        () =>
            Array.from(new Map(items.map((item) => [item.sdr.id, item.sdr])).values()).sort((a, b) =>
                a.name.localeCompare(b.name, "fr"),
            ),
        [items],
    );

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

    const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / pageSize)), [items.length, pageSize]);
    const paginatedItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, page, pageSize]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const setLastDays = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        setFrom(toInputDate(start));
        setTo(toInputDate(end));
        setPage(1);
    };

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
            <div className="mb-4 flex flex-wrap gap-2">
                {[1, 7, 14, 30].map((days) => (
                    <button
                        key={days}
                        type="button"
                        onClick={() => setLastDays(days)}
                        className="h-8 px-3 rounded-lg border border-[#E8EBF0] bg-white text-[12px] text-[#5A5A7A] hover:bg-[#F9FAFB]"
                    >
                        {days === 1 ? "Aujourd'hui" : `${days} derniers jours`}
                    </button>
                ))}
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
                <div className="px-4 py-3 border-b border-[#E8EBF0] bg-[#FCFCFF] space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <div className="relative min-w-[220px] flex-1">
                            <Search className="w-3.5 h-3.5 text-[#8B8BA7] absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Rechercher (avis, objections, mission, SDR)..."
                                className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E8EBF0] text-[12px] bg-white"
                            />
                        </div>
                        <select
                            value={selectedSdrId}
                            onChange={(e) => setSelectedSdrId(e.target.value)}
                            className="h-9 min-w-[170px] px-2.5 rounded-lg border border-[#E8EBF0] text-[12px] bg-white"
                        >
                            <option value="all">Tous les SDR</option>
                            {sdrOptions.map((sdr) => (
                                <option key={sdr.id} value={sdr.id}>
                                    {sdr.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedScore}
                            onChange={(e) => setSelectedScore(e.target.value)}
                            className="h-9 min-w-[120px] px-2.5 rounded-lg border border-[#E8EBF0] text-[12px] bg-white"
                        >
                            <option value="all">Tous scores</option>
                            {[5, 4, 3, 2, 1].map((score) => (
                                <option key={score} value={String(score)}>
                                    {score}/5
                                </option>
                            ))}
                        </select>
                        <select
                            value={objectionsFilter}
                            onChange={(e) => setObjectionsFilter(e.target.value)}
                            className="h-9 min-w-[160px] px-2.5 rounded-lg border border-[#E8EBF0] text-[12px] bg-white"
                        >
                            <option value="all">Objections: tous</option>
                            <option value="true">Avec objections</option>
                            <option value="false">Sans objections</option>
                        </select>
                        <select
                            value={missionCommentFilter}
                            onChange={(e) => setMissionCommentFilter(e.target.value)}
                            className="h-9 min-w-[185px] px-2.5 rounded-lg border border-[#E8EBF0] text-[12px] bg-white"
                        >
                            <option value="all">Commentaires mission: tous</option>
                            <option value="true">Avec commentaire mission</option>
                            <option value="false">Sans commentaire mission</option>
                        </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#8B8BA7]">
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            Tri
                        </span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as "submittedAt" | "score" | "sdr")}
                            className="h-8 px-2.5 rounded-lg border border-[#E8EBF0] text-[12px] bg-white"
                        >
                            <option value="submittedAt">Date</option>
                            <option value="score">Score</option>
                            <option value="sdr">SDR</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                            className="h-8 px-2.5 rounded-lg border border-[#E8EBF0] text-[12px] bg-white inline-flex items-center gap-1 hover:bg-[#F9FAFB]"
                        >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            {sortOrder === "asc" ? "Croissant" : "Décroissant"}
                        </button>
                        <span className="ml-auto text-[11px] text-[#8B8BA7]">
                            {items.length} ligne(s) chargée(s)
                        </span>
                    </div>
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
                    <div className="overflow-auto">
                        <table className="w-full min-w-[980px] text-left">
                            <thead className="bg-[#FAFBFE] border-b border-[#EEF1F6] sticky top-0 z-10">
                                <tr className="text-[11px] uppercase tracking-wide text-[#8B8BA7]">
                                    <th className="px-4 py-2.5 font-semibold">Date</th>
                                    <th className="px-4 py-2.5 font-semibold">SDR</th>
                                    <th className="px-4 py-2.5 font-semibold">Score</th>
                                    <th className="px-4 py-2.5 font-semibold">Missions</th>
                                    <th className="px-4 py-2.5 font-semibold">Avis</th>
                                    <th className="px-4 py-2.5 font-semibold">Objections</th>
                                    <th className="px-4 py-2.5 font-semibold">Commentaire mission</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedItems.map((item) => (
                                    <tr key={item.id} className="border-b border-[#EEF1F6] align-top">
                                        <td className="px-4 py-3 text-[12px] text-[#5A5A7A] whitespace-nowrap">
                                            {new Date(item.submittedAt).toLocaleString("fr-FR")}
                                        </td>
                                        <td className="px-4 py-3 text-[12px]">
                                            <p className="font-semibold text-[#12122A]">{item.sdr.name}</p>
                                            <p className="text-[#8B8BA7]">{item.sdr.email}</p>
                                        </td>
                                        <td className="px-4 py-3 text-[12px]">
                                            <span
                                                className={cn(
                                                    "inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold",
                                                    item.score >= 4
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : item.score >= 3
                                                          ? "bg-amber-50 text-amber-700"
                                                          : "bg-red-50 text-red-700",
                                                )}
                                            >
                                                {item.score}/5
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-[#5A5A7A]">
                                            {item.missions?.length
                                                ? item.missions.map((m) => m.mission.name).join(", ")
                                                : item.mission?.name ?? "Aucune"}
                                            {item.pagePath ? (
                                                <p className="text-[11px] text-[#8B8BA7] mt-1">
                                                    Origine: {item.pagePath}
                                                </p>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-[#12122A] whitespace-pre-wrap">
                                            {item.review}
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-[#5A5A7A] whitespace-pre-wrap">
                                            {item.objections || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-[#5A5A7A] whitespace-pre-wrap">
                                            {item.missionComment || "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!loading && !error && items.length > 0 ? (
                    <div className="px-4 py-3 border-t border-[#E8EBF0] bg-white flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                            <label className="text-[12px] text-[#8B8BA7]">Lignes / page</label>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="h-8 px-2 rounded-lg border border-[#E8EBF0] text-[12px] bg-white"
                            >
                                {[25, 50, 100].map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-8 px-3 rounded-lg border border-[#E8EBF0] text-[12px] disabled:opacity-40"
                            >
                                Precedent
                            </button>
                            <span className="text-[12px] text-[#5A5A7A]">
                                Page {page} / {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="h-8 px-3 rounded-lg border border-[#E8EBF0] text-[12px] disabled:opacity-40"
                            >
                                Suivant
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
