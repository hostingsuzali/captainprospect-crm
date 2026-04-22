"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BarChart3, Download, Share2, FileText } from "lucide-react";
import { Button, Input, Skeleton, Badge, useToast } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import { BreakdownCharts } from "@/components/client/BreakdownCharts";
import type { ClientShellData } from "../ClientDetailShell";

interface ReportingData {
    actions?: { total: number; byChannel?: Record<string, number> };
    meetings?: { total: number };
    opportunities?: { total: number };
    missions?: { id: string; name: string }[];
}

export function ReportingTab({ client }: { client: ClientShellData }) {
    const { success, error: showError } = useToast();
    const today = new Date();
    const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const defaultTo = today.toISOString().slice(0, 10);
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(defaultTo);

    const reporting = useQuery({
        queryKey: qk.clientReporting(client.id, from, to),
        queryFn: async () => {
            const res = await fetch(
                `/api/client/reporting/data?clientId=${client.id}&dateFrom=${from}&dateTo=${to}`
            );
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return (json?.data ?? json) as ReportingData;
        },
        staleTime: 30_000,
    });

    const shareReport = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/client/reporting/share`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: client.id, dateFrom: from, dateTo: to }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: (json) => {
            const url = json?.data?.shareUrl || json?.shareUrl;
            if (url) {
                navigator.clipboard.writeText(url);
                success("Lien copié", url);
            } else {
                success("Rapport partagé");
            }
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Reporting
                </h2>
                <div className="flex items-center gap-2">
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    <span className="text-slate-400">→</span>
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    <Button variant="outline" size="sm" onClick={() => shareReport.mutate()} isLoading={shareReport.isPending}>
                        <Share2 className="w-4 h-4 mr-1" /> Partager
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            window.open(
                                `/api/client/reporting/pdf?clientId=${client.id}&dateFrom=${from}&dateTo=${to}`,
                                "_blank"
                            );
                        }}
                    >
                        <Download className="w-4 h-4 mr-1" /> PDF
                    </Button>
                </div>
            </div>

            {reporting.isLoading ? (
                <Skeleton className="h-40" />
            ) : reporting.error ? (
                <ErrorCard message="Impossible de charger le reporting" onRetry={() => reporting.refetch()} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ReportBlock label="Actions" value={reporting.data?.actions?.total ?? 0} />
                    <ReportBlock label="RDV bookés" value={reporting.data?.meetings?.total ?? 0} />
                    <ReportBlock label="Opportunités" value={reporting.data?.opportunities?.total ?? 0} />
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" /> Vue d&apos;ensemble
                </h3>
                <BreakdownCharts />
            </div>
        </div>
    );
}

function ReportBlock({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 text-center">
            <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
            <div className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{value}</div>
        </div>
    );
}

export default ReportingTab;
