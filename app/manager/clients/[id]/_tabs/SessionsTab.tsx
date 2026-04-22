"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Mic, Video, Calendar, Search, Filter } from "lucide-react";
import { Button, Badge, EmptyState, Skeleton, Input, Select, useToast, Modal, ModalFooter } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import { SideDetailPanel } from "@/app/manager/_shared/SideDetailPanel";
import type { ClientShellData } from "../ClientDetailShell";
import { useClientNavState } from "../_hooks/useClientNavState";
import { SessionDetailPanel } from "../_panels/SessionDetailPanel";

type SessionType = "Kick-Off" | "Onboarding" | "Validation" | "Reporting" | "Suivi" | "Autre";

export interface SessionData {
    id: string;
    type: SessionType;
    customTypeLabel?: string;
    date: string;
    leexiId?: string;
    recordingUrl?: string;
    crMarkdown?: string;
    summaryEmail?: string;
    emailSentAt?: string | null;
    projectId?: string | null;
    tasks: {
        id: string;
        label: string;
        assignee?: string;
        assigneeRole?: "SDR" | "MANAGER" | "DEV" | "ALWAYS";
        priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
        dueDate?: string | null;
        doneAt?: string | null;
        taskId?: string | null;
    }[];
    createdAt: string;
}

const SESSION_TYPE_VARIANTS: Record<SessionType, "default" | "primary" | "success" | "warning" | "danger"> = {
    "Kick-Off": "primary",
    Onboarding: "success",
    Validation: "danger",
    Reporting: "warning",
    Suivi: "default",
    Autre: "default",
};

export function SessionsTab({ client }: { client: ClientShellData }) {
    const nav = useClientNavState();
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | SessionType>("all");
    const [showNewSessionModal, setShowNewSessionModal] = useState(false);

    const query = useQuery({
        queryKey: qk.clientSessions(client.id),
        queryFn: async () => {
            const res = await fetch(`/api/clients/${client.id}/sessions`);
            const json = await res.json();
            return (json?.data ?? []) as SessionData[];
        },
        staleTime: 30_000,
    });

    const filtered = useMemo(() => {
        const list = query.data ?? [];
        return list.filter((s) => {
            if (typeFilter !== "all" && s.type !== typeFilter) return false;
            if (search && !(s.type + " " + (s.customTypeLabel ?? "")).toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [query.data, search, typeFilter]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-slate-900">Sessions & CRs</h2>
                <Button variant="primary" size="sm" onClick={() => setShowNewSessionModal(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Nouvelle session
                </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                </div>
                <Select
                    value={typeFilter}
                    onChange={(v) => setTypeFilter(v as "all" | SessionType)}
                    options={[
                        { value: "all", label: "Tous les types" },
                        { value: "Kick-Off", label: "Kick-Off" },
                        { value: "Onboarding", label: "Onboarding" },
                        { value: "Validation", label: "Validation" },
                        { value: "Reporting", label: "Reporting" },
                        { value: "Suivi", label: "Suivi" },
                        { value: "Autre", label: "Autre" },
                    ]}
                    className="w-[180px]"
                />
            </div>

            {query.isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                </div>
            ) : query.error ? (
                <ErrorCard message="Impossible de charger les sessions" onRetry={() => query.refetch()} />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={Mic}
                    title="Aucune session"
                    description="Créez un CR à partir d'une transcription Leexi ou manuellement."
                    action={<Button variant="primary" onClick={() => setShowNewSessionModal(true)}>Nouvelle session</Button>}
                />
            ) : (
                <ul className="space-y-2">
                    {filtered.map((s) => {
                        const typeLabel = s.type === "Autre" && s.customTypeLabel ? s.customTypeLabel : s.type;
                        const overdueCount = s.tasks.filter(
                            (t) => !t.doneAt && t.dueDate && new Date(t.dueDate).getTime() < Date.now()
                        ).length;
                        const pending = s.tasks.filter((t) => !t.doneAt).length;
                        return (
                            <button
                                key={s.id}
                                onClick={() => nav.setS(s.id)}
                                className="w-full text-left p-4 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all rounded-xl"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant={SESSION_TYPE_VARIANTS[s.type]}>{typeLabel}</Badge>
                                            <span className="text-sm text-slate-600">
                                                {new Date(s.date).toLocaleDateString("fr-FR", {
                                                    day: "2-digit",
                                                    month: "long",
                                                    year: "numeric",
                                                })}
                                            </span>
                                            <IdChip id={s.id} length={6} />
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                                            {s.recordingUrl && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Video className="w-3.5 h-3.5" /> enregistrement
                                                </span>
                                            )}
                                            {pending > 0 && (
                                                <span className={overdueCount ? "text-red-600 font-medium" : ""}>
                                                    {pending} tâche{pending > 1 ? "s" : ""} en cours
                                                    {overdueCount > 0 ? ` (${overdueCount} en retard)` : ""}
                                                </span>
                                            )}
                                            {s.emailSentAt && (
                                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                                    email envoyé le {new Date(s.emailSentAt).toLocaleDateString("fr-FR")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                </div>
                            </button>
                        );
                    })}
                </ul>
            )}

            <SideDetailPanel
                isOpen={!!nav.s}
                onClose={() => nav.setS(null)}
                title={nav.s ? "Session" : undefined}
                fullPageHref={undefined}
            >
                {nav.s && (
                    <SessionDetailPanel
                        clientId={client.id}
                        sessionId={nav.s}
                        sessions={query.data ?? []}
                        onChanged={() => query.refetch()}
                    />
                )}
            </SideDetailPanel>

            <NewSessionModal
                isOpen={showNewSessionModal}
                onClose={() => setShowNewSessionModal(false)}
                clientId={client.id}
                clientName={client.name}
            />
        </div>
    );
}

// ==========================================================================
// NEW SESSION MODAL (Leexi / manual CR + AI generation)
// ==========================================================================

function NewSessionModal({
    isOpen,
    onClose,
    clientId,
    clientName,
}: {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
}) {
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();
    const [type, setType] = useState<SessionType>("Kick-Off");
    const [customTypeLabel, setCustomTypeLabel] = useState("");
    const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 16));
    const [leexiId, setLeexiId] = useState("");
    const [manualTranscript, setManualTranscript] = useState("");
    const [crMarkdown, setCrMarkdown] = useState("");
    const [summaryEmail, setSummaryEmail] = useState("");
    const [notifyByEmail, setNotifyByEmail] = useState(false);
    const [mode, setMode] = useState<"leexi" | "text" | "cr">("leexi");
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateCR = async () => {
        const transcript =
            mode === "leexi"
                ? await fetchLeexiTranscript(leexiId)
                : manualTranscript;
        if (!transcript?.trim()) {
            showError("Aucune transcription", "Ajoute une transcription pour générer le CR.");
            return;
        }
        setIsGenerating(true);
        try {
            const res = await fetch("/api/ai/generate-cr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientName,
                    sessionType: type === "Autre" && customTypeLabel ? customTypeLabel : type,
                    sessionDate: new Date(date).toLocaleDateString("fr-FR"),
                    transcript,
                    notifyByEmail,
                }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json?.error || "Impossible de générer le CR");
            }
            setCrMarkdown(json.data?.cr || json.cr || "");
            setSummaryEmail(json.data?.email || json.email || "");
            success("CR généré", "Relis et valide avant d'enregistrer.");
        } catch (err: unknown) {
            showError("Erreur", err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setIsGenerating(false);
        }
    };

    const save = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/clients/${clientId}/sessions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type,
                    customTypeLabel: type === "Autre" ? customTypeLabel : undefined,
                    date: new Date(date).toISOString(),
                    leexiId: mode === "leexi" ? leexiId : undefined,
                    crMarkdown: crMarkdown || undefined,
                    summaryEmail: summaryEmail || undefined,
                    notifyByEmail,
                }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json?.error || "Impossible d'enregistrer");
            }
            return json;
        },
        onSuccess: () => {
            success("Session créée");
            queryClient.invalidateQueries({ queryKey: qk.clientSessions(clientId) });
            onClose();
            resetForm();
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const resetForm = () => {
        setType("Kick-Off");
        setCustomTypeLabel("");
        setDate(new Date().toISOString().slice(0, 16));
        setLeexiId("");
        setManualTranscript("");
        setCrMarkdown("");
        setSummaryEmail("");
        setMode("leexi");
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                if (!save.isPending) onClose();
            }}
            title="Nouvelle session"
            description="Génère un compte-rendu à partir d'une transcription Leexi ou saisis-le manuellement."
            size="xl"
        >
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                    <Select
                        label="Type"
                        value={type}
                        onChange={(v) => setType(v as SessionType)}
                        options={[
                            { value: "Kick-Off", label: "Kick-Off" },
                            { value: "Onboarding", label: "Onboarding" },
                            { value: "Validation", label: "Validation" },
                            { value: "Reporting", label: "Reporting" },
                            { value: "Suivi", label: "Suivi" },
                            { value: "Autre", label: "Autre" },
                        ]}
                    />
                    <Input
                        label="Date"
                        type="datetime-local"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>
                {type === "Autre" && (
                    <Input
                        label="Nom du type"
                        value={customTypeLabel}
                        onChange={(e) => setCustomTypeLabel(e.target.value)}
                        placeholder="Ex : Atelier copywriting"
                    />
                )}

                <div className="flex gap-2">
                    {(["leexi", "text", "cr"] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                                mode === m
                                    ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                        >
                            {m === "leexi" ? "Leexi ID" : m === "text" ? "Transcription" : "CR direct"}
                        </button>
                    ))}
                </div>

                {mode === "leexi" && (
                    <Input
                        label="Leexi ID"
                        value={leexiId}
                        onChange={(e) => setLeexiId(e.target.value)}
                        placeholder="leexi_xxxx"
                    />
                )}
                {mode === "text" && (
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1.5 block">Transcription</label>
                        <textarea
                            value={manualTranscript}
                            onChange={(e) => setManualTranscript(e.target.value)}
                            rows={6}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                            placeholder="Colle la transcription ici..."
                        />
                    </div>
                )}

                {(mode === "leexi" || mode === "text") && (
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleGenerateCR}
                        isLoading={isGenerating}
                        disabled={isGenerating}
                    >
                        Générer le CR avec l&apos;IA
                    </Button>
                )}

                <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Compte-rendu (markdown)</label>
                    <textarea
                        value={crMarkdown}
                        onChange={(e) => setCrMarkdown(e.target.value)}
                        rows={10}
                        className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        placeholder="# Titre du CR..."
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Mail de synthèse</label>
                    <textarea
                        value={summaryEmail}
                        onChange={(e) => setSummaryEmail(e.target.value)}
                        rows={5}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={notifyByEmail}
                        onChange={(e) => setNotifyByEmail(e.target.checked)}
                        className="w-4 h-4"
                    />
                    Envoyer le mail de synthèse automatiquement
                </label>
            </div>

            <ModalFooter>
                <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
                    Annuler
                </Button>
                <Button
                    variant="primary"
                    onClick={() => save.mutate()}
                    isLoading={save.isPending}
                    disabled={save.isPending}
                >
                    Enregistrer la session
                </Button>
            </ModalFooter>
        </Modal>
    );
}

async function fetchLeexiTranscript(leexiId: string): Promise<string | null> {
    if (!leexiId) return null;
    try {
        const res = await fetch(`/api/leexi/transcript/${leexiId}`);
        const json = await res.json();
        return json?.data?.transcript ?? json?.transcript ?? null;
    } catch {
        return null;
    }
}

export default SessionsTab;
