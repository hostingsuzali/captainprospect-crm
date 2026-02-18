"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
    Phone,
    Mail,
    Linkedin,
    Building2,
    User,
    Globe,
    Clock,
    Calendar,
    Sparkles,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Ban,
    Loader2,
    ExternalLink,
    RefreshCw,
    AlertCircle,
    Filter,
    RotateCcw,
    MessageSquare,
    SkipForward,
    History,
    PhoneCall,
    Eye,
    Copy,
    ArrowDownUp,
    PhoneOff,
    MailOpen,
    PenLine,
    BarChart2,
} from "lucide-react";
import { Card, Badge, Button, LoadingState, EmptyState, Tabs, Drawer, DataTable, Select, useToast, TableSkeleton, CardSkeleton, Modal } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { CompanyDrawer, ContactDrawer } from "@/components/drawers";
import { UnifiedActionDrawer } from "@/components/drawers/UnifiedActionDrawer";
import { BookingModal } from "@/components/sdr/BookingModal";
import { QuickEmailModal } from "@/components/email/QuickEmailModal";
import type { ActionResult, Channel } from "@/lib/types";
import { ACTION_RESULT_LABELS, CHANNEL_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface NextActionData {
    hasNext: boolean;
    message?: string;
    priority?: "CALLBACK" | "FOLLOW_UP" | "NEW" | "RETRY";
    missionName?: string;
    contact?: {
        id: string;
        firstName?: string;
        lastName?: string;
        title?: string;
        email?: string;
        phone?: string;
        linkedin?: string;
        status: string;
    } | null;
    company?: {
        id: string;
        name: string;
        industry?: string;
        website?: string;
        country?: string;
        phone?: string | null;
    };
    campaignId?: string;
    channel?: Channel;
    script?: string;
    clientBookingUrl?: string;
    lastAction?: {
        result: string;
        note?: string;
        createdAt: string;
    };
}

interface Mission {
    id: string;
    name: string;
    channel: string;
    client: { name: string };
}

interface ListItem {
    id: string;
    name: string;
    mission: { id: string; name: string };
    contactsCount: number;
}

interface QueueItem {
    contactId: string | null;
    companyId: string;
    contact: NextActionData["contact"] | null;
    company: NonNullable<NextActionData["company"]>;
    campaignId: string;
    channel: string;
    missionName: string;
    lastAction: NextActionData["lastAction"] | null;
    priority: string;
    _displayName?: string;
    _companyName?: string;
    _phone?: string | null;
    _email?: string | null;
    _searchNote?: string | null;
}

interface DrawerContact {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    additionalPhones?: string[] | null;
    additionalEmails?: string[] | null;
    title: string | null;
    linkedin: string | null;
    status: "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";
    companyId: string;
    companyName?: string;
    companyPhone?: string | null;
}

interface DrawerCompany {
    id: string;
    name: string;
    industry: string | null;
    country: string | null;
    website: string | null;
    size: string | null;
    phone: string | null;
    status: "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";
    contacts: Array<{
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        phone: string | null;
        title: string | null;
        linkedin: string | null;
        status: string;
        companyId: string;
    }>;
    _count: { contacts: number };
}

// Fallback when config API not available
const RESULT_OPTIONS_FALLBACK: { value: ActionResult; label: string; icon: React.ReactNode; key: string; color: string }[] = [
    { value: "NO_RESPONSE", label: "Pas de réponse", icon: <XCircle className="w-4 h-4" />, key: "1", color: "slate" },
    { value: "BAD_CONTACT", label: "Mauvais contact", icon: <Ban className="w-4 h-4" />, key: "2", color: "red" },
    { value: "INTERESTED", label: "Intéressé", icon: <Sparkles className="w-4 h-4" />, key: "3", color: "emerald" },
    { value: "CALLBACK_REQUESTED", label: "Rappel demandé", icon: <Clock className="w-4 h-4" />, key: "4", color: "amber" },
    { value: "MEETING_BOOKED", label: "RDV pris", icon: <Calendar className="w-4 h-4" />, key: "5", color: "indigo" },
    { value: "DISQUALIFIED", label: "Disqualifié", icon: <XCircle className="w-4 h-4" />, key: "6", color: "slate" },
    { value: "ENVOIE_MAIL", label: "Envoie mail", icon: <Mail className="w-4 h-4" />, key: "7", color: "blue" },
];

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

const SCRIPT_TABS = [
    { id: "intro", label: "Intro" },
    { id: "discovery", label: "Découverte" },
    { id: "objection", label: "Objections" },
    { id: "closing", label: "Closing" },
];

// Stats modal body: summary + list of contacts with status (for Actions page)
function ActionStatsModalBody({
    items,
    loading,
    statusLabels,
    onRowClick,
    priorityLabels,
    resultIconMap,
    queueRowKey,
}: {
    items: QueueItem[];
    loading: boolean;
    statusLabels: Record<string, string>;
    onRowClick: (row: QueueItem) => void;
    priorityLabels: Record<string, { label: string; color: string }>;
    resultIconMap: Record<string, React.ReactNode>;
    queueRowKey: (row: QueueItem) => string;
}) {
    const byStatus = useMemo(() => {
        const map: Record<string, number> = {};
        items.forEach((row) => {
            const key = row.lastAction?.result ?? "NONE";
            map[key] = (map[key] ?? 0) + 1;
        });
        return map;
    }, [items]);
    const byPriority = useMemo(() => {
        const map: Record<string, number> = {};
        items.forEach((row) => {
            const key = row.priority ?? "";
            map[key] = (map[key] ?? 0) + 1;
        });
        return map;
    }, [items]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total</p>
                    <p className="text-xl font-bold text-slate-900">{items.length}</p>
                </div>
                {Object.entries(priorityLabels).map(([key, { label, color }]) => (
                    <div key={key} className={cn("rounded-xl border p-3", color)}>
                        <p className="text-xs font-medium uppercase tracking-wider opacity-90">{label}</p>
                        <p className="text-xl font-bold">{byPriority[key] ?? 0}</p>
                    </div>
                ))}
            </div>
            <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Par statut</h4>
                <div className="flex flex-wrap gap-2">
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200">Jamais contacté: {byStatus["NONE"] ?? 0}</Badge>
                    {Object.entries(statusLabels).map(([key, label]) => (
                        <Badge key={key} className="bg-slate-100 text-slate-700 border-slate-200">{label}: {byStatus[key] ?? 0}</Badge>
                    ))}
                </div>
            </div>
            <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Tous les contacts</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
                    {items.length === 0 ? (
                        <p className="text-center py-8 text-slate-500 text-sm">Aucun contact dans cette vue.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                <tr>
                                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Contact / Société</th>
                                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Statut</th>
                                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Priorité</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((row) => {
                                    const name = row._displayName ?? (row.contact ? `${row.contact.firstName ?? ""} ${row.contact.lastName ?? ""}`.trim() || row.company.name : row.company.name);
                                    const status = row.lastAction ? (statusLabels[row.lastAction.result] ?? row.lastAction.result) : "Jamais contacté";
                                    const pri = priorityLabels[row.priority];
                                    return (
                                        <tr
                                            key={queueRowKey(row)}
                                            onClick={() => onRowClick(row)}
                                            className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/80 cursor-pointer transition-colors"
                                        >
                                            <td className="py-2.5 px-3">
                                                <span className="font-medium text-slate-900">{name}</span>
                                                {row._companyName && row._companyName !== name && (
                                                    <span className="text-slate-500 text-xs block">{row._companyName}</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                {row.lastAction ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        {resultIconMap[row.lastAction.result]}
                                                        {status}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Jamais contacté</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                {pri ? <Badge className={cn("text-xs", pri.color)}>{pri.label}</Badge> : row.priority}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SDRActionPage() {
    const { data: session } = useSession();
    const { error: showError } = useToast();
    const [currentAction, setCurrentAction] = useState<NextActionData | null>(null);
    const [selectedResult, setSelectedResult] = useState<ActionResult | null>(null);
    const [note, setNote] = useState("");
    /** For CALLBACK_REQUESTED: date/time from calendar (YYYY-MM-DDTHH:mm for datetime-local). */
    const [callbackDateValue, setCallbackDateValue] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [actionsCompleted, setActionsCompleted] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const nextActionAbortRef = useRef<AbortController | null>(null);
    const queueAbortRef = useRef<AbortController | null>(null);
    const refreshQueueAbortRef = useRef<AbortController | null>(null);

    const [missions, setMissions] = useState<Mission[]>([]);
    const [lists, setLists] = useState<ListItem[]>([]);
    const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
    const [selectedListId, setSelectedListIdState] = useState<string | null>(null);
    const setSelectedListId = useCallback((value: string | null | ((prev: string | null) => string | null)) => {
        setSelectedListIdState((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            if (typeof window !== "undefined") {
                if (next) localStorage.setItem("sdr_selected_list", next);
                else localStorage.removeItem("sdr_selected_list");
            }
            return next;
        });
    }, []);
    const [viewType, setViewTypeState] = useState<"all" | "companies" | "contacts">(() =>
        (typeof window !== "undefined" && (localStorage.getItem("sdr_view_type") as "all" | "companies" | "contacts") in { all: 1, companies: 1, contacts: 1 })
            ? (localStorage.getItem("sdr_view_type") as "all" | "companies" | "contacts")
            : "all"
    );
    const setViewType = useCallback((value: "all" | "companies" | "contacts" | ((prev: "all" | "companies" | "contacts") => "all" | "companies" | "contacts")) => {
        setViewTypeState((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            if (typeof window !== "undefined") localStorage.setItem("sdr_view_type", next);
            return next;
        });
    }, []);
    const [activeTab, setActiveTab] = useState<string>("intro");
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [isImprovingNote, setIsImprovingNote] = useState(false);

    // View mode: card vs table — persisted in localStorage
    const [viewMode, setViewModeState] = useState<"card" | "table">(() =>
        (typeof window !== "undefined" && localStorage.getItem("sdr_view_mode") === "card") ? "card" : "table"
    );
    const setViewMode = useCallback((value: "card" | "table" | ((prev: "card" | "table") => "card" | "table")) => {
        setViewModeState((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            if (typeof window !== "undefined") localStorage.setItem("sdr_view_mode", next);
            return next;
        });
    }, []);
    const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
    const [queueLoading, setQueueLoading] = useState(false);
    const [queueFetchError, setQueueFetchError] = useState<string | null>(null);
    const [submittingRowKey, setSubmittingRowKey] = useState<string | null>(null);
    // Table view filters (client-side on current queue)
    const [tableFilterResult, setTableFilterResult] = useState<string>(""); // "" | ActionResult | "NONE" (no last action)
    const [tableFilterPriority, setTableFilterPriority] = useState<string>("");
    const [tableFilterChannel, setTableFilterChannel] = useState<string>("");
    const [tableFilterType, setTableFilterType] = useState<string>(""); // "" | "contact" | "company"
    // Mission search: server-side search so contacts can be filtered by name
    const [tableSearchInput, setTableSearchInput] = useState("");
    const [tableSearchApi, setTableSearchApi] = useState("");

    // Stats modal (table + card view): view stats and list of contacts with status
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [statsQueueItems, setStatsQueueItems] = useState<QueueItem[]>([]);
    const [statsLoading, setStatsLoading] = useState(false);

    // Drawer for table view (contact/company fiche)
    const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
    const [drawerCompanyId, setDrawerCompanyId] = useState<string | null>(null);
    const [drawerContact, setDrawerContact] = useState<DrawerContact | null>(null);
    const [drawerCompany, setDrawerCompany] = useState<DrawerCompany | null>(null);
    const [drawerLoading, setDrawerLoading] = useState(false);

    // Quick Email Modal state
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
    const [pendingEmailAction, setPendingEmailAction] = useState<{ row: QueueItem; result: ActionResult } | { cardMode: true; result: ActionResult } | null>(null);

    // Config-driven status options (from API)
    const [statusConfig, setStatusConfig] = useState<{ statuses: Array<{ code: string; label: string; requiresNote: boolean }> } | null>(null);

    // Load filters
    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;
        const loadFilters = async () => {
            try {
                const [missionsRes, listsRes] = await Promise.all([
                    fetch("/api/sdr/missions", { signal }),
                    fetch("/api/sdr/lists", { signal }),
                ]);
                if (signal.aborted) return;
                const missionsJson = await missionsRes.json();
                const listsJson = await listsRes.json();
                if (signal.aborted) return;

                if (missionsJson.success) {
                    setMissions(missionsJson.data);
                    const saved = localStorage.getItem("sdr_selected_mission");
                    const missionId = (saved && missionsJson.data.some((m: Mission) => m.id === saved))
                        ? saved
                        : missionsJson.data.length > 0
                            ? missionsJson.data[0].id
                            : null;
                    if (missionId) setSelectedMissionId(missionId);
                    // Restore selected list if it belongs to the selected mission
                    if (listsJson.success && missionId) {
                        const savedList = typeof window !== "undefined" ? localStorage.getItem("sdr_selected_list") : null;
                        if (savedList && listsJson.data.some((l: ListItem) => l.id === savedList && l.mission.id === missionId)) {
                            setSelectedListId(savedList);
                        }
                    }
                }
                if (listsJson.success) {
                    setLists(listsJson.data);
                }
            } catch (err) {
                if ((err as Error).name === "AbortError") return;
                console.error("Failed to load filters:", err);
                showError("Impossible de charger les missions et listes");
            }
        };
        loadFilters();
        return () => controller.abort();
    }, [showError]);

    // Fetch status config when mission is selected
    useEffect(() => {
        if (!selectedMissionId) {
            setStatusConfig(null);
            return;
        }
        const controller = new AbortController();
        const signal = controller.signal;
        fetch(`/api/config/action-statuses?missionId=${selectedMissionId}`, { signal })
            .then((res) => res.json())
            .then((json) => {
                if (signal.aborted) return;
                if (json.success && json.data?.statuses) {
                    setStatusConfig({ statuses: json.data.statuses });
                } else {
                    setStatusConfig(null);
                }
            })
            .catch((err) => {
                if ((err as Error).name === "AbortError") return;
                setStatusConfig(null);
                showError("Impossible de charger la configuration des statuts");
            });
        return () => controller.abort();
    }, [selectedMissionId, showError]);

    const resultOptions = statusConfig?.statuses?.length
        ? statusConfig.statuses.map((s, i) => ({
            value: s.code as ActionResult,
            label: s.label,
            icon: RESULT_ICON_MAP[s.code] ?? <XCircle className="w-4 h-4" />,
            key: String(i + 1),
            color: ["slate", "red", "emerald", "amber", "indigo", "slate", "blue"][i % 7] as string,
        }))
        : RESULT_OPTIONS_FALLBACK;

    const statusLabels: Record<string, string> = statusConfig?.statuses?.length
        ? Object.fromEntries(statusConfig.statuses.map((s) => [s.code, s.label]))
        : ACTION_RESULT_LABELS;

    const getRequiresNote = useCallback((code: string) =>
        statusConfig?.statuses?.find((s) => s.code === code)?.requiresNote ??
        ["INTERESTED", "CALLBACK_REQUESTED", "ENVOIE_MAIL"].includes(code)
    , [statusConfig]);

    const filteredLists = selectedMissionId
        ? lists.filter((l) => l.mission.id === selectedMissionId)
        : lists;

    // Table view: client-side filtered queue (by last action result, priority, channel, type)
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

    // Debounce mission search so we don't refetch on every keystroke
    useEffect(() => {
        if (!tableSearchInput.trim()) {
            setTableSearchApi("");
            return;
        }
        const t = setTimeout(() => setTableSearchApi(tableSearchInput.trim()), 400);
        return () => clearTimeout(t);
    }, [tableSearchInput]);

    // Load next action
    const loadNextAction = useCallback(async () => {
        nextActionAbortRef.current?.abort();
        const controller = new AbortController();
        nextActionAbortRef.current = controller;
        const signal = controller.signal;

        setIsLoading(true);
        setError(null);
        setSelectedResult(null);
        setNote("");
        setCallbackDateValue("");
        setShowSuccess(false);
        setElapsedTime(0);
        setActiveTab("intro");

        try {
            const params = new URLSearchParams();
            if (selectedMissionId) params.set("missionId", selectedMissionId);
            if (selectedListId) params.set("listId", selectedListId);

            const res = await fetch(`/api/actions/next?${params.toString()}`, { signal });
            const json = await res.json();
            if (signal.aborted) return;

            if (!json.success) {
                setError(json.error || "Erreur lors du chargement");
                setCurrentAction(null);
            } else {
                setCurrentAction(json.data);
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
            }
        } catch (err) {
            if ((err as Error).name === "AbortError") return;
            setError("Erreur de connexion");
            setCurrentAction(null);
        } finally {
            if (!signal.aborted) setIsLoading(false);
            if (nextActionAbortRef.current === controller) nextActionAbortRef.current = null;
        }
    }, [selectedMissionId, selectedListId]);

    useEffect(() => {
        if (selectedMissionId !== null) loadNextAction();
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [selectedMissionId, selectedListId, loadNextAction]);

    // Fetch queue for table view (loads all items — no limit)
    useEffect(() => {
        if (viewMode !== "table" || selectedMissionId === null) {
            setQueueItems([]);
            setQueueFetchError(null);
            return;
        }
        queueAbortRef.current?.abort();
        const controller = new AbortController();
        queueAbortRef.current = controller;
        const signal = controller.signal;
        setQueueLoading(true);
        setQueueFetchError(null);
        const params = new URLSearchParams();
        params.set("missionId", selectedMissionId);
        if (selectedListId) params.set("listId", selectedListId);
        if (tableSearchApi) params.set("search", tableSearchApi);
        fetch(`/api/sdr/action-queue?${params.toString()}`, { signal })
            .then((res) => res.json())
            .then((json) => {
                if (signal.aborted) return;
                if (json.success && json.data?.items) {
                    setQueueFetchError(null);
                    const items = json.data.items as QueueItem[];
                    setQueueItems(items.map((i) => ({
                        ...i,
                        _displayName: i.contact
                            ? `${(i.contact.firstName || "").trim()} ${(i.contact.lastName || "").trim()}`.trim() || i.company.name
                            : i.company.name,
                        _companyName: i.company.name,
                        _phone: i.contact?.phone || i.company?.phone || null,
                        _email: i.contact?.email || null,
                        _searchNote: i.lastAction?.note ?? null,
                    })));
                } else {
                    setQueueItems([]);
                    setQueueFetchError(null);
                }
            })
            .catch((err) => {
                if ((err as Error).name === "AbortError") return;
                setQueueItems([]);
                setQueueFetchError("Impossible de charger la file d'actions");
                showError("Impossible de charger la file d'actions");
            })
            .finally(() => {
                if (!signal.aborted) setQueueLoading(false);
                if (queueAbortRef.current === controller) queueAbortRef.current = null;
            });
        return () => controller.abort();
    }, [viewMode, selectedMissionId, selectedListId, tableSearchApi, showError]);

    // Fetch contact when opening contact drawer (table view)
    useEffect(() => {
        if (!drawerContactId) {
            setDrawerContact(null);
            return;
        }
        const controller = new AbortController();
        const signal = controller.signal;
        setDrawerLoading(true);
        fetch(`/api/contacts/${drawerContactId}`, { signal })
            .then((res) => res.json())
            .then((json) => {
                if (signal.aborted) return;
                if (json.success && json.data) {
                    const c = json.data;
                    setDrawerContact({
                        id: c.id,
                        firstName: c.firstName,
                        lastName: c.lastName,
                        email: c.email,
                        phone: c.phone,
                        additionalPhones: c.additionalPhones ?? undefined,
                        additionalEmails: c.additionalEmails ?? undefined,
                        title: c.title,
                        linkedin: c.linkedin,
                        status: c.status ?? "PARTIAL",
                        companyId: c.company?.id ?? "",
                        companyName: c.company?.name ?? undefined,
                        companyPhone: c.company?.phone ?? undefined,
                    });
                } else {
                    setDrawerContact(null);
                }
            })
            .catch((err) => {
                if ((err as Error).name === "AbortError") return;
                setDrawerContact(null);
                showError("Impossible de charger le contact");
            })
            .finally(() => {
                if (!signal.aborted) setDrawerLoading(false);
            });
        return () => controller.abort();
    }, [drawerContactId, showError]);

    // Fetch company when opening company drawer (table view)
    useEffect(() => {
        if (!drawerCompanyId) {
            setDrawerCompany(null);
            return;
        }
        const controller = new AbortController();
        const signal = controller.signal;
        setDrawerLoading(true);
        fetch(`/api/companies/${drawerCompanyId}`, { signal })
            .then((res) => res.json())
            .then((json) => {
                if (signal.aborted) return;
                if (json.success && json.data) {
                    const co = json.data;
                    setDrawerCompany({
                        id: co.id,
                        name: co.name,
                        industry: co.industry,
                        country: co.country,
                        website: co.website,
                        size: co.size,
                        phone: co.phone,
                        status: co.status ?? "PARTIAL",
                        contacts: (co.contacts ?? []).map((ct: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; title: string | null; linkedin: string | null; status: string; companyId: string }) => ({
                            id: ct.id,
                            firstName: ct.firstName,
                            lastName: ct.lastName,
                            email: ct.email,
                            phone: ct.phone,
                            title: ct.title,
                            linkedin: ct.linkedin,
                            status: ct.status ?? "PARTIAL",
                            companyId: ct.companyId,
                        })),
                        _count: { contacts: co._count?.contacts ?? co.contacts?.length ?? 0 },
                    });
                } else {
                    setDrawerCompany(null);
                }
            })
            .catch((err) => {
                if ((err as Error).name === "AbortError") return;
                setDrawerCompany(null);
                showError("Impossible de charger la société");
            })
            .finally(() => {
                if (!signal.aborted) setDrawerLoading(false);
            });
        return () => controller.abort();
    }, [drawerCompanyId, showError]);

    const queueRowKey = (row: QueueItem) => row.contactId ?? row.companyId;

    // Recently updated row keys (highlight in table after status update in drawer)
    const [recentlyUpdatedRowKeys, setRecentlyUpdatedRowKeys] = useState<Set<string>>(new Set());
    const recentlyUpdatedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => () => {
        if (recentlyUpdatedTimeoutRef.current) clearTimeout(recentlyUpdatedTimeoutRef.current);
    }, []);

    // Refetch queue (table view) — same API as initial load; call on drawer close and when action recorded
    const refreshQueue = useCallback(() => {
        if (selectedMissionId === null) return;
        refreshQueueAbortRef.current?.abort();
        const controller = new AbortController();
        refreshQueueAbortRef.current = controller;
        const signal = controller.signal;
        setQueueLoading(true);
        const params = new URLSearchParams();
        params.set("missionId", selectedMissionId);
        if (selectedListId) params.set("listId", selectedListId);
        if (tableSearchApi) params.set("search", tableSearchApi);
        params.set("_t", String(Date.now())); // cache-bust so we get fresh data after drawer updates
        fetch(`/api/sdr/action-queue?${params.toString()}`, { cache: "no-store", signal })
            .then((res) => res.json())
            .then((json) => {
                if (signal.aborted) return;
                if (json.success && json.data?.items) {
                    const items = json.data.items as QueueItem[];
                    setQueueItems(items.map((i) => ({
                        ...i,
                        _displayName: i.contact
                            ? `${(i.contact.firstName || "").trim()} ${(i.contact.lastName || "").trim()}`.trim() || i.company.name
                            : i.company.name,
                        _companyName: i.company.name,
                        _phone: i.contact?.phone || i.company?.phone || null,
                        _email: i.contact?.email || null,
                        _searchNote: i.lastAction?.note ?? null,
                    })));
                }
            })
            .finally(() => {
                if (!signal.aborted) setQueueLoading(false);
                if (refreshQueueAbortRef.current === controller) refreshQueueAbortRef.current = null;
            });
    }, [selectedMissionId, selectedListId, tableSearchApi]);

    // When opening Stats modal in card view, fetch queue for current mission/list
    useEffect(() => {
        if (!showStatsModal || viewMode !== "card" || !selectedMissionId) return;
        setStatsLoading(true);
        const params = new URLSearchParams();
        params.set("missionId", selectedMissionId);
        if (selectedListId) params.set("listId", selectedListId);
        fetch(`/api/sdr/action-queue?${params.toString()}`, { cache: "no-store" })
            .then((res) => res.json())
            .then((json) => {
                if (json.success && json.data?.items) {
                    const items = json.data.items as QueueItem[];
                    setStatsQueueItems(items.map((i) => ({
                        ...i,
                        _displayName: i.contact
                            ? `${(i.contact.firstName || "").trim()} ${(i.contact.lastName || "").trim()}`.trim() || i.company.name
                            : i.company.name,
                        _companyName: i.company.name,
                        _phone: i.contact?.phone || i.company?.phone || null,
                        _email: i.contact?.email || null,
                        _searchNote: i.lastAction?.note ?? null,
                    })));
                } else {
                    setStatsQueueItems([]);
                }
            })
            .catch(() => setStatsQueueItems([]))
            .finally(() => setStatsLoading(false));
    }, [showStatsModal, viewMode, selectedMissionId, selectedListId]);

    // Unified drawer state (table view)
    const [unifiedDrawerOpen, setUnifiedDrawerOpen] = useState(false);
    const [unifiedDrawerContactId, setUnifiedDrawerContactId] = useState<string | null>(null);
    const [unifiedDrawerCompanyId, setUnifiedDrawerCompanyId] = useState<string | null>(null);
    const [unifiedDrawerMissionId, setUnifiedDrawerMissionId] = useState<string | undefined>();
    const [unifiedDrawerMissionName, setUnifiedDrawerMissionName] = useState<string | undefined>();
    const [unifiedDrawerClientBookingUrl, setUnifiedDrawerClientBookingUrl] = useState<string>("");
    /** Row used to open the drawer (for email modal context when "Envoie mail" is selected in drawer) */
    const [drawerRow, setDrawerRow] = useState<QueueItem | null>(null);
    const prevUnifiedDrawerOpenRef = useRef(false);

    // When drawer closes, refresh queue so table shows updated/removed contacts (runs after state commit)
    useEffect(() => {
        const wasOpen = prevUnifiedDrawerOpenRef.current;
        prevUnifiedDrawerOpenRef.current = unifiedDrawerOpen;
        if (wasOpen && !unifiedDrawerOpen && viewMode === "table") {
            const id = setTimeout(() => refreshQueue(), 80);
            return () => clearTimeout(id);
        }
    }, [unifiedDrawerOpen, viewMode, refreshQueue]);

    // Fetch client booking URL when drawer opens (for MEETING_BOOKED calendar in drawer)
    useEffect(() => {
        if (!unifiedDrawerMissionId || !unifiedDrawerOpen) {
            setUnifiedDrawerClientBookingUrl("");
            return;
        }
        const controller = new AbortController();
        const signal = controller.signal;
        fetch(`/api/missions/${unifiedDrawerMissionId}`, { signal })
            .then((res) => res.json())
            .then((json) => {
                if (signal.aborted) return;
                if (json.success && json.data?.client?.bookingUrl) {
                    setUnifiedDrawerClientBookingUrl(json.data.client.bookingUrl);
                } else {
                    setUnifiedDrawerClientBookingUrl("");
                }
            })
            .catch((err) => {
                if ((err as Error).name === "AbortError") return;
                setUnifiedDrawerClientBookingUrl("");
                showError("Impossible de charger l'URL de réservation");
            });
        return () => controller.abort();
    }, [unifiedDrawerMissionId, unifiedDrawerOpen, showError]);

    const openDrawerForRow = (row: QueueItem) => {
        setDrawerRow(row);
        setUnifiedDrawerContactId(row.contactId || null);
        setUnifiedDrawerCompanyId(row.companyId);

        // Find mission ID from row
        const mission = missions.find(m => m.name === row.missionName);
        setUnifiedDrawerMissionId(mission?.id);
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

    // Keep legacy close functions for backwards compatibility
    const closeContactDrawer = () => {
        setDrawerContactId(null);
        setDrawerContact(null);
    };
    const closeCompanyDrawer = () => {
        setDrawerCompanyId(null);
        setDrawerCompany(null);
    };
    const handleContactFromCompany = (contact: { id: string }) => {
        setDrawerCompanyId(null);
        setDrawerCompany(null);
        setDrawerContactId(contact.id);
    };

    const handleQuickAction = async (row: QueueItem, result: ActionResult) => {
        // For ENVOIE_MAIL, open the QuickEmailModal instead of submitting directly
        if (result === "ENVOIE_MAIL") {
            const mission = missions.find(m => m.name === row.missionName);
            setEmailModalContact(row.contact ? {
                id: row.contact.id,
                firstName: row.contact.firstName,
                lastName: row.contact.lastName,
                email: row.contact.email,
                title: row.contact.title,
                company: { id: row.company.id, name: row.company.name }
            } : null);
            setEmailModalCompany(row.contact ? null : { id: row.company.id, name: row.company.name, phone: row.company.phone });
            setEmailModalMissionId(mission?.id || selectedMissionId);
            setEmailModalMissionName(mission?.name || row.missionName);
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
            } else {
                showError(json.error || "Erreur lors de l'enregistrement");
            }
        } catch {
            showError("Erreur de connexion");
        } finally {
            setSubmittingRowKey(null);
        }
    };

    // Handle email sent from QuickEmailModal
    const handleEmailSent = async () => {
        if (!pendingEmailAction) return;
        const { result } = pendingEmailAction;

        const isCardMode = "cardMode" in pendingEmailAction && pendingEmailAction.cardMode;

        try {
            if (isCardMode && currentAction) {
                const res = await fetch("/api/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contactId: currentAction.contact?.id,
                        companyId: !currentAction.contact && currentAction.company ? currentAction.company.id : undefined,
                        campaignId: currentAction.campaignId,
                        channel: "EMAIL",
                        result,
                        note: "Email envoyé via template",
                    }),
                });
                const json = await res.json();
                if (!json.success) {
                    showError(json.error || "Erreur lors de l'enregistrement de l'email");
                    return;
                }
                setActionsCompleted((c) => c + 1);
                await loadNextAction();
            } else if (!isCardMode && "row" in pendingEmailAction) {
                const { row } = pendingEmailAction;
                const key = queueRowKey(row);
                const res = await fetch("/api/actions", {
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
                const json = await res.json();
                if (!json.success) {
                    showError(json.error || "Erreur lors de l'enregistrement de l'email");
                    return;
                }
                setQueueItems((prev) => prev.filter((r) => queueRowKey(r) !== key));
                setActionsCompleted((c) => c + 1);
            }
        } catch {
            showError("Erreur de connexion");
        }

        setPendingEmailAction(null);
        setEmailModalContact(null);
        setEmailModalCompany(null);
        setEmailModalMissionId(null);
        setEmailModalMissionName(null);
    };

    // Submit (wrapped in useCallback so keyboard shortcut always has latest)
    const handleSubmit = useCallback(async () => {
        if (!selectedResult || !currentAction?.campaignId) return;
        if (!currentAction.contact && !currentAction.company) {
            setError("Aucun contact ou entreprise disponible");
            return;
        }
        if (getRequiresNote(selectedResult) && !note.trim()) {
            setError("Note requise pour ce résultat");
            return;
        }

        // For ENVOIE_MAIL, open QuickEmailModal instead of submitting
        if (selectedResult === "ENVOIE_MAIL") {
            const contact = currentAction.contact;
            setEmailModalContact(contact ? {
                id: contact.id,
                firstName: contact.firstName,
                lastName: contact.lastName,
                email: contact.email,
                title: contact.title,
                company: currentAction.company ? { id: currentAction.company.id, name: currentAction.company.name } : undefined,
            } : null);
            setEmailModalCompany(!contact && currentAction.company ? { id: currentAction.company.id, name: currentAction.company.name, phone: currentAction.company.phone } : null);
            setEmailModalMissionId(selectedMissionId ?? null);
            setEmailModalMissionName(currentAction.missionName ?? null);
            setPendingEmailAction({ cardMode: true, result: selectedResult });
            setShowQuickEmailModal(true);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

        try {
            const res = await fetch("/api/actions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactId: currentAction.contact?.id,
                    companyId: !currentAction.contact && currentAction.company ? currentAction.company.id : undefined,
                    campaignId: currentAction.campaignId,
                    channel: currentAction.channel,
                    result: selectedResult,
                    note: note || undefined,
                    callbackDate: selectedResult === "CALLBACK_REQUESTED" && callbackDateValue ? new Date(callbackDateValue).toISOString() : undefined,
                    duration: elapsedTime,
                }),
            });
            const json = await res.json();
            if (!json.success) {
                setError(json.error || "Erreur");
                return;
            }
            setShowSuccess(true);
            setActionsCompleted((prev) => prev + 1);
            await loadNextAction();
            setShowSuccess(false);
        } catch {
            setError("Erreur de connexion");
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedResult, currentAction, note, callbackDateValue, selectedMissionId, elapsedTime, loadNextAction, getRequiresNote]);

    // Improve note with Mistral (orthography + rephrase)
    const handleImproveNote = async () => {
        const trimmed = note.trim();
        if (!trimmed) return;
        setIsImprovingNote(true);
        setError(null);
        try {
            const res = await fetch("/api/ai/mistral/note-improve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: trimmed }),
            });
            const json = await res.json();
            if (json.success && json.data?.improvedText) {
                setNote(json.data.improvedText);
            } else {
                setError(json.error || "Impossible d'améliorer la note");
            }
        } catch {
            setError("Erreur de connexion à l'IA");
        } finally {
            setIsImprovingNote(false);
        }
    };

    // Handlers
    const handleMissionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedMissionId(id);
        localStorage.setItem("sdr_selected_mission", id);
        setSelectedListId(null);
    };

    const handleListChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedListId(id === "all" ? null : id);
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLTextAreaElement) return;
            if (e.key >= "1" && e.key <= "9") {
                const idx = parseInt(e.key, 10) - 1;
                if (resultOptions[idx]) setSelectedResult(resultOptions[idx].value);
            }
            if (e.key === "Enter" && selectedResult && !isSubmitting) {
                e.preventDefault();
                handleSubmit();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [selectedResult, isSubmitting, resultOptions, handleSubmit]);

    // Parse script
    let scriptSections: Record<string, string> | null = null;
    if (currentAction?.script) {
        try {
            const parsed = JSON.parse(currentAction.script);
            if (typeof parsed === "object") scriptSections = parsed;
        } catch { }
    }

    // Filter script tabs based on available content
    const availableScriptTabs = scriptSections
        ? SCRIPT_TABS.filter(tab => scriptSections && scriptSections[tab.id])
        : [];

    // ========== TABLE VIEW ==========
    if (viewMode === "table") {
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
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-colors",
                                row.contactId
                                    ? "bg-indigo-50 border-indigo-100 text-indigo-600"
                                    : "bg-slate-50 border-slate-200 text-slate-500"
                            )}>
                                {row.contactId ? (
                                    <User className="w-4.5 h-4.5" />
                                ) : (
                                    <Building2 className="w-4.5 h-4.5" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate max-w-[220px]">{name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {row.contact && row.company.name !== name && (
                                        <span className="text-xs text-slate-500 truncate max-w-[140px] flex items-center gap-1">
                                            <Building2 className="w-3 h-3 flex-shrink-0" />
                                            {row.company.name}
                                        </span>
                                    )}
                                    {row.contact?.title && (
                                        <span className="text-xs text-slate-400 truncate max-w-[120px]">
                                            · {row.contact.title}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                },
            },
            {
                key: "_phone",
                header: "Téléphone",
                render: (_, row) => {
                    const phone = row._phone || row.contact?.phone || row.company?.phone;
                    if (!phone) return (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400 px-2 py-1 rounded-md bg-slate-50 border border-slate-100">
                            <PhoneOff className="w-3 h-3" /> Aucun
                        </span>
                    );
                    return (
                        <a
                            href={`tel:${phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-lg transition-all duration-150 hover:shadow-sm group"
                            title="Cliquer pour appeler"
                        >
                            <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-mono tracking-tight">{phone}</span>
                        </a>
                    );
                },
            },
            {
                key: "channel",
                header: "Canal",
                render: (v) => {
                    const channelConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
                        CALL: { icon: <Phone className="w-3.5 h-3.5" />, color: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "Appel" },
                        EMAIL: { icon: <MailOpen className="w-3.5 h-3.5" />, color: "bg-blue-50 text-blue-700 border-blue-200", label: "Email" },
                        LINKEDIN: { icon: <Linkedin className="w-3.5 h-3.5" />, color: "bg-sky-50 text-sky-700 border-sky-200", label: "LinkedIn" },
                    };
                    const cfg = channelConfig[v as string] || { icon: <Globe className="w-3.5 h-3.5" />, color: "bg-slate-50 text-slate-600 border-slate-200", label: v };
                    return (
                        <Badge className={cn("text-xs gap-1 font-medium border", cfg.color)}>
                            {cfg.icon}
                            {cfg.label}
                        </Badge>
                    );
                },
            },
            {
                key: "lastAction",
                header: "Dernière action",
                render: (_, row) => {
                    if (!row.lastAction) {
                        return (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 italic px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                Jamais contacté
                            </span>
                        );
                    }
                    const resultColor: Record<string, { badge: string; dot: string }> = {
                        NO_RESPONSE: { badge: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
                        BAD_CONTACT: { badge: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-400" },
                        INTERESTED: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
                        CALLBACK_REQUESTED: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
                        MEETING_BOOKED: { badge: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-400" },
                        DISQUALIFIED: { badge: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
                        ENVOIE_MAIL: { badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-400" },
                    };
                    const color = resultColor[row.lastAction.result] || { badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };
                    return (
                        <div className="space-y-1.5">
                            <Badge className={cn("text-xs border font-medium", color.badge)}>
                                {RESULT_ICON_MAP[row.lastAction.result]}
                                <span className="ml-1">{statusLabels[row.lastAction.result] ?? row.lastAction.result}</span>
                            </Badge>
                            {row.lastAction.note && (
                                <div className="flex items-start gap-1.5 max-w-[220px]" title={row.lastAction.note}>
                                    <MessageSquare className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                        {row.lastAction.note}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                },
            },
            {
                key: "priority",
                header: "Priorité",
                render: (v) => (
                    <Badge className={cn("text-xs font-medium border", PRIORITY_LABELS[v as keyof typeof PRIORITY_LABELS]?.color ?? "bg-slate-100 text-slate-700 border-slate-200")}>
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
                    // Show only the most common 4 actions inline, rest via drawer  
                    const primaryActions = resultOptions.slice(0, 5);
                    return (
                        <div className="flex items-center gap-1">
                            {submitting && (
                                <span className="flex items-center justify-center w-8 h-8 text-indigo-500">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                </span>
                            )}
                            {primaryActions.map((opt) => {
                                const actionColors: Record<string, string> = {
                                    NO_RESPONSE: "hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700 hover:shadow-sm",
                                    BAD_CONTACT: "hover:border-red-300 hover:bg-red-50 hover:text-red-600 hover:shadow-sm hover:shadow-red-100",
                                    INTERESTED: "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 hover:shadow-sm hover:shadow-emerald-100",
                                    CALLBACK_REQUESTED: "hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 hover:shadow-sm hover:shadow-amber-100",
                                    MEETING_BOOKED: "hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 hover:shadow-sm hover:shadow-indigo-100",
                                    DISQUALIFIED: "hover:border-slate-400 hover:bg-slate-100 hover:text-slate-600 hover:shadow-sm",
                                    ENVOIE_MAIL: "hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm hover:shadow-blue-100",
                                };
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleQuickAction(row, opt.value);
                                        }}
                                        disabled={submitting}
                                        title={`${opt.label} (${opt.key})`}
                                        className={cn(
                                            "w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-150",
                                            "border-slate-200 text-slate-400 bg-white",
                                            actionColors[opt.value] || "hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600",
                                            submitting && "opacity-40 pointer-events-none",
                                            "active:scale-95"
                                        )}
                                    >
                                        {opt.icon}
                                    </button>
                                );
                            })}
                            {/* Open drawer for full control */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openDrawerForRow(row);
                                }}
                                title="Voir la fiche complète"
                                className="w-8 h-8 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-150 active:scale-95"
                            >
                                <Eye className="w-4 h-4" />
                            </button>
                        </div>
                    );
                },
            },
        ];

        return (
            <div className="space-y-6">
                {/* Modern Header with View Toggle & Stats */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 shadow-xl">
                    {/* Background decoration */}
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-violet-500/10" />
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />

                    <div className="relative">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* Left: Title & View Toggle */}
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                    <Phone className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">Actions</h1>
                                    <p className="text-sm text-white/60">Gérez vos actions commerciales</p>
                                </div>
                            </div>

                            {/* Right: View Toggle Pills */}
                            <div className="flex items-center gap-3">
                                <div className="flex rounded-xl border border-white/10 p-1 bg-white/5 backdrop-blur-sm">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("card")}
                                        className={cn(
                                            "px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2",
                                            (viewMode as "card" | "table") === "card"
                                                ? "bg-white text-slate-900 shadow-lg"
                                                : "text-white/70 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        <User className="w-4 h-4" />
                                        Carte
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("table")}
                                        className={cn(
                                            "px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2",
                                            (viewMode as "card" | "table") === "table"
                                                ? "bg-white text-slate-900 shadow-lg"
                                                : "text-white/70 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        <Building2 className="w-4 h-4" />
                                        Tableau
                                    </button>
                                </div>

                                <Button
                                    type="button"
                                    onClick={() => setShowStatsModal(true)}
                                    className="rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm gap-2 px-4 py-2 h-auto font-medium"
                                >
                                    <BarChart2 className="w-4 h-4" />
                                    Stats
                                </Button>

                                {/* Stats badge - Actions count only (no timer for SDR/BD) */}
                                <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            <span className="text-sm font-semibold text-white">{actionsCompleted}</span>
                                            <span className="text-xs text-white/60">actions</span>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modern Filter Card */}
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <Filter className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">Filtres</h3>
                                    <p className="text-xs text-slate-500">Affinez votre file d'actions</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {hasTableFiltersActive && (
                                    <Badge className="bg-indigo-100 text-indigo-600 border-indigo-200">
                                        {[tableFilterResult, tableFilterPriority, tableFilterChannel, tableFilterType].filter(Boolean).length} filtres actifs
                                    </Badge>
                                )}
                                {hasTableFiltersActive && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearTableFilters}
                                        className="text-slate-500 hover:text-red-600 hover:bg-red-50 gap-1.5"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Réinitialiser
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Filter Grid */}
                    <div className="p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                            {/* Mission */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Mission</label>
                                <select
                                    value={selectedMissionId || ""}
                                    onChange={handleMissionChange}
                                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-shadow cursor-pointer"
                                >
                                    {missions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            {/* Liste */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Liste</label>
                                <select
                                    value={selectedListId || "all"}
                                    onChange={handleListChange}
                                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-shadow cursor-pointer"
                                >
                                    <option value="all">Toutes les listes</option>
                                    {filteredLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            {/* Recherche dans la mission (serveur) — pour retrouver un contact déjà contacté / email envoyé */}
                            <div className="space-y-1.5 sm:col-span-2">
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rechercher dans la mission</label>
                                <input
                                    type="text"
                                    value={tableSearchInput}
                                    onChange={(e) => setTableSearchInput(e.target.value)}
                                    placeholder="Nom contact ou société… (retrouver même après envoi email)"
                                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-shadow"
                                />
                            </div>
                            {/* Statut */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</label>
                                <select
                                    value={tableFilterResult}
                                    onChange={(e) => setTableFilterResult(e.target.value)}
                                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-shadow cursor-pointer"
                                >
                                    <option value="">Tous les statuts</option>
                                    <option value="NONE">Jamais contacté</option>
                                    {Object.entries(statusLabels).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Priorité */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Priorité</label>
                                <select
                                    value={tableFilterPriority}
                                    onChange={(e) => setTableFilterPriority(e.target.value)}
                                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-shadow cursor-pointer"
                                >
                                    <option value="">Toutes</option>
                                    {Object.entries(PRIORITY_LABELS).map(([value, { label }]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Canal */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Canal</label>
                                <select
                                    value={tableFilterChannel}
                                    onChange={(e) => setTableFilterChannel(e.target.value)}
                                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-shadow cursor-pointer"
                                >
                                    <option value="">Tous</option>
                                    {(Object.entries(CHANNEL_LABELS) as [Channel, string][]).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Type */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Type</label>
                                <select
                                    value={tableFilterType}
                                    onChange={(e) => setTableFilterType(e.target.value)}
                                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-shadow cursor-pointer"
                                >
                                    <option value="">Contact + Société</option>
                                    <option value="contact">Contact uniquement</option>
                                    <option value="company">Société uniquement</option>
                                </select>
                            </div>
                        </div>

                        {/* Results summary */}
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                {tableSearchApi ? (
                                    <span><span className="font-medium text-indigo-600">{queueItems.length}</span> résultat{queueItems.length !== 1 ? "s" : ""} pour « {tableSearchApi} »</span>
                                ) : hasTableFiltersActive ? (
                                    <span><span className="font-medium text-indigo-600">{filteredQueueItems.length}</span> résultat{filteredQueueItems.length !== 1 ? "s" : ""} sur {queueItems.length}</span>
                                ) : (
                                    <span><span className="font-medium text-slate-700">{queueItems.length}</span> dans la file</span>
                                )}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => refreshQueue()}
                                className="text-slate-500 hover:text-indigo-600 gap-1.5"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Actualiser
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-200/50 overflow-hidden">
                    {queueLoading ? (
                        <TableSkeleton columns={6} rows={12} className="rounded-2xl" />
                    ) : queueFetchError ? (
                        <EmptyState
                            icon={RefreshCw}
                            title={queueFetchError}
                            description="Vérifiez votre connexion et réessayez."
                            action={
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setQueueFetchError(null);
                                        refreshQueue();
                                    }}
                                    className="gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Réessayer
                                </Button>
                            }
                            className="rounded-2xl border-0"
                        />
                    ) : (
                        <DataTable
                            data={filteredQueueItems}
                            columns={queueColumns}
                            keyField={(row) => queueRowKey(row)}
                            searchable
                            searchPlaceholder="Rechercher contact, société, téléphone, note..."
                            searchFields={["_displayName", "_companyName", "_phone", "_searchNote", "missionName"]}
                            pagination
                            pageSize={15}
                            emptyMessage="Aucun contact dans la file. Changez de mission ou liste."
                            onRowClick={openDrawerForRow}
                            getRowClassName={(row) =>
                                recentlyUpdatedRowKeys.has(queueRowKey(row))
                                    ? "!bg-emerald-50/80 border-l-4 border-l-emerald-500 animate-fade-in"
                                    : ""
                            }
                        />
                    )}
                </div>

                {/* Unified Action Drawer */}
                {
                    unifiedDrawerCompanyId && (
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
                                    setQueueItems((prev) => prev.filter((r) => queueRowKey(r) !== rowKey));
                                    setActionsCompleted((c) => c + 1);
                                }
                                refreshQueue();
                            }}
                            onValidateAndNext={() => {
                                if (!drawerRow) return;
                                const key = queueRowKey(drawerRow);
                                const idx = filteredQueueItems.findIndex((row) => queueRowKey(row) === key);
                                setQueueItems((prev) => prev.filter((r) => queueRowKey(r) !== key));
                                setActionsCompleted((c) => c + 1);
                                if (idx >= 0 && idx < filteredQueueItems.length - 1) {
                                    const nextRow = filteredQueueItems[idx + 1];
                                    openDrawerForRow(nextRow);
                                } else {
                                    closeUnifiedDrawer();
                                }
                                refreshQueue();
                            }}
                        />
                    )
                }

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

                {/* Stats modal: summary + list of contacts with status (click to open drawer) */}
                <Modal
                    isOpen={showStatsModal}
                    onClose={() => setShowStatsModal(false)}
                    title="Statistiques"
                    description={selectedMissionId ? (missions.find((m) => m.id === selectedMissionId)?.name ?? "") + (selectedListId ? ` · ${filteredLists.find((l) => l.id === selectedListId)?.name ?? ""}` : "") : "Sélectionnez une mission"}
                    size="xl"
                >
                    {viewMode === "table" ? (
                        <ActionStatsModalBody
                            items={filteredQueueItems}
                            loading={false}
                            statusLabels={statusLabels}
                            onRowClick={(row) => {
                                openDrawerForRow(row);
                                setShowStatsModal(false);
                            }}
                            priorityLabels={PRIORITY_LABELS}
                            resultIconMap={RESULT_ICON_MAP}
                            queueRowKey={queueRowKey}
                        />
                    ) : (
                        <ActionStatsModalBody
                            items={statsQueueItems}
                            loading={statsLoading}
                            statusLabels={statusLabels}
                            onRowClick={(row) => {
                                openDrawerForRow(row);
                                setShowStatsModal(false);
                            }}
                            priorityLabels={PRIORITY_LABELS}
                            resultIconMap={RESULT_ICON_MAP}
                            queueRowKey={queueRowKey}
                        />
                    )}
                </Modal>
            </div >
        );
    }

    // Loading (card view)
    if (isLoading && !currentAction) {
        return (
            <div className="space-y-6 max-w-2xl mx-auto">
                <CardSkeleton hasHeader hasImage={false} lines={4} />
                <CardSkeleton hasHeader={false} lines={3} />
                <div className="flex gap-4">
                    <CardSkeleton hasHeader className="flex-1" lines={2} />
                    <CardSkeleton hasHeader className="flex-1" lines={2} />
                </div>
            </div>
        );
    }

    // Empty queue (card view)
    if (!currentAction?.hasNext) {
        return (
            <div className="space-y-6">
                {/* Modern Header */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 shadow-xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-violet-500/10" />
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />

                    <div className="relative">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                    <Phone className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">Actions</h1>
                                    <p className="text-sm text-white/60">Gérez vos actions commerciales</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex rounded-xl border border-white/10 p-1 bg-white/5 backdrop-blur-sm">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("card")}
                                        className={cn(
                                            "px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2",
                                            (viewMode as "card" | "table") === "card"
                                                ? "bg-white text-slate-900 shadow-lg"
                                                : "text-white/70 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        <User className="w-4 h-4" />
                                        Carte
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode("table")}
                                        className={cn(
                                            "px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2",
                                            (viewMode as "card" | "table") === "table"
                                                ? "bg-white text-slate-900 shadow-lg"
                                                : "text-white/70 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        <Building2 className="w-4 h-4" />
                                        Tableau
                                    </button>
                                </div>

                                <Select
                                    variant="header-dark"
                                    value={selectedMissionId || ""}
                                    onChange={(id) => {
                                        setSelectedMissionId(id);
                                        localStorage.setItem("sdr_selected_mission", id);
                                        setSelectedListId(null);
                                    }}
                                    options={missions.map((m) => ({ value: m.id, label: m.name }))}
                                    placeholder="Mission"
                                    className="min-w-[180px]"
                                />
                                <Select
                                    variant="header-dark"
                                    value={selectedListId || "all"}
                                    onChange={(id) => setSelectedListId(id === "all" ? null : id)}
                                    options={[
                                        { value: "all", label: "Toutes les listes" },
                                        ...filteredLists.map((l) => ({ value: l.id, label: l.name })),
                                    ]}
                                    placeholder="Liste"
                                    className="min-w-[160px]"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Empty State Card */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12">
                    <EmptyState
                        icon={CheckCircle2}
                        title="File d'attente vide"
                        description={currentAction?.message || "Aucun contact disponible pour le moment"}
                        action={
                            <Button variant="secondary" onClick={loadNextAction} className="gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Actualiser
                            </Button>
                        }
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Success Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="text-center animate-fade-in">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        </div>
                        <p className="text-lg font-semibold text-slate-900">Action enregistrée</p>
                        <p className="text-sm text-slate-500 mt-1">Chargement du contact suivant...</p>
                    </div>
                </div>
            )}

            {/* Modern Header with View Toggle & Context */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 shadow-xl">
                {/* Background decoration */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-violet-500/10" />
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />

                <div className="relative">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Left: Title & Context */}
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                <Phone className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Actions</h1>
                                <p className="text-sm text-white/60">{currentAction.missionName || "Gérez vos actions commerciales"}</p>
                            </div>
                        </div>

                        {/* Right: Controls & Stats */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* View Toggle Pills */}
                            <div className="flex rounded-xl border border-white/10 p-1 bg-white/5 backdrop-blur-sm">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("card")}
                                    className={cn(
                                        "px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2",
                                        (viewMode as "card" | "table") === "card"
                                            ? "bg-white text-slate-900 shadow-lg"
                                            : "text-white/70 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    <User className="w-4 h-4" />
                                    Carte
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("table")}
                                    className={cn(
                                        "px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2",
                                        (viewMode as "card" | "table") === "table"
                                            ? "bg-white text-slate-900 shadow-lg"
                                            : "text-white/70 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    <Building2 className="w-4 h-4" />
                                    Tableau
                                </button>
                            </div>

                            {/* Mission & List Selectors */}
                            <Select
                                variant="header-dark"
                                value={selectedMissionId || ""}
                                onChange={(id) => {
                                    setSelectedMissionId(id);
                                    localStorage.setItem("sdr_selected_mission", id);
                                    setSelectedListId(null);
                                }}
                                options={missions.map((m) => ({ value: m.id, label: m.name }))}
                                placeholder="Mission"
                                className="min-w-[180px]"
                            />
                            <Select
                                variant="header-dark"
                                value={selectedListId || "all"}
                                onChange={(id) => setSelectedListId(id === "all" ? null : id)}
                                options={[
                                    { value: "all", label: "Toutes les listes" },
                                    ...filteredLists.map((l) => ({ value: l.id, label: l.name })),
                                ]}
                                placeholder="Liste"
                                className="min-w-[160px]"
                            />

                            <Button
                                type="button"
                                onClick={() => setShowStatsModal(true)}
                                className="rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm gap-2 px-4 py-2 h-auto font-medium"
                            >
                                <BarChart2 className="w-4 h-4" />
                                Stats
                            </Button>

                            {/* Stats Badges */}
                            <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        <span className="text-sm font-semibold text-white">{actionsCompleted}</span>
                                        <span className="text-xs text-white/60">actions</span>
                                    </div>
                                    {currentAction.priority && (
                                        <>
                                            <div className="w-px h-4 bg-white/20" />
                                            <Badge className={cn("text-xs", PRIORITY_LABELS[currentAction.priority].color)}>
                                                {PRIORITY_LABELS[currentAction.priority].label}
                                            </Badge>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-4 shadow-sm">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent" />
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-red-900">Erreur</p>
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setError(null)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                        >
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left - Contact Panel (2 cols) */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Company Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="p-5">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100">
                                    <Building2 className="w-7 h-7 text-indigo-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <h2 className="text-lg font-bold text-slate-900 truncate">
                                            {currentAction.company?.name}
                                        </h2>
                                        {currentAction.company?.id && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDrawerCompanyId(currentAction.company!.id)}
                                                className="shrink-0 h-8 px-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                                title="Modifier l'entreprise"
                                            >
                                                <PenLine className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {currentAction.company?.industry && (
                                            <Badge variant="default" className="bg-slate-100 text-slate-600 border-slate-200">
                                                {currentAction.company.industry}
                                            </Badge>
                                        )}
                                        {currentAction.company?.country && (
                                            <Badge variant="default" className="bg-slate-100 text-slate-600 border-slate-200">
                                                {currentAction.company.country}
                                            </Badge>
                                        )}
                                    </div>
                                    {currentAction.company?.website && (
                                        <a
                                            href={`https://${currentAction.company.website}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                        >
                                            <Globe className="w-3.5 h-3.5" />
                                            {currentAction.company.website}
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact/Company Card */}
                    <Card>
                        {currentAction.contact ? (
                            <>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                                        <User className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-900">
                                            {currentAction.contact.firstName} {currentAction.contact.lastName}
                                        </p>
                                        {currentAction.contact.title && (
                                            <Badge variant="default" className="mt-1">
                                                {currentAction.contact.title}
                                            </Badge>
                                        )}
                                    </div>
                                    {currentAction.contact.id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDrawerContactId(currentAction.contact!.id)}
                                            className="shrink-0 h-8 px-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                            title="Modifier le contact"
                                        >
                                            <PenLine className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>

                                {/* Contact Actions */}
                                <div className="space-y-2">
                                    {/* Phone - validate it looks like a phone number (contains digits) */}
                                    {(() => {
                                        const phone = currentAction.contact.phone || (currentAction.channel === 'CALL' && currentAction.company?.phone ? currentAction.company.phone : null);
                                        const isValidPhone = phone && /[\d+\-().\s]/.test(phone) && phone.length >= 8;
                                        return isValidPhone ? (
                                            <a
                                                href={`tel:${phone}`}
                                                className="flex items-center justify-center gap-2 h-12 w-full text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                                            >
                                                <Phone className="w-4 h-4" />
                                                {phone}
                                            </a>
                                        ) : null;
                                    })()}
                                    {/* Email - validate it looks like an email */}
                                    {(() => {
                                        const email = currentAction.contact.email;
                                        const isValidEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                                        return isValidEmail ? (
                                            <a
                                                href={`mailto:${email}`}
                                                className="flex items-center justify-center gap-2 h-11 w-full text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
                                            >
                                                <Mail className="w-4 h-4" />
                                                {email}
                                            </a>
                                        ) : null;
                                    })()}
                                    {currentAction.contact.linkedin && (
                                        <a
                                            href={currentAction.contact.linkedin.startsWith("http") ? currentAction.contact.linkedin : `https://${currentAction.contact.linkedin}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 h-11 w-full text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
                                        >
                                            <Linkedin className="w-4 h-4" />
                                            LinkedIn
                                        </a>
                                    )}
                                    {/* Show warning if contact info is missing or invalid */}
                                    {(() => {
                                        const phone = currentAction.contact.phone || (currentAction.channel === 'CALL' && currentAction.company?.phone ? currentAction.company.phone : null);
                                        const isValidPhone = phone && /[\d+\-().\s]/.test(phone) && phone.length >= 8;
                                        const email = currentAction.contact.email;
                                        const isValidEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

                                        if (currentAction.channel === 'CALL' && !isValidPhone) {
                                            return (
                                                <div className="space-y-2">
                                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                                                        <AlertCircle className="w-4 h-4 inline mr-2" />
                                                        Aucun numéro de téléphone valide disponible
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setDrawerContactId(currentAction.contact!.id)}
                                                        className="w-full gap-2"
                                                    >
                                                        <PenLine className="w-4 h-4" />
                                                        Ajouter un numéro / Modifier le contact
                                                    </Button>
                                                </div>
                                            );
                                        }
                                        if (currentAction.channel === 'EMAIL' && !isValidEmail) {
                                            return (
                                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                                                    <AlertCircle className="w-4 h-4 inline mr-2" />
                                                    Aucune adresse email valide disponible
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    {currentAction.clientBookingUrl && (
                                        <Button
                                            variant="primary"
                                            onClick={() => setShowBookingModal(true)}
                                            className="w-full gap-2"
                                        >
                                            <Calendar className="w-4 h-4" />
                                            Planifier un RDV
                                        </Button>
                                    )}
                                </div>
                            </>
                        ) : currentAction.company ? (
                            <>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                                        <Building2 className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-900">
                                            {currentAction.company.name}
                                        </p>
                                        <Badge variant="default" className="mt-1">
                                            Entreprise
                                        </Badge>
                                    </div>
                                    {currentAction.company.id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDrawerCompanyId(currentAction.company!.id)}
                                            className="shrink-0 h-8 px-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                            title="Modifier l'entreprise"
                                        >
                                            <PenLine className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>

                                {/* Company Actions */}
                                <div className="space-y-2">
                                    {currentAction.company.phone ? (
                                        <a
                                            href={`tel:${currentAction.company.phone}`}
                                            className="flex items-center justify-center gap-2 h-12 w-full text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                                        >
                                            <Phone className="w-4 h-4" />
                                            {currentAction.company.phone}
                                        </a>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDrawerCompanyId(currentAction.company!.id)}
                                            className="w-full gap-2"
                                        >
                                            <PenLine className="w-4 h-4" />
                                            Ajouter un numéro / Modifier l'entreprise
                                        </Button>
                                    )}
                                </div>
                            </>
                        ) : null}

                        {/* Previous Action Context */}
                        {currentAction.lastAction && (
                            <div className="mt-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <History className="w-4 h-4 text-amber-600" />
                                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Dernière interaction</p>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge className={cn("text-xs border font-medium", {
                                        "bg-slate-100 text-slate-600 border-slate-200": currentAction.lastAction.result === "NO_RESPONSE",
                                        "bg-red-50 text-red-600 border-red-200": currentAction.lastAction.result === "BAD_CONTACT",
                                        "bg-emerald-50 text-emerald-700 border-emerald-200": currentAction.lastAction.result === "INTERESTED",
                                        "bg-amber-100 text-amber-700 border-amber-200": currentAction.lastAction.result === "CALLBACK_REQUESTED",
                                        "bg-indigo-50 text-indigo-700 border-indigo-200": currentAction.lastAction.result === "MEETING_BOOKED",
                                        "bg-blue-50 text-blue-700 border-blue-200": currentAction.lastAction.result === "ENVOIE_MAIL",
                                    })}>
                                        {RESULT_ICON_MAP[currentAction.lastAction.result]}
                                        <span className="ml-1">{statusLabels[currentAction.lastAction.result] ?? currentAction.lastAction.result}</span>
                                    </Badge>
                                    <span className="text-[10px] text-amber-600 font-medium">
                                        {new Date(currentAction.lastAction.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                {currentAction.lastAction.note && (
                                    <div className="mt-2 pl-3 border-l-2 border-amber-300">
                                        <p className="text-sm text-amber-900 italic">"{currentAction.lastAction.note}"</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right - Script Panel (3 cols) */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm h-full overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">Script d'appel</h3>
                                    <p className="text-xs text-slate-500">Guide conversationnel</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5">
                            {scriptSections && availableScriptTabs.length > 0 ? (
                                <>
                                    <Tabs
                                        tabs={availableScriptTabs}
                                        activeTab={activeTab}
                                        onTabChange={setActiveTab}
                                        className="mb-4"
                                    />
                                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/60 rounded-xl p-5 min-h-[200px]">
                                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                            {scriptSections[activeTab] || ""}
                                        </p>
                                    </div>
                                </>
                            ) : currentAction.script ? (
                                <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/60 rounded-xl p-5">
                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                        {currentAction.script}
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                        <Sparkles className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p className="text-sm text-slate-500">Aucun script disponible</p>
                                    <p className="text-xs text-slate-400 mt-1">Le script sera affiché ici s'il est configuré</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Results */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">Résultat de l'action</h3>
                            <p className="text-xs text-slate-500">Sélectionnez le résultat de votre appel</p>
                        </div>
                    </div>
                </div>
                <div className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {resultOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setSelectedResult(option.value)}
                                className={cn(
                                    "relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                                    selectedResult === option.value
                                        ? "bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-300 shadow-sm"
                                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                )}
                            >
                                <span className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                    selectedResult === option.value
                                        ? "bg-indigo-100 text-indigo-600"
                                        : "bg-slate-100 text-slate-400"
                                )}>
                                    {option.icon}
                                </span>
                                <span className={cn(
                                    "text-sm font-medium text-left",
                                    selectedResult === option.value ? "text-indigo-900" : "text-slate-700"
                                )}>
                                    {option.label}
                                </span>
                                <span className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-[10px] font-mono text-slate-400 bg-slate-100 rounded">
                                    {option.key}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Note */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                                <MessageSquare className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                    Note
                                    {selectedResult && getRequiresNote(selectedResult) && (
                                        <span className="text-red-500 ml-1">*</span>
                                    )}
                                </h3>
                                <p className="text-xs text-slate-500">Ajoutez des informations sur l'échange</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleImproveNote}
                                disabled={!note.trim() || isImprovingNote}
                                className="gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200/60"
                            >
                                {isImprovingNote ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Sparkles className="w-3.5 h-3.5" />
                                )}
                                {isImprovingNote ? "En cours..." : "Améliorer avec l'IA"}
                            </Button>
                            <span className="text-xs text-slate-400 font-medium">{note.length}/500</span>
                        </div>
                    </div>
                </div>
                <div className="p-5">
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Ajouter une note sur l'échange..."
                        rows={3}
                        maxLength={500}
                        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white resize-none transition-colors"
                    />
                </div>
            </div>

            {/* Callback date (Rappel) - calendar when "Rappel demandé" */}
            {selectedResult === "CALLBACK_REQUESTED" && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-amber-100 bg-gradient-to-r from-amber-100/50 to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                                <Calendar className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Date de rappel</h3>
                                <p className="text-xs text-slate-600">
                                    {currentAction?.missionName ? (
                                        <span>Mission: {currentAction.missionName}</span>
                                    ) : (
                                        "Choisissez une date et heure pour le rappel"
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="p-5">
                        <input
                            type="datetime-local"
                            value={callbackDateValue}
                            onChange={(e) => setCallbackDateValue(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full px-4 py-3 text-sm border border-amber-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-300 cursor-pointer"
                        />
                        <p className="text-xs text-slate-500 mt-3">
                            💡 Optionnel. Vous pouvez aussi indiquer la date dans la note (ex: &quot;rappeler demain 14h&quot;).
                        </p>
                    </div>
                </div>
            )}

            {/* Submit */}
            <div className="flex items-center justify-between pt-2 gap-4">
                {/* Skip / Passer button */}
                <Button
                    variant="ghost"
                    size="lg"
                    onClick={async () => {
                        // Skip this contact: record NO_RESPONSE silently and load next
                        if (!currentAction?.campaignId) return;
                        setIsSubmitting(true);
                        try {
                            const res = await fetch("/api/actions", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    contactId: currentAction.contact?.id,
                                    companyId: !currentAction.contact && currentAction.company ? currentAction.company.id : undefined,
                                    campaignId: currentAction.campaignId,
                                    channel: currentAction.channel,
                                    result: "NO_RESPONSE",
                                    note: "Passé (skip)",
                                }),
                            });
                            const json = await res.json();
                            if (!json.success) {
                                showError(json.error || "Erreur lors du passage");
                                return;
                            }
                            await loadNextAction();
                        } catch {
                            showError("Erreur de connexion");
                        } finally {
                            setIsSubmitting(false);
                        }
                    }}
                    disabled={isSubmitting}
                    className="gap-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200"
                >
                    <SkipForward className="w-4 h-4" />
                    Passer
                </Button>

                <Button
                    variant="primary"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!selectedResult || isSubmitting || (getRequiresNote(selectedResult) && !note.trim())}
                    isLoading={isSubmitting}
                    className="gap-2 px-8 shadow-lg shadow-indigo-500/20 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600"
                >
                    {isSubmitting ? "Enregistrement..." : "Valider & Suivant"}
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            {/* Quick Email Modal (card view) */}
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

            {/* Stats modal (card view) */}
            <Modal
                isOpen={showStatsModal}
                onClose={() => setShowStatsModal(false)}
                title="Statistiques"
                description={selectedMissionId ? (missions.find((m) => m.id === selectedMissionId)?.name ?? "") + (selectedListId ? ` · ${filteredLists.find((l) => l.id === selectedListId)?.name ?? ""}` : "") : "Sélectionnez une mission"}
                size="xl"
            >
                <ActionStatsModalBody
                    items={statsQueueItems}
                    loading={statsLoading}
                    statusLabels={statusLabels}
                    onRowClick={(row) => {
                        openDrawerForRow(row);
                        setShowStatsModal(false);
                    }}
                    priorityLabels={PRIORITY_LABELS}
                    resultIconMap={RESULT_ICON_MAP}
                    queueRowKey={queueRowKey}
                />
            </Modal>

            {/* Unified Action Drawer (card view: when opened from Stats modal) */}
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
                        if (rowKey) setActionsCompleted((c) => c + 1);
                        loadNextAction();
                    }}
                    onValidateAndNext={() => {
                        closeUnifiedDrawer();
                        loadNextAction();
                    }}
                />
            )}

            {/* Booking Modal */}
            {currentAction?.clientBookingUrl && currentAction.contact && (
                <BookingModal
                    isOpen={showBookingModal}
                    onClose={() => setShowBookingModal(false)}
                    bookingUrl={currentAction.clientBookingUrl}
                    contactId={currentAction.contact.id}
                    contactName={`${currentAction.contact.firstName || ""} ${currentAction.contact.lastName || ""}`.trim() || "Contact"}
                    onBookingSuccess={() => {
                        // Reload next action after booking success
                        loadNextAction();
                    }}
                />
            )}

            {/* Contact / Company edit drawers (card view: edit contact info, company info, add phone) */}
            <ContactDrawer
                isOpen={!!drawerContactId}
                onClose={closeContactDrawer}
                contact={drawerContact}
                onUpdate={() => {
                    refreshQueue();
                }}
                isManager={true}
                listId={selectedListId ?? undefined}
                companies={[]}
            />
            <CompanyDrawer
                isOpen={!!drawerCompanyId}
                onClose={closeCompanyDrawer}
                company={drawerCompany}
                onUpdate={() => {
                    refreshQueue();
                }}
                onContactClick={handleContactFromCompany}
                isManager={true}
                listId={selectedListId ?? undefined}
            />
        </div>
    );
}
