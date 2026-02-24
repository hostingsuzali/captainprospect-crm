"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, useToast } from "@/components/ui";
import { FileDown, Share2, Check, Loader2, Calendar, TrendingUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ReportingSkeleton } from "@/components/client/skeletons";

interface MonthlySummary {
    month: number;
    year: number;
    meetingsBooked: number;
    callsMade: number;
    contactsReached: number;
    objective: number;
}

const MONTH_NAMES = [
    "", "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

export default function ClientPortalReportingPage() {
    const toast = useToast();
    const [data, setData] = useState<MonthlySummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sharingMonth, setSharingMonth] = useState<string | null>(null);
    const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/client/reporting/monthly-summary");
                const json = await res.json();
                if (json.success) setData(json.data ?? []);
            } catch (e) {
                console.error("Failed to load reporting data:", e);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const totalMeetings = data.reduce((sum, d) => sum + d.meetingsBooked, 0);
    const maxMeetings = Math.max(...data.map((d) => d.meetingsBooked), 1);
    const now = new Date();

    const handleShare = useCallback(async (entry: MonthlySummary) => {
        const key = `${entry.year}-${entry.month}`;
        setSharingMonth(key);
        try {
            const dateFrom = new Date(entry.year, entry.month - 1, 1).toISOString();
            const dateTo = new Date(entry.year, entry.month, 0, 23, 59, 59, 999).toISOString();
            const res = await fetch("/api/client/reporting/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dateFrom, dateTo }),
            });
            const json = await res.json();
            if (json.success && json.data?.url) {
                await navigator.clipboard.writeText(json.data.url);
                toast.success("Lien copie !", "Valable 30 jours. Collez-le dans un email.");
            } else {
                throw new Error(json.error || "Erreur");
            }
        } catch {
            toast.error("Erreur", "Impossible de generer le lien de partage");
        } finally {
            setSharingMonth(null);
        }
    }, [toast]);

    const handlePdf = useCallback(async (entry: MonthlySummary) => {
        const key = `${entry.year}-${entry.month}`;
        setGeneratingPdf(key);
        try {
            const dateFrom = new Date(entry.year, entry.month - 1, 1).toISOString().split("T")[0];
            const dateTo = new Date(entry.year, entry.month, 0).toISOString().split("T")[0];
            const params = new URLSearchParams({ dateFrom, dateTo, comparePrevious: "false" });
            const res = await fetch(`/api/client/reporting/pdf?${params}`);
            if (!res.ok) throw new Error("PDF generation failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `rapport-${MONTH_NAMES[entry.month]}-${entry.year}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Rapport telecharge");
        } catch {
            toast.error("Erreur", "Impossible de generer le rapport PDF");
        } finally {
            setGeneratingPdf(null);
        }
    }, [toast]);

    if (isLoading) return <ReportingSkeleton />;

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-8">
            {/* Header */}
            <div className="animate-fade-up">
                <h1 className="text-2xl font-bold text-[#12122A] tracking-tight">Rapports</h1>
                <p className="text-sm text-[#6B7194] mt-1">Suivez l&apos;evolution de vos missions</p>
            </div>

            {/* Cumulative Timeline */}
            {data.length > 0 && (
                <div className="premium-card overflow-hidden animate-fade-up" style={{ animationDelay: "80ms" }}>
                    {/* Gradient header */}
                    <div
                        className="px-6 py-5 flex items-center justify-between"
                        style={{ background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)" }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                                <TrendingUp className="w-4.5 h-4.5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                    Depuis le lancement
                                </h2>
                                <p className="text-xs text-indigo-200/70 mt-0.5">{data.length} mois d&apos;activite</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-black text-white tabular-nums">
                                <AnimatedNumber value={totalMeetings} />
                            </span>
                            <p className="text-xs text-indigo-200/70">RDV total</p>
                        </div>
                    </div>

                    <div className="p-6 space-y-3">
                        {data.map((entry) => {
                            const isCurrent = entry.month === now.getMonth() + 1 && entry.year === now.getFullYear();
                            return (
                                <div
                                    key={`${entry.year}-${entry.month}`}
                                    className={cn(
                                        "flex items-center gap-4 p-3 rounded-xl transition-all duration-300",
                                        isCurrent
                                            ? "bg-gradient-to-r from-indigo-50 to-violet-50/50 border border-indigo-200/50 shadow-sm"
                                            : "hover:bg-[#F8F7FF] border border-transparent"
                                    )}
                                >
                                    <span className={cn(
                                        "text-sm font-semibold w-24 flex-shrink-0",
                                        isCurrent ? "text-[#6C3AFF]" : "text-[#12122A]"
                                    )}>
                                        {MONTH_NAMES[entry.month]} {entry.year}
                                    </span>
                                    <div className="flex-1">
                                        <ProgressBar value={entry.meetingsBooked} max={maxMeetings} height="sm" />
                                    </div>
                                    <span className="text-sm font-bold text-[#12122A] tabular-nums w-16 text-right">
                                        <AnimatedNumber value={entry.meetingsBooked} /> RDV
                                    </span>
                                    {isCurrent && (
                                        <span className="text-[10px] font-bold text-white bg-gradient-to-r from-[#6C3AFF] to-[#7C5CFC] px-2.5 py-1 rounded-full shadow-sm shadow-[#7C5CFC]/20">
                                            en cours
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Monthly Report Cards */}
            {data.length > 0 && (
                <div>
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C5CFC] to-[#A78BFA] flex items-center justify-center shadow-sm shadow-[#7C5CFC]/20">
                            <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="text-sm font-bold text-[#12122A] uppercase tracking-wider">
                            Rapports mensuels
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                        {[...data].reverse().map((entry) => {
                            const key = `${entry.year}-${entry.month}`;
                            const isCurrent = entry.month === now.getMonth() + 1 && entry.year === now.getFullYear();
                            const metObjective = entry.meetingsBooked >= entry.objective;
                            const contactRate = entry.callsMade > 0
                                ? Math.round((entry.contactsReached / entry.callsMade) * 100)
                                : 0;
                            const pct = entry.objective > 0 ? Math.round((entry.meetingsBooked / entry.objective) * 100) : 0;

                            return (
                                <div key={key} className="premium-card overflow-hidden">
                                    {/* Card accent top bar */}
                                    <div className={cn(
                                        "h-1",
                                        metObjective
                                            ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                                            : isCurrent
                                            ? "bg-gradient-to-r from-amber-400 to-orange-400"
                                            : "bg-gradient-to-r from-[#6C3AFF] to-[#A78BFA]"
                                    )} />

                                    <div className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-bold text-[#12122A]">
                                                {MONTH_NAMES[entry.month]} {entry.year}
                                            </h3>
                                            {isCurrent ? (
                                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60">
                                                    En cours
                                                </span>
                                            ) : metObjective ? (
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Atteint
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="space-y-3 mb-5">
                                            <div className="flex items-end gap-2">
                                                <span className="text-4xl font-black gradient-text tabular-nums">
                                                    {entry.meetingsBooked}
                                                </span>
                                                <span className="text-sm text-[#6B7194] mb-1.5 font-medium">
                                                    RDV {!isCurrent && entry.objective > 0 && `(${pct}%)`}
                                                </span>
                                            </div>
                                            {entry.objective > 0 && (
                                                <ProgressBar value={entry.meetingsBooked} max={entry.objective} height="sm" />
                                            )}
                                            <div className="flex items-center gap-3 text-sm text-[#6B7194]">
                                                <span className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                                                    {entry.callsMade} appels
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                                                    {contactRate}% contact
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-4 border-t border-[#E8EBF0]">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1.5 rounded-xl text-xs flex-1 hover:border-[#7C5CFC]/30 hover:text-[#7C5CFC] transition-all"
                                                onClick={() => handlePdf(entry)}
                                                disabled={generatingPdf === key}
                                            >
                                                {generatingPdf === key ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <FileDown className="w-3.5 h-3.5" />
                                                )}
                                                PDF
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1.5 rounded-xl text-xs flex-1 hover:border-[#7C5CFC]/30 hover:text-[#7C5CFC] transition-all"
                                                onClick={() => handleShare(entry)}
                                                disabled={sharingMonth === key}
                                            >
                                                {sharingMonth === key ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Share2 className="w-3.5 h-3.5" />
                                                )}
                                                Partager
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {data.length === 0 && !isLoading && (
                <div className="text-center py-16 bg-white rounded-2xl border border-[#E8EBF0] shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F4F6F9] to-[#E8EBF0] flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-7 h-7 text-[#A0A3BD]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#12122A] mb-1">Aucun rapport disponible</h3>
                    <p className="text-sm text-[#6B7194] max-w-sm mx-auto">
                        Les rapports mensuels apparaitront ici une fois votre mission lancee.
                    </p>
                </div>
            )}
        </div>
    );
}
