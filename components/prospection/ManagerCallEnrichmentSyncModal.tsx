"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
    Loader2,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Mic,
    FileText,
    Calendar,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Phone,
} from "lucide-react";
import { Modal } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ACTION_RESULT_LABELS } from "@/lib/types";

export type CallEnrichmentQueueItem = {
    id: string;
    createdAt: string;
    result: string;
    durationSec: number | null;
    missionName: string;
    campaignName: string;
    contactLine: string;
    companyLine: string;
    phonesForMatch: string;
    sdrName: string;
    note: string | null;
    hasSummary: boolean;
    hasRecording: boolean;
    hasTranscription: boolean;
    callSummary: string | null;
    callTranscription: string | null;
    callSummaryPreview: string | null;
    callTranscriptionPreview: string | null;
    callEnrichmentAt: string | null;
    callEnrichmentError: string | null;
    willUseForce: boolean;
};

function formatDuration(sec: number | null): string {
    if (sec == null || sec <= 0) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m${String(s).padStart(2, "0")}s`;
}

function resultLabel(code: string): string {
    return ACTION_RESULT_LABELS[code] ?? code;
}

function initialDateRange(): { from: string; to: string } {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
    };
}

export interface ManagerCallEnrichmentSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Si absent : toutes les missions actives avec canal appel */
    missionId?: string;
    /** Sous-titre modal (ex. nom mission ou libellé multi-missions) */
    missionName?: string;
    onSynced: () => void;
    onToast: (kind: "success" | "error", title: string, message?: string) => void;
}

export function ManagerCallEnrichmentSyncModal({
    isOpen,
    onClose,
    missionId,
    missionName,
    onSynced,
    onToast,
}: ManagerCallEnrichmentSyncModalProps) {
    const allMissionsMode = !missionId;
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [items, setItems] = useState<CallEnrichmentQueueItem[]>([]);
    const [scanned, setScanned] = useState(0);
    const [loadingList, setLoadingList] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [callMissionCount, setCallMissionCount] = useState<number | null>(null);

    const fetchList = useCallback(
        async (from: string, to: string) => {
            if (!from || !to) return;
            if (!allMissionsMode && !missionId) return;
            setLoadingList(true);
            setListError(null);
            try {
                const qs = new URLSearchParams({ from, to });
                if (missionId) qs.set("missionId", missionId);
                else qs.set("allCallMissions", "1");
                const res = await fetch(`/api/manager/prospection/call-enrichment?${qs}`);
                const json = await res.json();
                if (!json.success) {
                    setListError(json.error ?? "Impossible de charger la liste");
                    setItems([]);
                    setScanned(0);
                    setSelectedIds(new Set());
                    setCallMissionCount(null);
                    return;
                }
                const data = json.data as {
                    items: CallEnrichmentQueueItem[];
                    scanned: number;
                    callMissionCount?: number;
                };
                setItems(data.items);
                setScanned(data.scanned);
                setSelectedIds(new Set(data.items.map((i) => i.id)));
                setExpandedIds(new Set());
                setCallMissionCount(
                    typeof data.callMissionCount === "number" ? data.callMissionCount : null,
                );
            } catch {
                setListError("Erreur réseau");
                setItems([]);
                setScanned(0);
                setSelectedIds(new Set());
                setCallMissionCount(null);
            } finally {
                setLoadingList(false);
            }
        },
        [missionId, allMissionsMode],
    );

    useEffect(() => {
        if (!isOpen) return;
        const r = initialDateRange();
        setDateFrom(r.from);
        setDateTo(r.to);
        void fetchList(r.from, r.to);
    }, [isOpen, fetchList]);

    const toggle = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleExpanded = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelectedIds(new Set(items.map((i) => i.id)));
    const selectNone = () => setSelectedIds(new Set());

    const CHUNK = 200;

    const runSync = async (ids: string[]) => {
        if (ids.length === 0) {
            onToast("error", "Aucune action sélectionnée");
            return;
        }
        setSyncing(true);
        try {
            let enriched = 0;
            let total = 0;
            let noMatch = 0;
            let noPhone = 0;
            let errors = 0;
            let skipped = 0;
            for (let i = 0; i < ids.length; i += CHUNK) {
                const chunk = ids.slice(i, i + CHUNK);
                const body = missionId
                    ? { missionId, actionIds: chunk }
                    : { actionIds: chunk };
                const res = await fetch("/api/manager/prospection/call-enrichment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                const json = await res.json();
                if (!json.success) {
                    onToast("error", "Synchronisation", json.error ?? "Échec");
                    return;
                }
                const d = json.data as {
                    enriched: number;
                    total: number;
                    noMatch: number;
                    noPhone: number;
                    errors: number;
                    skipped: number;
                };
                enriched += d.enriched;
                total += d.total;
                noMatch += d.noMatch;
                noPhone += d.noPhone;
                errors += d.errors;
                skipped += d.skipped;
            }
            onToast(
                "success",
                "Synchronisation terminée",
                `${enriched} enrichie(s) sur ${total}. ` +
                    (noMatch ? `${noMatch} sans correspondance Allo. ` : "") +
                    (noPhone ? `${noPhone} sans téléphone. ` : "") +
                    (errors ? `${errors} erreur(s). ` : "") +
                    (skipped ? `${skipped} ignorée(s).` : ""),
            );
            onSynced();
            await fetchList(dateFrom, dateTo);
        } catch {
            onToast("error", "Synchronisation", "Erreur réseau");
        } finally {
            setSyncing(false);
        }
    };

    const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
    const someSelected = selectedIds.size > 0;
    const tableColSpan = allMissionsMode ? 10 : 9;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={allMissionsMode ? "Sync appels Allo — toutes les missions" : "Sync appels Allo"}
            description={
                missionName ??
                (allMissionsMode
                    ? "Missions actives avec canal Appel"
                    : undefined)
            }
            size="xl"
            className={cn(allMissionsMode ? "max-w-6xl" : "max-w-5xl")}
        >
            <div className="space-y-5">
                <p className="text-sm text-slate-600">
                    {allMissionsMode ? (
                        <>
                            Vue agrégée sur{" "}
                            <strong className="text-slate-800">
                                {callMissionCount != null ? callMissionCount : "…"} mission
                                {callMissionCount !== 1 ? "s" : ""}
                            </strong>{" "}
                            actives (canal appel). Les actions sans résumé ou sans enregistrement Allo sur la période
                            apparaissent ci-dessous (jusqu’à 2000 appels les plus récents sur l’intervalle).
                        </>
                    ) : (
                        <>
                            Repérez les actions d’appel sans résumé ou sans enregistrement sur la période choisie,
                            puis lancez une synchronisation avec Allo (comme le bouton SDR « Sync appels »).
                        </>
                    )}{" "}
                    Utilisez la flèche sur chaque ligne pour le détail complet : résumé et transcription Allo, note
                    CRM, numéros de matching et métadonnées.
                </p>

                <div className="flex flex-wrap items-end gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0 self-end mb-2.5" aria-hidden />
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
                                Du
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="h-10 px-3 text-sm font-semibold bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
                            Au
                        </label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="h-10 px-3 text-sm font-semibold bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                        />
                    </div>
                    <button
                        type="button"
                        disabled={loadingList || !dateFrom || !dateTo}
                        onClick={() => fetchList(dateFrom, dateTo)}
                        className={cn(
                            "h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors",
                            "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50",
                        )}
                    >
                        {loadingList ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        ) : (
                            <RefreshCw className="w-4 h-4" aria-hidden />
                        )}
                        Actualiser la liste
                    </button>
                </div>

                {listError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
                        {listError}
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                        <strong className="text-slate-800">{items.length}</strong> action
                        {items.length !== 1 ? "s" : ""} avec résumé ou enregistrement manquant
                        {scanned > 0 && (
                            <>
                                {" "}
                                (sur <strong className="text-slate-700">{scanned}</strong> appel
                                {scanned !== 1 ? "s" : ""} scanné{scanned !== 1 ? "s" : ""}
                                {allMissionsMode && callMissionCount != null
                                    ? ` — ${callMissionCount} mission${callMissionCount !== 1 ? "s" : ""}`
                                    : ""}
                                )
                            </>
                        )}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={items.length === 0 || syncing}
                            onClick={selectAll}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-40 text-xs"
                        >
                            Tout sélectionner
                        </button>
                        <button
                            type="button"
                            disabled={items.length === 0 || syncing}
                            onClick={selectNone}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-40 text-xs"
                        >
                            Tout désélectionner
                        </button>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden max-h-[min(52vh,480px)] overflow-y-auto">
                    {loadingList && items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                            <span className="text-sm font-medium">Chargement…</span>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="py-14 text-center text-sm text-slate-500 px-4">
                            Aucune action incomplète sur cette période. Les appels ont déjà un résumé et un
                            enregistrement, ou il n’y a pas d’actions d’appel dans l’intervalle.
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="w-10 px-3 py-3">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={() => (allSelected ? selectNone() : selectAll())}
                                            aria-label="Sélectionner toutes les lignes"
                                            className="w-4 h-4 rounded border-slate-300 accent-indigo-600"
                                        />
                                    </th>
                                    <th className="w-10 px-1 py-3 text-[10px] font-bold uppercase text-slate-400">
                                        {/* détail */}
                                    </th>
                                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Date
                                    </th>
                                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 min-w-[200px]">
                                        Contact / Société
                                    </th>
                                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        SDR
                                    </th>
                                    {allMissionsMode && (
                                        <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 min-w-[120px]">
                                            Mission
                                        </th>
                                    )}
                                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
                                        Résumé
                                    </th>
                                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
                                        Audio
                                    </th>
                                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
                                        Transcr.
                                    </th>
                                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Sync
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {items.map((row) => {
                                    const sel = selectedIds.has(row.id);
                                    const expanded = expandedIds.has(row.id);
                                    return (
                                        <Fragment key={row.id}>
                                            <tr className={cn(sel && "bg-indigo-50/40")}>
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={sel}
                                                        onChange={() => toggle(row.id)}
                                                        aria-label={`Sélectionner ${row.contactLine}`}
                                                        className="w-4 h-4 rounded border-slate-300 accent-indigo-600"
                                                    />
                                                </td>
                                                <td className="px-1 py-2.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpanded(row.id)}
                                                        aria-expanded={expanded}
                                                        aria-label={expanded ? "Masquer le détail Allo / CRM" : "Afficher tout le détail Allo / CRM"}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                                    >
                                                        {expanded ? (
                                                            <ChevronUp className="w-4 h-4" aria-hidden />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4" aria-hidden />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-600 tabular-nums">
                                                    {new Date(row.createdAt).toLocaleString("fr-FR", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </td>
                                                <td className="px-3 py-2.5 min-w-0 max-w-[min(380px,40vw)]">
                                                    <p className="font-semibold text-slate-800 truncate" title={row.contactLine}>
                                                        {row.contactLine}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 truncate" title={row.companyLine}>
                                                        {row.companyLine}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 mt-1 flex items-start gap-1 min-w-0">
                                                        <Phone className="w-3 h-3 shrink-0 mt-0.5 opacity-60" aria-hidden />
                                                        <span className="break-all">{row.phonesForMatch}</span>
                                                    </p>
                                                    {row.callSummaryPreview && (
                                                        <p
                                                            className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-snug"
                                                            title={row.callSummary ?? undefined}
                                                        >
                                                            <span className="font-semibold text-slate-500">Résumé : </span>
                                                            {row.callSummaryPreview}
                                                        </p>
                                                    )}
                                                    {row.callTranscriptionPreview && (
                                                        <p
                                                            className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug font-mono"
                                                            title={row.callTranscription ?? undefined}
                                                        >
                                                            <span className="font-sans font-semibold text-slate-400">Transcr. : </span>
                                                            {row.callTranscriptionPreview}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                                                    {row.sdrName}
                                                </td>
                                                {allMissionsMode && (
                                                    <td className="px-3 py-2.5 min-w-0 max-w-[140px]">
                                                        <p
                                                            className="text-[11px] font-semibold text-slate-700 truncate"
                                                            title={row.missionName}
                                                        >
                                                            {row.missionName}
                                                        </p>
                                                    </td>
                                                )}
                                                <td className="px-3 py-2.5 text-center">
                                                    {row.hasSummary ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-amber-500 mx-auto" />
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    {row.hasRecording ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-amber-500 mx-auto" />
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    {row.hasTranscription ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-amber-500 mx-auto" />
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col gap-1 min-w-[128px]">
                                                        <button
                                                            type="button"
                                                            disabled={syncing}
                                                            onClick={() => runSync([row.id])}
                                                            className={cn(
                                                                "text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors",
                                                                "border-indigo-200 text-indigo-700 hover:bg-indigo-50",
                                                                "disabled:opacity-40",
                                                            )}
                                                        >
                                                            Sync cette ligne
                                                        </button>
                                                        {row.willUseForce && (
                                                            <span
                                                                className="text-[10px] text-slate-400"
                                                                title="Ré-enrichissement forcé (données partielles déjà présentes)"
                                                            >
                                                                re-sync forcé
                                                            </span>
                                                        )}
                                                        {row.callEnrichmentError && (
                                                            <span className="text-[10px] text-amber-800 break-words leading-snug">
                                                                {row.callEnrichmentError}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {expanded && (
                                                <tr className="bg-slate-50/95 border-b border-slate-200">
                                                    <td colSpan={tableColSpan} className="px-4 py-4 align-top">
                                                        <div className="space-y-4 text-xs text-slate-700">
                                                            <div>
                                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                                                    Contexte CRM
                                                                </h4>
                                                                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                                    <div>
                                                                        <dt className="text-slate-400 text-[11px]">Résultat</dt>
                                                                        <dd className="font-semibold text-slate-900 mt-0.5">
                                                                            {resultLabel(row.result)}
                                                                        </dd>
                                                                    </div>
                                                                    <div>
                                                                        <dt className="text-slate-400 text-[11px]">Durée (action)</dt>
                                                                        <dd className="font-medium mt-0.5 tabular-nums">
                                                                            {formatDuration(row.durationSec)}
                                                                        </dd>
                                                                    </div>
                                                                    <div className="sm:col-span-2">
                                                                        <dt className="text-slate-400 text-[11px]">Mission</dt>
                                                                        <dd className="font-medium mt-0.5 break-words">
                                                                            {row.missionName}
                                                                        </dd>
                                                                    </div>
                                                                    <div className="sm:col-span-2">
                                                                        <dt className="text-slate-400 text-[11px]">Campagne</dt>
                                                                        <dd className="font-medium mt-0.5 break-words">
                                                                            {row.campaignName}
                                                                        </dd>
                                                                    </div>
                                                                    <div className="sm:col-span-2 lg:col-span-4">
                                                                        <dt className="text-slate-400 text-[11px]">
                                                                            Numéros utilisés pour matcher Allo
                                                                        </dt>
                                                                        <dd className="font-mono text-[11px] mt-0.5 break-all text-slate-600">
                                                                            {row.phonesForMatch}
                                                                        </dd>
                                                                    </div>
                                                                </dl>
                                                                {row.callEnrichmentAt && (
                                                                    <p className="text-[11px] text-slate-500 mt-3">
                                                                        Dernière synchro Allo enregistrée :{" "}
                                                                        <time dateTime={row.callEnrichmentAt}>
                                                                            {new Date(row.callEnrichmentAt).toLocaleString("fr-FR")}
                                                                        </time>
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-2">
                                                                    Résumé Allo (complet)
                                                                </h4>
                                                                {row.callSummary?.trim() ? (
                                                                    <p className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed max-h-56 overflow-y-auto pr-1">
                                                                        {row.callSummary}
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-slate-400 italic">
                                                                        Aucun résumé — une synchronisation peut le récupérer depuis
                                                                        Allo.
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-2">
                                                                    Transcription (complète)
                                                                </h4>
                                                                {row.callTranscription?.trim() ? (
                                                                    <pre className="whitespace-pre-wrap font-sans text-[13px] text-slate-800 leading-relaxed max-h-72 overflow-y-auto pr-1">
                                                                        {row.callTranscription}
                                                                    </pre>
                                                                ) : (
                                                                    <p className="text-slate-400 italic">
                                                                        Aucune transcription stockée.
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                                                                    Note commerciale (CRM)
                                                                </h4>
                                                                {row.note?.trim() ? (
                                                                    <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed max-h-40 overflow-y-auto">
                                                                        {row.note}
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-slate-400 italic">Aucune note.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100">
                    <button
                        type="button"
                        disabled={syncing || items.length === 0}
                        onClick={() => runSync(items.map((i) => i.id))}
                        className={cn(
                            "h-11 px-5 rounded-xl text-sm font-bold flex items-center gap-2",
                            "bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200",
                            "disabled:opacity-40",
                        )}
                    >
                        {syncing ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        ) : (
                            <Mic className="w-4 h-4" aria-hidden />
                        )}
                        Tout synchroniser ({items.length})
                    </button>
                    <button
                        type="button"
                        disabled={syncing || !someSelected}
                        onClick={() => runSync([...selectedIds])}
                        className={cn(
                            "h-11 px-5 rounded-xl text-sm font-bold flex items-center gap-2",
                            "bg-indigo-600 text-white hover:bg-indigo-700",
                            "disabled:opacity-40",
                        )}
                    >
                        {syncing ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        ) : (
                            <FileText className="w-4 h-4" aria-hidden />
                        )}
                        Synchroniser la sélection ({selectedIds.size})
                    </button>
                </div>
            </div>
        </Modal>
    );
}
