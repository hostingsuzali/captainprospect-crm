"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
    Phone,
    Mail,
    Linkedin,
    Building2,
    User,
    Target,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Ban,
    Loader2,
    Clock,
    Calendar,
    Sparkles,
    Filter,
    RotateCcw,
    RefreshCw,
    ArrowLeft,
} from "lucide-react";
import { Card, Badge, Button, DataTable } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { UnifiedActionDrawer } from "@/components/drawers/UnifiedActionDrawer";
import { QuickEmailModal } from "@/components/email/QuickEmailModal";
import type { ActionResult, Channel } from "@/lib/types";
import { ACTION_RESULT_LABELS, CHANNEL_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface MissionWithLists {
    id: string;
    name: string;
    channel: string;
    client: { id: string; name: string };
    lists: { id: string; name: string; type: string }[];
}

interface QueueItem {
    contactId: string | null;
    companyId: string;
    contact: {
        id: string;
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
        email?: string | null;
        phone?: string | null;
        linkedin?: string | null;
        status: string;
    } | null;
    company: {
        id: string;
        name: string;
        industry?: string | null;
        website?: string | null;
        country?: string | null;
        phone?: string | null;
    };
    campaignId: string;
    channel: string;
    missionName: string;
    lastAction: { result: string; note?: string | null; createdAt: string } | null;
    priority: string;
    _displayName?: string;
    _companyName?: string;
}

const RESULT_ICON_MAP: Record<string, React.ReactNode> = {
    NO_RESPONSE: <XCircle className="w-4 h-4" />,
    BAD_CONTACT: <Ban className="w-4 h-4" />,
    INTERESTED: <Sparkles className="w-4 h-4" />,
    CALLBACK_REQUESTED: <Clock className="w-4 h-4" />,
    MEETING_BOOKED: <Calendar className="w-4 h-4" />,
    MEETING_CANCELLED: <XCircle className="w-4 h-4" />,
    DISQUALIFIED: <XCircle className="w-4 h-4" />,
    ENVOIE_MAIL: <Mail className="w-4 h-4" />,
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
    CALLBACK: { label: "Rappel", color: "bg-amber-50 text-amber-700 border-amber-200" },
    FOLLOW_UP: { label: "Suivi", color: "bg-blue-50 text-blue-700 border-blue-200" },
    NEW: { label: "Nouveau", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    RETRY: { label: "Relance", color: "bg-slate-50 text-slate-700 border-slate-200" },
};

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    CALL: Phone,
    EMAIL: Mail,
    LINKEDIN: Linkedin,
};

// ============================================
// PROSPECTION PAGE
// ============================================

export default function ManagerProspectionPage() {
    const [missions, setMissions] = useState<MissionWithLists[]>([]);
    const [missionsLoading, setMissionsLoading] = useState(true);

    const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [selectedMissionName, setSelectedMissionName] = useState<string>("");
    const [selectedListName, setSelectedListName] = useState<string>("");

    const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
    const [queueLoading, setQueueLoading] = useState(false);
    const [tableSearchInput, setTableSearchInput] = useState("");
    const [tableSearchApi, setTableSearchApi] = useState("");
    const [tableFilterResult, setTableFilterResult] = useState<string>("");
    const [tableFilterPriority, setTableFilterPriority] = useState<string>("");
    const [tableFilterChannel, setTableFilterChannel] = useState<string>("");
    const [tableFilterType, setTableFilterType] = useState<string>("");
    const [submittingRowKey, setSubmittingRowKey] = useState<string | null>(null);
    const [actionsCompleted, setActionsCompleted] = useState(0);

    const [statusConfig, setStatusConfig] = useState<{ statuses: Array<{ code: string; label: string; requiresNote: boolean }> } | null>(null);
    const [unifiedDrawerOpen, setUnifiedDrawerOpen] = useState(false);
    const [unifiedDrawerContactId, setUnifiedDrawerContactId] = useState<string | null>(null);
    const [unifiedDrawerCompanyId, setUnifiedDrawerCompanyId] = useState<string | null>(null);
    const [unifiedDrawerMissionId, setUnifiedDrawerMissionId] = useState<string | undefined>();
    const [unifiedDrawerMissionName, setUnifiedDrawerMissionName] = useState<string | undefined>();
    const [unifiedDrawerClientBookingUrl, setUnifiedDrawerClientBookingUrl] = useState<string>("");
    const [drawerRow, setDrawerRow] = useState<QueueItem | null>(null);

    const [showQuickEmailModal, setShowQuickEmailModal] = useState(false);
    const [emailModalContact, setEmailModalContact] = useState<{
        id: string;
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        title?: string | null;
        company?: { id: string; name: string };
    } | null>(null);
    const [emailModalMissionId, setEmailModalMissionId] = useState<string | null>(null);
    const [emailModalMissionName, setEmailModalMissionName] = useState<string | null>(null);
    const [emailModalCompany, setEmailModalCompany] = useState<{ id: string; name: string; phone?: string | null } | null>(null);
    const [pendingEmailAction, setPendingEmailAction] = useState<{ row: QueueItem; result: ActionResult } | null>(null);

    const [recentlyUpdatedRowKeys, setRecentlyUpdatedRowKeys] = useState<Set<string>>(new Set());
    const recentlyUpdatedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch missions with lists (for picker)
    useEffect(() => {
        let cancelled = false;
        setMissionsLoading(true);
        fetch("/api/missions?isActive=true&limit=100")
            .then((res) => res.json())
            .then((json) => {
                if (!cancelled && json.success && Array.isArray(json.data)) {
                    setMissions(json.data);
                }
            })
            .finally(() => { if (!cancelled) setMissionsLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // Status config when in table view
    useEffect(() => {
        if (!selectedMissionId) {
            setStatusConfig(null);
            return;
        }
        fetch(`/api/config/action-statuses?missionId=${selectedMissionId}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.success && json.data?.statuses) {
                    setStatusConfig({ statuses: json.data.statuses });
                } else {
                    setStatusConfig(null);
                }
            })
            .catch(() => setStatusConfig(null));
    }, [selectedMissionId]);

    const resultOptions = statusConfig?.statuses?.length
        ? statusConfig.statuses.map((s, i) => ({
            value: s.code as ActionResult,
            label: s.label,
            icon: RESULT_ICON_MAP[s.code] ?? <XCircle className="w-4 h-4" />,
            key: String(i + 1),
            color: ["slate", "red", "emerald", "amber", "indigo", "slate", "blue"][i % 7] as string,
        }))
        : [
            { value: "NO_RESPONSE" as ActionResult, label: "Pas de réponse", icon: <XCircle className="w-4 h-4" />, key: "1", color: "slate" },
            { value: "BAD_CONTACT" as ActionResult, label: "Mauvais contact", icon: <Ban className="w-4 h-4" />, key: "2", color: "red" },
            { value: "INTERESTED" as ActionResult, label: "Intéressé", icon: <Sparkles className="w-4 h-4" />, key: "3", color: "emerald" },
            { value: "CALLBACK_REQUESTED" as ActionResult, label: "Rappel demandé", icon: <Clock className="w-4 h-4" />, key: "4", color: "amber" },
            { value: "MEETING_BOOKED" as ActionResult, label: "RDV pris", icon: <Calendar className="w-4 h-4" />, key: "5", color: "indigo" },
            { value: "DISQUALIFIED" as ActionResult, label: "Disqualifié", icon: <XCircle className="w-4 h-4" />, key: "6", color: "slate" },
            { value: "ENVOIE_MAIL" as ActionResult, label: "Envoie mail", icon: <Mail className="w-4 h-4" />, key: "7", color: "blue" },
        ];

    const statusLabels: Record<string, string> = statusConfig?.statuses?.length
        ? Object.fromEntries(statusConfig.statuses.map((s) => [s.code, s.label]))
        : ACTION_RESULT_LABELS;

    const getRequiresNote = (code: string) =>
        statusConfig?.statuses?.find((s) => s.code === code)?.requiresNote ??
        ["INTERESTED", "CALLBACK_REQUESTED", "ENVOIE_MAIL"].includes(code);

    const filteredQueueItems = useMemo(() => {
        return queueItems.filter((row) => {
            if (tableFilterResult) {
                if (tableFilterResult === "NONE") {
                    if (row.lastAction) return false;
                } else if (!row.lastAction || row.lastAction.result !== tableFilterResult) return false;
            }
            if (tableFilterPriority && row.priority !== tableFilterPriority) return false;
            if (tableFilterChannel && row.channel !== tableFilterChannel) return false;
            if (tableFilterType === "contact" && !row.contactId) return false;
            if (tableFilterType === "company" && row.contactId) return false;
            return true;
        });
    }, [queueItems, tableFilterResult, tableFilterPriority, tableFilterChannel, tableFilterType]);

    const hasTableFiltersActive = !!(tableFilterResult || tableFilterPriority || tableFilterChannel || tableFilterType);
    const clearTableFilters = () => {
        setTableFilterResult("");
        setTableFilterPriority("");
        setTableFilterChannel("");
        setTableFilterType("");
    };

    useEffect(() => {
        if (!tableSearchInput.trim()) {
            setTableSearchApi("");
            return;
        }
        const t = setTimeout(() => setTableSearchApi(tableSearchInput.trim()), 400);
        return () => clearTimeout(t);
    }, [tableSearchInput]);

    const queueRowKey = (row: QueueItem) => row.contactId ?? row.companyId;

    const refreshQueue = useCallback(() => {
        if (!selectedMissionId || !selectedListId) return;
        setQueueLoading(true);
        const params = new URLSearchParams();
        params.set("missionId", selectedMissionId);
        params.set("listId", selectedListId);
        if (tableSearchApi) params.set("search", tableSearchApi);
        params.set("_t", String(Date.now()));
        fetch(`/api/manager/prospection/action-queue?${params.toString()}`, { cache: "no-store" })
            .then((res) => res.json())
            .then((json) => {
                if (json.success && json.data?.items) {
                    const items = json.data.items as QueueItem[];
                    setQueueItems(items.map((i) => ({
                        ...i,
                        _displayName: i.contact
                            ? `${(i.contact.firstName || "").trim()} ${(i.contact.lastName || "").trim()}`.trim() || i.company.name
                            : i.company.name,
                        _companyName: i.company.name,
                    })));
                }
            })
            .finally(() => setQueueLoading(false));
    }, [selectedMissionId, selectedListId, tableSearchApi]);

    useEffect(() => {
        if (viewMode !== "table" || !selectedMissionId || !selectedListId) {
            setQueueItems([]);
            return;
        }
        setQueueLoading(true);
        const params = new URLSearchParams();
        params.set("missionId", selectedMissionId);
        params.set("listId", selectedListId);
        if (tableSearchApi) params.set("search", tableSearchApi);
        fetch(`/api/manager/prospection/action-queue?${params.toString()}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.success && json.data?.items) {
                    const items = json.data.items as QueueItem[];
                    setQueueItems(items.map((i) => ({
                        ...i,
                        _displayName: i.contact
                            ? `${(i.contact.firstName || "").trim()} ${(i.contact.lastName || "").trim()}`.trim() || i.company.name
                            : i.company.name,
                        _companyName: i.company.name,
                    })));
                } else {
                    setQueueItems([]);
                }
            })
            .catch(() => setQueueItems([]))
            .finally(() => setQueueLoading(false));
    }, [selectedMissionId, selectedListId, tableSearchApi]);

    const viewMode = selectedListId ? "table" : "picker";

    useEffect(() => {
        const wasOpen = unifiedDrawerOpen;
        if (wasOpen && !unifiedDrawerOpen && viewMode === "table") {
            const id = setTimeout(() => refreshQueue(), 80);
            return () => clearTimeout(id);
        }
    }, [unifiedDrawerOpen, viewMode, refreshQueue]);

    useEffect(() => {
        if (!unifiedDrawerMissionId || !unifiedDrawerOpen) {
            setUnifiedDrawerClientBookingUrl("");
            return;
        }
        fetch(`/api/missions/${unifiedDrawerMissionId}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.success && json.data?.client?.bookingUrl) {
                    setUnifiedDrawerClientBookingUrl(json.data.client.bookingUrl);
                } else {
                    setUnifiedDrawerClientBookingUrl("");
                }
            })
            .catch(() => setUnifiedDrawerClientBookingUrl(""));
    }, [unifiedDrawerMissionId, unifiedDrawerOpen]);

    const openDrawerForRow = (row: QueueItem) => {
        setDrawerRow(row);
        setUnifiedDrawerContactId(row.contactId || null);
        setUnifiedDrawerCompanyId(row.companyId);
        setUnifiedDrawerMissionId(selectedMissionId ?? undefined);
        setUnifiedDrawerMissionName(row.missionName);
        setUnifiedDrawerOpen(true);
    };

    const closeUnifiedDrawer = () => {
        setUnifiedDrawerOpen(false);
        setDrawerRow(null);
        setUnifiedDrawerContactId(null);
        setUnifiedDrawerCompanyId(null);
        setUnifiedDrawerMissionId(undefined);
        setUnifiedDrawerMissionName(undefined);
        setUnifiedDrawerClientBookingUrl("");
    };

    const openEmailModalFromDrawer = () => {
        if (drawerRow) {
            setEmailModalContact(drawerRow.contact ? {
                id: drawerRow.contact.id,
                firstName: drawerRow.contact.firstName,
                lastName: drawerRow.contact.lastName,
                email: drawerRow.contact.email,
                title: drawerRow.contact.title,
                company: drawerRow.company ? { id: drawerRow.company.id, name: drawerRow.company.name } : undefined,
            } : null);
            setEmailModalCompany(drawerRow.company ? {
                id: drawerRow.company.id,
                name: drawerRow.company.name,
                phone: drawerRow.company.phone ?? undefined,
            } : null);
        } else {
            setEmailModalContact(null);
            setEmailModalCompany(null);
        }
        setEmailModalMissionId(unifiedDrawerMissionId ?? null);
        setEmailModalMissionName(unifiedDrawerMissionName ?? null);
        setShowQuickEmailModal(true);
    };

    const handleQuickAction = async (row: QueueItem, result: ActionResult) => {
        if (result === "ENVOIE_MAIL") {
            setEmailModalContact(row.contact ? {
                id: row.contact.id,
                firstName: row.contact.firstName,
                lastName: row.contact.lastName,
                email: row.contact.email,
                title: row.contact.title,
                company: { id: row.company.id, name: row.company.name }
            } : null);
            setEmailModalCompany(row.contact ? null : { id: row.company.id, name: row.company.name, phone: row.company.phone });
            setEmailModalMissionId(selectedMissionId);
            setEmailModalMissionName(row.missionName);
            setPendingEmailAction({ row, result });
            setShowQuickEmailModal(true);
            return;
        }

        const key = queueRowKey(row);
        setSubmittingRowKey(key);
        const noteRequired = getRequiresNote(result);
        const note = noteRequired
            ? (result === "CALLBACK_REQUESTED" ? "Rappel demandé" : statusLabels[result] ?? "Note")
            : undefined;
        try {
            const res = await fetch("/api/actions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactId: row.contactId ?? undefined,
                    companyId: row.contactId ? undefined : row.companyId,
                    campaignId: row.campaignId,
                    channel: row.channel,
                    result,
                    note: note ?? undefined,
                    callbackDate: result === "CALLBACK_REQUESTED" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined,
                }),
            });
            const json = await res.json();
            if (json.success) {
                setQueueItems((prev) => prev.filter((r) => queueRowKey(r) !== key));
                setActionsCompleted((c) => c + 1);
            }
        } catch {
            // ignore
        } finally {
            setSubmittingRowKey(null);
        }
    };

    const handleEmailSent = async () => {
        if (!pendingEmailAction) return;
        const { row, result } = pendingEmailAction;
        try {
            await fetch("/api/actions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactId: row.contactId ?? undefined,
                    companyId: row.contactId ? undefined : row.companyId,
                    campaignId: row.campaignId,
                    channel: "EMAIL",
                    result,
                    note: "Email envoyé via template",
                }),
            });
            const key = queueRowKey(row);
            setQueueItems((prev) => prev.filter((r) => queueRowKey(r) !== key));
            setActionsCompleted((c) => c + 1);
        } catch {
            // ignore
        }
        setPendingEmailAction(null);
        setShowQuickEmailModal(false);
        setEmailModalContact(null);
        setEmailModalCompany(null);
        setEmailModalMissionId(null);
        setEmailModalMissionName(null);
    };

    const startCalling = (missionId: string, listId: string, missionName: string, listName: string) => {
        setSelectedMissionId(missionId);
        setSelectedListId(listId);
        setSelectedMissionName(missionName);
        setSelectedListName(listName);
    };

    const backToListPicker = () => {
        setSelectedListId(null);
        setSelectedMissionId(null);
        setSelectedMissionName("");
        setSelectedListName("");
        setQueueItems([]);
    };

    // ========== PICKER VIEW ==========
    if (!selectedListId) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Prospection</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Choisissez une mission et une liste pour démarrer les appels
                    </p>
                </div>

                {missionsLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                ) : missions.length === 0 ? (
                    <Card className="text-center py-12">
                        <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-700">Aucune mission</h3>
                        <p className="text-slate-500 mt-1">Créez des missions et des listes pour prospecter.</p>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {missions.map((mission) => {
                            const lists = mission.lists ?? [];
                            if (lists.length === 0) return null;
                            const ChannelIcon = CHANNEL_ICONS[mission.channel] ?? Phone;
                            return (
                                <Card key={mission.id} className="overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                                            <ChannelIcon className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-semibold text-slate-900">{mission.name}</h2>
                                            <p className="text-xs text-slate-500">{mission.client?.name ?? ""}</p>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {lists.map((list) => (
                                            <div
                                                key={list.id}
                                                className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                                                        <Building2 className="w-4 h-4 text-slate-500" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900">{list.name}</p>
                                                        <p className="text-xs text-slate-500">{mission.name}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => startCalling(mission.id, list.id, mission.name, list.name)}
                                                >
                                                    <Phone className="w-4 h-4" />
                                                    Démarrer l&apos;appel
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // ========== TABLE VIEW (same experience as SDR) ==========
    const queueColumns: Column<QueueItem>[] = [
        {
            key: "name",
            header: "Contact / Société",
            render: (_, row) => {
                const name = row.contact
                    ? `${row.contact.firstName || ""} ${row.contact.lastName || ""}`.trim() || row.company.name
                    : row.company.name;
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                            {row.contactId ? (
                                <User className="w-4 h-4 text-slate-500" />
                            ) : (
                                <Building2 className="w-4 h-4 text-slate-500" />
                            )}
                        </div>
                        <div>
                            <p className="font-medium text-slate-900 truncate max-w-[200px]">{name}</p>
                            {row.contact && row.company.name !== name && (
                                <p className="text-xs text-slate-500 truncate max-w-[200px]">{row.company.name}</p>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            key: "missionName",
            header: "Mission",
            render: (v) => <span className="text-sm text-slate-600">{v}</span>,
        },
        {
            key: "lastAction",
            header: "Dernière action",
            render: (_, row) =>
                row.lastAction ? (
                    <Badge className={cn("text-xs", PRIORITY_LABELS[row.priority as keyof typeof PRIORITY_LABELS]?.color ?? "bg-slate-100 text-slate-700")}>
                        {statusLabels[row.lastAction.result] ?? row.lastAction.result}
                    </Badge>
                ) : (
                    <span className="text-xs text-slate-400">—</span>
                ),
        },
        {
            key: "priority",
            header: "Priorité",
            render: (v) => (
                <Badge className={PRIORITY_LABELS[v as keyof typeof PRIORITY_LABELS]?.color ?? "bg-slate-100 text-slate-700"}>
                    {PRIORITY_LABELS[v as keyof typeof PRIORITY_LABELS]?.label ?? v}
                </Badge>
            ),
        },
        {
            key: "quickActions",
            header: "Actions rapides",
            render: (_, row) => {
                const key = queueRowKey(row);
                const submitting = submittingRowKey === key;
                return (
                    <div className="flex items-center gap-1 flex-wrap">
                        {submitting && (
                            <span className="flex items-center justify-center w-8 h-8 text-indigo-500">
                                <Loader2 className="w-4 h-4 animate-spin" />
                            </span>
                        )}
                        {resultOptions.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAction(row, opt.value);
                                }}
                                disabled={submitting}
                                title={opt.label}
                                className={cn(
                                    "w-8 h-8 rounded-lg border flex items-center justify-center transition-colors",
                                    "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600",
                                    submitting && "opacity-50 pointer-events-none"
                                )}
                            >
                                {opt.icon}
                            </button>
                        ))}
                    </div>
                );
            },
        },
    ];

    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-violet-500/10" />
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={backToListPicker} className="text-white/80 hover:text-white hover:bg-white/10 gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Retour
                        </Button>
                        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                            <Phone className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Prospection</h1>
                            <p className="text-sm text-white/60">{selectedListName} · {selectedMissionName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm font-semibold text-white">{actionsCompleted}</span>
                                <span className="text-xs text-white/60">actions</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Filter className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">Filtres</h3>
                                <p className="text-xs text-slate-500">Affinez la file</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {hasTableFiltersActive && (
                                <Button variant="ghost" size="sm" onClick={clearTableFilters} className="text-slate-500 hover:text-red-600 hover:bg-red-50 gap-1.5">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Réinitialiser
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rechercher</label>
                            <input
                                type="text"
                                value={tableSearchInput}
                                onChange={(e) => setTableSearchInput(e.target.value)}
                                placeholder="Nom contact ou société…"
                                className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</label>
                            <select
                                value={tableFilterResult}
                                onChange={(e) => setTableFilterResult(e.target.value)}
                                className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                            >
                                <option value="">Tous</option>
                                <option value="NONE">Jamais contacté</option>
                                {Object.entries(statusLabels).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Priorité</label>
                            <select
                                value={tableFilterPriority}
                                onChange={(e) => setTableFilterPriority(e.target.value)}
                                className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                            >
                                <option value="">Toutes</option>
                                {Object.entries(PRIORITY_LABELS).map(([value, { label }]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Canal</label>
                            <select
                                value={tableFilterChannel}
                                onChange={(e) => setTableFilterChannel(e.target.value)}
                                className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                            >
                                <option value="">Tous</option>
                                {(Object.entries(CHANNEL_LABELS) as [Channel, string][]).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Type</label>
                            <select
                                value={tableFilterType}
                                onChange={(e) => setTableFilterType(e.target.value)}
                                className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                            >
                                <option value="">Contact + Société</option>
                                <option value="contact">Contact uniquement</option>
                                <option value="company">Société uniquement</option>
                            </select>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                            {hasTableFiltersActive ? (
                                <span><span className="font-medium text-indigo-600">{filteredQueueItems.length}</span> résultat(s) sur {queueItems.length}</span>
                            ) : (
                                <span><span className="font-medium text-slate-700">{queueItems.length}</span> dans la file</span>
                            )}
                        </span>
                        <Button variant="ghost" size="sm" onClick={refreshQueue} className="text-slate-500 hover:text-indigo-600 gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5" />
                            Actualiser
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <DataTable
                    data={filteredQueueItems}
                    columns={queueColumns}
                    keyField={(row) => queueRowKey(row)}
                    searchable
                    searchPlaceholder="Rechercher contact ou société..."
                    searchFields={["_displayName", "_companyName", "missionName"]}
                    pagination
                    pageSize={15}
                    loading={queueLoading}
                    emptyMessage="Aucun contact dans cette liste."
                    onRowClick={openDrawerForRow}
                    getRowClassName={(row) =>
                        recentlyUpdatedRowKeys.has(queueRowKey(row))
                            ? "bg-emerald-50/80 border-l-4 border-l-emerald-500"
                            : ""
                    }
                />
            </div>

            {unifiedDrawerCompanyId && (
                <UnifiedActionDrawer
                    isOpen={unifiedDrawerOpen}
                    onClose={closeUnifiedDrawer}
                    contactId={unifiedDrawerContactId}
                    companyId={unifiedDrawerCompanyId}
                    missionId={unifiedDrawerMissionId}
                    missionName={unifiedDrawerMissionName}
                    clientBookingUrl={unifiedDrawerClientBookingUrl || undefined}
                    onOpenEmailModal={openEmailModalFromDrawer}
                    onActionRecorded={() => {
                        const rowKey = unifiedDrawerContactId ?? unifiedDrawerCompanyId ?? "";
                        if (rowKey) {
                            setRecentlyUpdatedRowKeys((prev) => new Set([...prev, rowKey]));
                            if (recentlyUpdatedTimeoutRef.current) clearTimeout(recentlyUpdatedTimeoutRef.current);
                            recentlyUpdatedTimeoutRef.current = setTimeout(() => {
                                setRecentlyUpdatedRowKeys((prev) => {
                                    const next = new Set(prev);
                                    next.delete(rowKey);
                                    return next;
                                });
                                recentlyUpdatedTimeoutRef.current = null;
                            }, 5000);
                        }
                        refreshQueue();
                    }}
                    onValidateAndNext={() => {
                        if (!drawerRow) return;
                        const key = queueRowKey(drawerRow);
                        const idx = filteredQueueItems.findIndex((row) => queueRowKey(row) === key);
                        if (idx >= 0 && idx < filteredQueueItems.length - 1) {
                            const nextRow = filteredQueueItems[idx + 1];
                            openDrawerForRow(nextRow);
                        }
                        const rowKey = unifiedDrawerContactId ?? unifiedDrawerCompanyId ?? "";
                        if (rowKey) {
                            setRecentlyUpdatedRowKeys((prev) => new Set([...prev, rowKey]));
                            if (recentlyUpdatedTimeoutRef.current) clearTimeout(recentlyUpdatedTimeoutRef.current);
                            recentlyUpdatedTimeoutRef.current = setTimeout(() => {
                                setRecentlyUpdatedRowKeys((prev) => {
                                    const next = new Set(prev);
                                    next.delete(rowKey);
                                    return next;
                                });
                                recentlyUpdatedTimeoutRef.current = null;
                            }, 5000);
                        }
                        refreshQueue();
                    }}
                />
            )}

            <QuickEmailModal
                isOpen={showQuickEmailModal}
                onClose={() => {
                    setShowQuickEmailModal(false);
                    setPendingEmailAction(null);
                    setEmailModalContact(null);
                    setEmailModalCompany(null);
                    setEmailModalMissionId(null);
                    setEmailModalMissionName(null);
                }}
                onSent={handleEmailSent}
                contact={emailModalContact}
                company={emailModalCompany}
                missionId={emailModalMissionId}
                missionName={emailModalMissionName}
            />

        </div>
    );
}
