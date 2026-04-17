"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, Phone, CalendarCheck, TrendingUp, Sparkles, Building2, Users, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

type BreakdownItem = {
    label: string;
    calls: number;
    rdv: number;
    rate: number;
};

type BreakdownData = {
    totalCalls: number;
    totalRdv: number;
    byIndustry: BreakdownItem[];
    bySize: BreakdownItem[];
    byFunction: BreakdownItem[];
};

type Dimension = "byFunction" | "byIndustry" | "bySize";
type Period = "month" | "quarter" | "all";

const DIMENSIONS: { key: Dimension; label: string; icon: React.ReactNode }[] = [
    { key: "byFunction", label: "Fonction", icon: <Briefcase className="w-3 h-3" /> },
    { key: "byIndustry", label: "Secteur", icon: <Building2 className="w-3 h-3" /> },
    { key: "bySize", label: "Taille d'entreprise", icon: <Users className="w-3 h-3" /> },
];

const PERIODS: { key: Period; label: string }[] = [
    { key: "month", label: "Ce mois" },
    { key: "quarter", label: "3 mois" },
    { key: "all", label: "Tout" },
];

function getPeriodParams(period: Period): Record<string, string> {
    const now = new Date();
    if (period === "all") return {};
    if (period === "month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
        };
    }
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return {
        startDate: start.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
    };
}

function RateChip({ rate }: { rate: number }) {
    const color =
        rate >= 15
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : rate >= 8
            ? "bg-amber-50 text-amber-700 border-amber-100"
            : "bg-[#F4F5FA] text-[#8B8DAF] border-[#E8EBF0]";
    return (
        <span className={cn("inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full border", color)}>
            {rate}%
        </span>
    );
}

function SkeletonRows() {
    return (
        <div className="space-y-3 animate-pulse">
            {[85, 65, 50, 38, 25].map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                    <div className="w-28 h-3 rounded-full bg-[#E8EBF0]" />
                    <div className="flex-1 h-7 rounded-lg bg-[#E8EBF0]" style={{ width: `${w}%` }} />
                    <div className="w-16 h-6 rounded-lg bg-[#E8EBF0]" />
                </div>
            ))}
        </div>
    );
}

export function BreakdownCharts() {
    const [data, setData] = useState<BreakdownData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dimension, setDimension] = useState<Dimension>("byFunction");
    const [period, setPeriod] = useState<Period>("month");
    const [animated, setAnimated] = useState(false);

    const fetchData = useCallback(async (p: Period) => {
        setIsLoading(true);
        setAnimated(false);
        const params = new URLSearchParams(getPeriodParams(p));
        try {
            const res = await fetch(`/api/client/analytics/breakdown?${params}`);
            const json = await res.json();
            if (json.success) setData(json.data);
        } finally {
            setIsLoading(false);
            // Small delay so bars animate after render
            setTimeout(() => setAnimated(true), 80);
        }
    }, []);

    useEffect(() => {
        fetchData(period);
    }, [fetchData, period]);

    const items = data?.[dimension] ?? [];
    const maxCalls = Math.max(...items.map((i) => i.calls), 1);

    const globalRate =
        data && data.totalCalls > 0
            ? Math.round((data.totalRdv / data.totalCalls) * 1000) / 10
            : 0;

    const bestSegment = [...items]
        .filter((i) => i.calls >= 3)
        .sort((a, b) => b.rate - a.rate)[0];

    return (
        <div
            className="premium-card overflow-hidden"
            style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "200ms" }}
        >
            {/* ── Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-[#E8EBF0]">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-violet-500/20">
                        <BarChart3 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-[#12122A] uppercase tracking-wider">
                            Analyse de la prospection
                        </h2>
                        <p className="text-[11px] text-[#8B8DAF] mt-0.5">
                            Appels &amp; RDV par segment
                        </p>
                    </div>
                </div>

                {/* Period selector */}
                <div className="flex items-center rounded-xl bg-[#F4F5FA] border border-[#E8EBF0] p-0.5 gap-0.5">
                    {PERIODS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setPeriod(key)}
                            className={cn(
                                "text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 whitespace-nowrap",
                                period === key
                                    ? "bg-white text-[#7C5CFC] shadow-sm"
                                    : "text-[#8B8DAF] hover:text-[#4B4D7A]"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-6 pt-5 pb-6 space-y-5">
                {/* ── KPI summary row ── */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        {
                            icon: <Phone className="w-3.5 h-3.5" />,
                            value: data?.totalCalls,
                            label: "Appels passés",
                            from: "from-indigo-400",
                            to: "to-violet-500",
                            bg: "from-indigo-50 to-violet-50",
                            border: "border-indigo-100/60",
                            text: "text-indigo-600",
                        },
                        {
                            icon: <CalendarCheck className="w-3.5 h-3.5" />,
                            value: data?.totalRdv,
                            label: "RDV décrochés",
                            from: "from-violet-500",
                            to: "to-purple-600",
                            bg: "from-violet-50 to-purple-50",
                            border: "border-violet-100/60",
                            text: "text-violet-600",
                        },
                        {
                            icon: <TrendingUp className="w-3.5 h-3.5" />,
                            value: data ? `${globalRate}%` : undefined,
                            label: "Taux de conversion",
                            from: "from-emerald-400",
                            to: "to-teal-500",
                            bg: "from-emerald-50 to-teal-50",
                            border: "border-emerald-100/60",
                            text: "text-emerald-600",
                        },
                    ].map(({ icon, value, label, bg, border, text }) => (
                        <div
                            key={label}
                            className={cn(
                                "rounded-xl bg-gradient-to-br border p-3.5 flex flex-col gap-1.5",
                                bg,
                                border
                            )}
                        >
                            <div className={cn("flex items-center gap-1.5 font-semibold", text)}>
                                {icon}
                                <span className="text-[10.5px] uppercase tracking-wide">{label}</span>
                            </div>
                            <div className="text-[22px] font-black text-[#12122A] leading-none">
                                {value !== undefined ? value : (
                                    <span className="inline-block w-10 h-5 rounded bg-white/60 animate-pulse" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Dimension pills ── */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#A0A3BD] uppercase tracking-wider mr-1">
                        Analyser par
                    </span>
                    {DIMENSIONS.map(({ key, label, icon }) => (
                        <button
                            key={key}
                            onClick={() => {
                                setDimension(key);
                                setAnimated(false);
                                setTimeout(() => setAnimated(true), 80);
                            }}
                            className={cn(
                                "inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150",
                                dimension === key
                                    ? "bg-[#7C5CFC] text-white border-[#7C5CFC] shadow-sm shadow-[#7C5CFC]/25"
                                    : "bg-white text-[#6B7194] border-[#E8EBF0] hover:border-[#7C5CFC]/40 hover:text-[#7C5CFC]"
                            )}
                        >
                            {icon}
                            {label}
                        </button>
                    ))}
                </div>

                {/* ── Chart ── */}
                {isLoading ? (
                    <SkeletonRows />
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F4F6F9] to-[#E8EBF0] flex items-center justify-center">
                            <BarChart3 className="w-6 h-6 text-[#C0C3D8]" />
                        </div>
                        <p className="text-sm font-semibold text-[#8B8DAF]">Aucune donnée disponible</p>
                        <p className="text-xs text-[#A0A3BD] text-center max-w-xs">
                            Les données de prospection apparaîtront ici une fois les appels enregistrés.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {/* Legend */}
                        <div className="flex items-center gap-5 mb-3 text-[11px] font-medium text-[#8B8DAF]">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-2.5 rounded-sm bg-gradient-to-r from-indigo-300 to-indigo-400 opacity-80" />
                                Appels
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-2.5 rounded-sm bg-gradient-to-r from-violet-500 to-purple-600" />
                                RDV décrochés
                            </div>
                            <div className="flex items-center gap-1.5 ml-auto">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="text-emerald-600 font-semibold">≥15%</span>
                                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-2" />
                                <span className="text-amber-600 font-semibold">≥8%</span>
                            </div>
                        </div>

                        {items.map((item, idx) => {
                            const barW = (item.calls / maxCalls) * 100;
                            const rdvPct = item.calls > 0 ? (item.rdv / item.calls) * 100 : 0;
                            const delay = `${idx * 55}ms`;

                            return (
                                <div
                                    key={item.label}
                                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#F8F7FF] transition-colors duration-150"
                                    style={{
                                        animation: animated
                                            ? `dashFadeUp 0.3s ease both ${delay}`
                                            : "none",
                                    }}
                                >
                                    {/* Label */}
                                    <div
                                        className="w-[106px] shrink-0 text-[12px] font-semibold text-[#3D3F6B] truncate"
                                        title={item.label}
                                    >
                                        {item.label}
                                    </div>

                                    {/* Combined bar */}
                                    <div className="flex-1 h-7 rounded-lg bg-[#EEF0F8] overflow-hidden relative">
                                        <div
                                            className="h-full flex rounded-lg overflow-hidden transition-all ease-out duration-700"
                                            style={{
                                                width: animated ? `${barW}%` : "0%",
                                                transitionDelay: delay,
                                            }}
                                        >
                                            {/* RDV portion — leftmost, violet */}
                                            {item.rdv > 0 && (
                                                <div
                                                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center overflow-hidden shrink-0"
                                                    style={{ width: `${rdvPct}%` }}
                                                >
                                                    {rdvPct > 18 && (
                                                        <span className="text-[9px] font-black text-white/90 px-1">
                                                            {item.rdv}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {/* Remaining calls — indigo */}
                                            <div className="h-full flex-1 bg-gradient-to-r from-indigo-300 to-indigo-400 opacity-70" />
                                        </div>

                                        {/* Inline calls count on bar if wide enough */}
                                        {barW > 30 && (
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9.5px] font-bold text-slate-500/70">
                                                {item.calls}
                                            </span>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div className="w-[68px] shrink-0 flex flex-col items-end gap-0.5">
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#12122A]">
                                            <span>{item.calls}</span>
                                            <span className="text-[#C0C3D8] font-normal">·</span>
                                            <span className="text-[#7C5CFC]">{item.rdv}</span>
                                        </div>
                                        <RateChip rate={item.rate} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Best segment insight ── */}
                {!isLoading && bestSegment && (
                    <div
                        className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 px-4 py-3.5 flex items-start gap-3"
                        style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "600ms" }}
                    >
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-[12.5px] font-bold text-emerald-800">
                                Meilleur segment : {bestSegment.label}
                            </p>
                            <p className="text-[11.5px] text-emerald-700/80 mt-0.5 leading-relaxed">
                                {bestSegment.rdv} RDV sur {bestSegment.calls} appels —{" "}
                                <span className="font-bold">{bestSegment.rate}% de conversion</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Footer legend ── */}
                <p className="text-[10.5px] text-[#B0B3C8] text-center">
                    La barre <span className="font-semibold text-violet-400">violette</span> représente les RDV décrochés,{" "}
                    <span className="font-semibold text-indigo-400">indigo</span> les appels sans conversion.
                </p>
            </div>
        </div>
    );
}
