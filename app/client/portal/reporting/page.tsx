"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Select, useToast } from "@/components/ui";
import { FileDown, Loader2, BarChart3, Calendar } from "lucide-react";
import { ReportLayout } from "@/components/reporting/ReportLayout";
import type { ReportData } from "@/lib/reporting/types";
import { toISO } from "@/components/dashboard/DateRangeFilter";

interface Mission {
    id: string;
    name: string;
    isActive: boolean;
}

export default function ClientPortalReportingPage() {
    const { success, error: showError } = useToast();
    const [missions, setMissions] = useState<Mission[]>([]);
    const [loadingMissions, setLoadingMissions] = useState(true);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        d.setDate(1);
        return toISO(d);
    });
    const [dateTo, setDateTo] = useState(() => toISO(new Date()));
    const [missionId, setMissionId] = useState<string>("");
    const [comparePrevious, setComparePrevious] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/missions?isActive=true&limit=100");
                const json = await res.json();
                if (cancelled) return;
                if (json.success && Array.isArray(json.data)) setMissions(json.data);
            } finally {
                if (!cancelled) setLoadingMissions(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleGenerate = useCallback(async () => {
        if (!dateFrom || !dateTo) {
            showError("Période requise", "Veuillez sélectionner une date de début et de fin.");
            return;
        }
        if (new Date(dateFrom) > new Date(dateTo)) {
            showError("Dates invalides", "La date de début doit être avant la date de fin.");
            return;
        }
        setLoadingReport(true);
        setReportData(null);
        try {
            const params = new URLSearchParams({
                dateFrom,
                dateTo,
                comparePrevious: String(comparePrevious),
            });
            if (missionId) params.set("missionId", missionId);
            const res = await fetch(`/api/client/reporting/data?${params.toString()}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Échec du chargement des données");
            if (json.success && json.data) setReportData(json.data);
            else throw new Error("Données invalides");
        } catch (e) {
            showError(
                "Erreur",
                e instanceof Error ? e.message : "Impossible de charger le rapport."
            );
        } finally {
            setLoadingReport(false);
        }
    }, [dateFrom, dateTo, missionId, comparePrevious, showError]);

    const handleExportPdf = useCallback(async () => {
        if (!dateFrom || !dateTo) {
            showError("Période requise", "Veuillez sélectionner une date de début et de fin.");
            return;
        }
        if (new Date(dateFrom) > new Date(dateTo)) {
            showError("Dates invalides", "La date de début doit être avant la date de fin.");
            return;
        }
        setGeneratingPdf(true);
        try {
            const params = new URLSearchParams({
                dateFrom,
                dateTo,
                comparePrevious: String(comparePrevious),
            });
            if (missionId) params.set("missionId", missionId);
            const res = await fetch(`/api/client/reporting/pdf?${params.toString()}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || "Échec de la génération du rapport");
            }
            const blob = await res.blob();
            const disposition = res.headers.get("Content-Disposition");
            const filename =
                disposition?.match(/filename="?(.+)"?/)?.[1]?.trim() ||
                `rapport-${dateFrom}-${dateTo}.pdf`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            success("Rapport généré", "Le PDF a été téléchargé.");
        } catch (e) {
            showError(
                "Erreur",
                e instanceof Error ? e.message : "Impossible de générer le rapport."
            );
        } finally {
            setGeneratingPdf(false);
        }
    }, [dateFrom, dateTo, missionId, comparePrevious, success, showError]);

    const missionOptions = [
        { value: "", label: "Toutes les missions" },
        ...missions.map((m) => ({ value: m.id, label: m.name })),
    ];

    return (
        <div className="min-h-full bg-[#F4F6F9] p-6 space-y-8">
            {/* Page header */}
            <div>
                <h1 className="text-[22px] font-bold text-[#12122A] tracking-tight">
                    Rapport d'activité
                </h1>
                <p className="text-[13px] text-[#8B8BA7] mt-0.5">
                    Configurez la période et la mission, prévisualisez le rapport puis exportez en PDF.
                </p>
            </div>

            {/* Config card */}
            <Card className="border-[#E8EBF0] bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6">
                    <h2 className="text-sm font-semibold text-[#12122A] mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#7C5CFC]" />
                        Paramètres du rapport
                    </h2>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
                        <div>
                            <label className="mb-2 block text-xs font-medium text-[#8B8BA7]">
                                Date de début
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full rounded-lg border border-[#E8EBF0] px-3 py-2 text-sm text-[#12122A] focus:border-[#7C5CFC] focus:outline-none focus:ring-1 focus:ring-[#7C5CFC]"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-medium text-[#8B8BA7]">
                                Date de fin
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full rounded-lg border border-[#E8EBF0] px-3 py-2 text-sm text-[#12122A] focus:border-[#7C5CFC] focus:outline-none focus:ring-1 focus:ring-[#7C5CFC]"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-medium text-[#8B8BA7]">
                                Mission
                            </label>
                            <Select
                                options={missionOptions}
                                value={missionId}
                                onChange={setMissionId}
                                disabled={loadingMissions}
                                placeholder="Toutes les missions"
                                className="w-full"
                            />
                        </div>
                        <div className="flex flex-col justify-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={comparePrevious}
                                    onChange={(e) => setComparePrevious(e.target.checked)}
                                    className="rounded border-[#E8EBF0] text-[#7C5CFC] focus:ring-[#7C5CFC]"
                                />
                                <span className="text-sm text-[#12122A]">
                                    Comparer à la période précédente
                                </span>
                            </label>
                        </div>
                        <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-1">
                            <Button
                                onClick={handleGenerate}
                                disabled={loadingReport || loadingMissions}
                                className="inline-flex items-center gap-2"
                            >
                                {loadingReport ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Calendar className="h-4 w-4" />
                                )}
                                {loadingReport ? "Chargement…" : "Générer le rapport"}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Preview + Export */}
            {loadingReport && (
                <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-[#E8EBF0] bg-white">
                    <Loader2 className="w-8 h-8 text-[#7C5CFC] animate-spin" />
                    <p className="text-[13px] text-[#8B8BA7] font-medium mt-4">
                        Chargement des données du rapport…
                    </p>
                </div>
            )}

            {!loadingReport && reportData && (
                <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h2 className="text-lg font-semibold text-[#12122A]">Aperçu du rapport</h2>
                        <Button
                            variant="outline"
                            onClick={handleExportPdf}
                            disabled={generatingPdf}
                            className="gap-2"
                        >
                            {generatingPdf ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <FileDown className="h-4 w-4" />
                            )}
                            {generatingPdf ? "Génération du PDF…" : "Télécharger le PDF"}
                        </Button>
                    </div>
                    <ReportLayout data={reportData} />
                </div>
            )}

            {!loadingReport && !reportData && (
                <Card className="border-[#E8EBF0] bg-white rounded-xl border-dashed p-12 text-center">
                    <BarChart3 className="w-12 h-12 text-[#C5C8D4] mx-auto mb-4" />
                    <p className="text-sm font-medium text-[#8B8BA7]">
                        Sélectionnez une période et cliquez sur « Générer le rapport » pour voir l'aperçu.
                    </p>
                </Card>
            )}
        </div>
    );
}
