"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Drawer, Button, Badge, Select, useToast, TextSkeleton, ListSkeleton, DateTimePicker } from "@/components/ui";
import { useVoipCall } from "@/hooks/useVoipCall";
import { useVoipListener } from "@/hooks/useVoipListener";
import { VoipCallValidationModal } from "@/components/voip/VoipCallValidationModal";
import type { VoipCallCompletedEvent } from "@/hooks/useVoipListener";
import { ACTION_RESULT_LABELS, type ActionResult } from "@/lib/types";
import {
    Building2,
    User,
    Phone,
    Mail,
    Globe,
    Linkedin,
    MapPin,
    Users,
    Copy,
    ExternalLink,
    Clock,
    CheckCircle,
    AlertCircle,
    Loader2,
    PhoneCall,
    Send,
    MessageSquare,
    History,
    ChevronRight,
    Sparkles,
    Pencil,
    Save,
    X,
    Calendar,
    Plus,
    Trash2,
    RefreshCw,
    FileText,
    ChevronDown,
    ChevronUp,
    PhoneMissed,
    ThumbsUp,
    PhoneOff,
    CalendarX,
    Ban,
    RotateCcw,
    Check,
    Info,
    Video,
} from "lucide-react";
import { BookingDrawer } from "@/components/sdr/BookingDrawer";
import { ContactDrawer } from "./ContactDrawer";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface Contact {
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
    customData?: Record<string, unknown> | null;
}

interface Company {
    id: string;
    name: string;
    industry: string | null;
    country: string | null;
    website: string | null;
    size: string | null;
    phone: string | null;
    status: "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";
    contacts: Contact[];
    _count?: { contacts: number };
    customData?: Record<string, unknown> | null;
}

interface UnifiedActionDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    contactId: string | null;
    companyId: string;
    missionId?: string;
    missionName?: string;
    clientBookingUrl?: string;
    clientInterlocuteurs?: Array<{
        id: string; firstName: string; lastName: string; title?: string;
        emails: Array<{ value: string; label: string; isPrimary: boolean }>;
        phones: Array<{ value: string; label: string; isPrimary: boolean }>;
        bookingLinks: Array<{ label: string; url: string; durationMinutes: number }>;
        isActive: boolean;
    }>;
    onActionRecorded?: () => void;
    onOpenEmailModal?: () => void;
    onValidateAndNext?: () => void;
    onContactSelect?: (contactId: string) => void;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_CONFIG = {
    PARTIAL: {
        label: "Partiel",
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        dot: "bg-amber-400",
        icon: Clock,
    },
    ACTIONABLE: {
        label: "Actionnable",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        dot: "bg-emerald-400",
        icon: CheckCircle,
    },
};

// Result chip definitions — icon + semantic color grouping
const RESULT_CHIP_CONFIG: Record<
    string,
    {
        label: string;
        icon: React.ElementType;
        bg: string;
        text: string;
        border: string;
        dot: string;
        selectedBg: string;
        selectedText: string;
        selectedBorder: string;
    }
> = {
    NO_RESPONSE: {
        label: "Pas de réponse",
        icon: PhoneMissed,
        bg: "bg-slate-50",
        text: "text-slate-600",
        border: "border-slate-200",
        dot: "bg-slate-400",
        selectedBg: "bg-slate-100",
        selectedText: "text-slate-800",
        selectedBorder: "border-slate-400",
    },
    BAD_CONTACT: {
        label: "Mauvais contact",
        icon: PhoneOff,
        bg: "bg-red-50",
        text: "text-red-600",
        border: "border-red-200",
        dot: "bg-red-400",
        selectedBg: "bg-red-100",
        selectedText: "text-red-800",
        selectedBorder: "border-red-400",
    },
    INTERESTED: {
        label: "Intéressé",
        icon: ThumbsUp,
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        dot: "bg-emerald-400",
        selectedBg: "bg-emerald-100",
        selectedText: "text-emerald-800",
        selectedBorder: "border-emerald-500",
    },
    CALLBACK_REQUESTED: {
        label: "Rappel demandé",
        icon: RotateCcw,
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
        dot: "bg-amber-400",
        selectedBg: "bg-amber-100",
        selectedText: "text-amber-800",
        selectedBorder: "border-amber-500",
    },
    MEETING_BOOKED: {
        label: "RDV planifié",
        icon: Calendar,
        bg: "bg-indigo-50",
        text: "text-indigo-700",
        border: "border-indigo-200",
        dot: "bg-indigo-400",
        selectedBg: "bg-indigo-100",
        selectedText: "text-indigo-800",
        selectedBorder: "border-indigo-500",
    },
    MEETING_CANCELLED: {
        label: "RDV annulé",
        icon: CalendarX,
        bg: "bg-red-50",
        text: "text-red-600",
        border: "border-red-200",
        dot: "bg-red-400",
        selectedBg: "bg-red-100",
        selectedText: "text-red-800",
        selectedBorder: "border-red-400",
    },
    DISQUALIFIED: {
        label: "Disqualifié",
        icon: Ban,
        bg: "bg-slate-50",
        text: "text-slate-500",
        border: "border-slate-200",
        dot: "bg-slate-300",
        selectedBg: "bg-slate-100",
        selectedText: "text-slate-700",
        selectedBorder: "border-slate-400",
    },
    ENVOIE_MAIL: {
        label: "Envoi mail",
        icon: Send,
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
        dot: "bg-blue-400",
        selectedBg: "bg-blue-100",
        selectedText: "text-blue-800",
        selectedBorder: "border-blue-500",
    },
};

function formatCustomLabel(key: string): string {
    return key
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

// ============================================
// SUB-COMPONENTS
// ============================================

function InfoRow({
    icon: Icon,
    iconColor,
    iconBg,
    label,
    children,
    action,
    editing,
}: {
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
    label: string;
    children: React.ReactNode;
    action?: React.ReactNode;
    editing?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors",
                !editing && "hover:bg-slate-50/60"
            )}
        >
            <div
                className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    iconBg
                )}
                aria-hidden="true"
            >
                <Icon className={cn("w-3.5 h-3.5", iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">
                    {label}
                </p>
                {children}
            </div>
            {action && (
                <div className="shrink-0 flex items-center gap-1">{action}</div>
            )}
        </div>
    );
}

function CopyButton({ text, label }: { text: string; label: string }) {
    const { success } = useToast();
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        success("Copié", `${label} copié dans le presse-papier`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button
            onClick={handleCopy}
            aria-label={`Copier ${label}`}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-150"
        >
            {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
                <Copy className="w-3.5 h-3.5" />
            )}
        </button>
    );
}

function StatusPill({ status }: { status: string }) {
    const cfg = (STATUS_CONFIG as Record<string, (typeof STATUS_CONFIG)["PARTIAL"] | undefined>)[status];
    if (!cfg) return null; // e.g. INCOMPLETE: intentionally not shown
    const Icon = cfg.icon;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
                cfg.bg,
                cfg.color,
                cfg.border
            )}
            aria-label={`Statut: ${cfg.label}`}
        >
            <Icon className="w-3 h-3" aria-hidden="true" />
            {cfg.label}
        </span>
    );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function UnifiedActionDrawer({
    isOpen,
    onClose,
    contactId,
    companyId,
    missionId,
    missionName,
    clientBookingUrl,
    clientInterlocuteurs,
    onActionRecorded,
    onOpenEmailModal,
    onValidateAndNext,
    onContactSelect,
}: UnifiedActionDrawerProps) {
    const { success, error: showError } = useToast();

    const [activeTab, setActiveTab] = useState<"contact" | "company">("contact");
    const [contact, setContact] = useState<Contact | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(false);
    const [actions, setActions] = useState<
        Array<{
            id: string;
            result: string;
            note: string | null;
            createdAt: string;
            channel?: string;
            campaign?: { name: string };
            sdr?: { id: string; name: string };
            voipProvider?: string | null;
            voipSummary?: string | null;
            voipRecordingUrl?: string | null;
        }>
    >([]);
    const [actionsLoading, setActionsLoading] = useState(false);
    const syncedAlloActionIdsRef = useRef<Set<string>>(new Set());

    const [campaigns, setCampaigns] = useState<
        Array<{ id: string; name: string; mission?: { channel: string } }>
    >([]);
    const [campaignsLoading, setCampaignsLoading] = useState(false);
    const [statusConfig, setStatusConfig] = useState<{
        statuses: Array<{ code: string; label: string; requiresNote: boolean }>;
    } | null>(null);

    // Action form
    const [newActionResult, setNewActionResult] = useState<string>("");
    const [newActionNote, setNewActionNote] = useState("");
    const [newActionSaving, setNewActionSaving] = useState(false);
    const [newCallbackDateValue, setNewCallbackDateValue] = useState("");
    const [isImprovingNote, setIsImprovingNote] = useState(false);
    const noteRef = useRef<HTMLTextAreaElement>(null);

    const [showBookingDrawer, setShowBookingDrawer] = useState(false);
    const [rdvDate, setRdvDate] = useState("");
    const [meetingType, setMeetingType] = useState<"VISIO" | "PHYSIQUE" | "TELEPHONIQUE" | "">("");
    const [meetingCat, setMeetingCat] = useState<"EXPLORATOIRE" | "BESOIN" | "">("");
    const [meetingJoinUrl, setMeetingJoinUrl] = useState("");
    const [meetingAddress, setMeetingAddress] = useState("");
    const [meetingPhone, setMeetingPhone] = useState("");
    const [showAddContact, setShowAddContact] = useState(false);
    const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
    const [historyExpanded, setHistoryExpanded] = useState(false);

    // Inline editing
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [isEditingCompany, setIsEditingCompany] = useState(false);
    const [editContactData, setEditContactData] = useState<Partial<Contact>>({});
    const [editCompanyData, setEditCompanyData] = useState<Partial<Company>>({});
    const [savingContact, setSavingContact] = useState(false);
    const [savingCompany, setSavingCompany] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    const [voipModalOpen, setVoipModalOpen] = useState(false);
    const [voipModalData, setVoipModalData] = useState<VoipCallCompletedEvent | null>(null);
    const [voipModalActionId, setVoipModalActionId] = useState<string>("");
    const [voipEnrichmentSummary, setVoipEnrichmentSummary] = useState<string | null>(null);

    const { data: session } = useSession();
    const userId = session?.user?.id ?? null;

    const { state: voipState, initiateCall: voipInitiate } = useVoipCall({
        onError: (msg) => showError("Appel", msg),
        onSuccess: (msg) => success("Appel", msg),
        onFallbackToTel: (phone) => {
            window.open(`tel:${phone}`, "_self");
            success("Appel", "Ouvrez votre téléphone pour appeler (VOIP non configuré)");
        },
    });

    useVoipListener({
        userId,
        enabled: isOpen && !!userId,
        onCallCompleted: (data) => {
            if (data.autoValidated) {
                success("Appel Allo", `Résumé IA enregistré pour ${data.contactName || "le contact"}`);
                setActionsLoading(true);
                const q = contactId ? `contactId=${contactId}` : `companyId=${companyId}`;
                fetch(`/api/actions?${q}&limit=10`)
                    .then((res) => res.json())
                    .then((json) => {
                        if (json.success && Array.isArray(json.data)) setActions(json.data);
                    })
                    .finally(() => setActionsLoading(false));
                onActionRecorded?.();
                return;
            }
            setVoipModalActionId(data.actionId);
            setVoipModalData(data);
            setVoipEnrichmentSummary(null);
            setVoipModalOpen(true);
        },
        onEnrichmentReady: (data) => {
            if (data.actionId === voipModalActionId && data.summary) {
                setVoipEnrichmentSummary(data.summary);
            }
        },
    });

    // Auto-focus note textarea when result requiring note is selected
    useEffect(() => {
        if (newActionResult && getRequiresNote(newActionResult)) {
            setTimeout(() => noteRef.current?.focus(), 50);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newActionResult]);

    const toggleNoteExpand = (actionId: string) => {
        setExpandedNotes((prev) => {
            const next = new Set(prev);
            if (next.has(actionId)) next.delete(actionId);
            else next.add(actionId);
            return next;
        });
    };

    // ── Data fetching ──────────────────────────────────────────────────────────

    useEffect(() => {
        if (!isOpen || !companyId) {
            setContact(null);
            setCompany(null);
            setActions([]);
            setIsEditingContact(false);
            setIsEditingCompany(false);
            return;
        }
        const controller = new AbortController();
        const { signal } = controller;
        setLoading(true);

        fetch(`/api/companies/${companyId}`, { signal })
            .then((r) => r.json())
            .then((j) => {
                if (!signal.aborted && j.success && j.data) setCompany(j.data);
            })
            .catch((e) => {
                if ((e as Error).name !== "AbortError") {
                    setCompany(null);
                    showError("Impossible de charger la société");
                }
            })
            .finally(() => { if (!signal.aborted) setLoading(false); });

        if (contactId) {
            fetch(`/api/contacts/${contactId}`, { signal })
                .then((r) => r.json())
                .then((j) => {
                    if (!signal.aborted && j.success && j.data) setContact(j.data);
                })
                .catch((e) => {
                    if ((e as Error).name !== "AbortError") {
                        setContact(null);
                        showError("Impossible de charger le contact");
                    }
                });
            setActiveTab("contact");
        } else {
            setContact(null);
            setActiveTab("company");
        }

        return () => controller.abort();
    }, [isOpen, contactId, companyId, showError, retryKey]);

    useEffect(() => {
        if (!isOpen) { setActions([]); return; }
        const controller = new AbortController();
        const { signal } = controller;
        setActionsLoading(true);
        const q = contactId ? `contactId=${contactId}` : `companyId=${companyId}`;
        fetch(`/api/actions?${q}&limit=10`, { signal })
            .then((r) => r.json())
            .then((j) => {
                if (!signal.aborted) setActions(j.success && Array.isArray(j.data) ? j.data : []);
            })
            .catch((e) => {
                if ((e as Error).name !== "AbortError") {
                    setActions([]);
                    showError("Impossible de charger l'historique des actions");
                }
            })
            .finally(() => { if (!signal.aborted) setActionsLoading(false); });
        return () => controller.abort();
    }, [isOpen, contactId, companyId, showError]);

    const refetchActions = useCallback(() => {
        if (!contactId && !companyId) return;
        setActionsLoading(true);
        const q = contactId ? `contactId=${contactId}` : `companyId=${companyId}`;
        fetch(`/api/actions?${q}&limit=10`)
            .then((r) => r.json())
            .then((j) => { if (j.success && Array.isArray(j.data)) setActions(j.data); })
            .catch(() => showError("Impossible de rafraîchir l'historique"))
            .finally(() => setActionsLoading(false));
    }, [contactId, companyId, showError]);

    useEffect(() => {
        if (!isOpen || !actions.length) return;
        const toSync = actions
            .filter((a) => a.channel === "CALL" && a.voipProvider === "allo" && !a.voipSummary && !a.note)
            .map((a) => a.id)
            .filter((id) => !syncedAlloActionIdsRef.current.has(id));
        toSync.forEach((id) => syncedAlloActionIdsRef.current.add(id));
        if (!toSync.length) return;
        Promise.allSettled(
            toSync.map((actionId) =>
                fetch("/api/voip/allo/sync-call", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ actionId }),
                })
            )
        ).then(() => refetchActions());
    }, [isOpen, actions, refetchActions]);

    useEffect(() => {
        if (!isOpen || !missionId) { setCampaigns([]); return; }
        const controller = new AbortController();
        const { signal } = controller;
        setCampaignsLoading(true);
        fetch(`/api/campaigns?missionId=${missionId}&isActive=true&limit=50`, { signal })
            .then((r) => r.json())
            .then((j) => {
                if (!signal.aborted) setCampaigns(j.success && Array.isArray(j.data) ? j.data : []);
            })
            .catch((e) => {
                if ((e as Error).name !== "AbortError") {
                    setCampaigns([]);
                    showError("Impossible de charger les campagnes");
                }
            })
            .finally(() => { if (!signal.aborted) setCampaignsLoading(false); });
        return () => controller.abort();
    }, [isOpen, missionId, showError]);

    useEffect(() => {
        if (!isOpen || !missionId) { setStatusConfig(null); return; }
        const controller = new AbortController();
        const { signal } = controller;
        fetch(`/api/config/action-statuses?missionId=${missionId}`, { signal })
            .then((r) => r.json())
            .then((j) => {
                if (!signal.aborted)
                    setStatusConfig(j.success && j.data?.statuses ? { statuses: j.data.statuses } : null);
            })
            .catch((e) => {
                if ((e as Error).name !== "AbortError") {
                    setStatusConfig(null);
                    showError("Impossible de charger la configuration des statuts");
                }
            });
        return () => controller.abort();
    }, [isOpen, missionId, showError]);

    // ── Derived state ──────────────────────────────────────────────────────────

    const getRequiresNote = useCallback(
        (code: string) =>
            statusConfig?.statuses?.find((s) => s.code === code)?.requiresNote ??
            ["INTERESTED", "CALLBACK_REQUESTED", "ENVOIE_MAIL"].includes(code),
        [statusConfig]
    );

    const statusOptions = useMemo(
        () =>
            statusConfig?.statuses?.length
                ? statusConfig.statuses.map((s) => ({ value: s.code, label: s.label }))
                : Object.entries(ACTION_RESULT_LABELS).map(([value, label]) => ({ value, label })),
        [statusConfig]
    );

    const statusLabels = useMemo<Record<string, string>>(
        () =>
            statusConfig?.statuses?.length
                ? Object.fromEntries(statusConfig.statuses.map((s) => [s.code, s.label]))
                : { ...ACTION_RESULT_LABELS },
        [statusConfig]
    );

    const primaryPhone = useMemo(() => {
        if (contact?.phone) return { number: contact.phone, label: "Contact" };
        if (company?.phone) return { number: company.phone, label: "Société" };
        return null;
    }, [contact, company]);

    const primaryEmail = useMemo(() => {
        if (contact?.email) return contact.email;
        return company?.contacts?.find((c) => c.email)?.email ?? null;
    }, [contact, company]);

    const displayName = useMemo(() => {
        if (contact) {
            const n = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
            return n || company?.name || "Sans nom";
        }
        return company?.name || "Sans nom";
    }, [contact, company]);

    const hasPriorCall = useMemo(
        () => actions.some((a) => a.channel === "CALL"),
        [actions]
    );

    const priorCallActions = useMemo(
        () =>
            actions
                .filter((a) => a.channel === "CALL")
                .sort(
                    (a, b) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
                .slice(0, 3),
        [actions]
    );

    const noteRequiredForResult = newActionResult ? getRequiresNote(newActionResult) : false;
    const notePlaceholder = useMemo(() => {
        switch (newActionResult) {
            case "INTERESTED": return "Qu'est-ce qui a suscité l'intérêt ? Prochaine étape ?";
            case "CALLBACK_REQUESTED": return "À quel sujet rappeler ? Date souhaitée ?";
            case "DISQUALIFIED": return "Pourquoi ce contact est-il disqualifié ?";
            case "MEETING_BOOKED": return "Détails du rendez-vous planifié...";
            case "ENVOIE_MAIL": return "Objet et résumé de l'email envoyé...";
            default: return "Ajouter une note optionnelle...";
        }
    }, [newActionResult]);

    // ── Actions ────────────────────────────────────────────────────────────────

    const handleImproveNote = async () => {
        const trimmed = newActionNote.trim();
        if (!trimmed) return;
        setIsImprovingNote(true);
        try {
            const res = await fetch("/api/ai/mistral/note-improve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: trimmed }),
            });
            const json = await res.json();
            if (json.success && json.data?.improvedText) {
                setNewActionNote(json.data.improvedText);
            } else {
                showError("Erreur", json.error || "Impossible d'améliorer la note");
            }
        } catch {
            showError("Erreur", "Connexion à l'IA impossible");
        } finally {
            setIsImprovingNote(false);
        }
    };

    const handleAddAction = async (andNext?: boolean) => {
        const campaignId = campaigns[0]?.id;
        if (!campaignId) {
            showError("Erreur", "Aucune campagne disponible pour cette mission");
            return;
        }
        if (!newActionResult) {
            showError("Erreur", "Sélectionnez un résultat");
            return;
        }
        if (noteRequiredForResult && !newActionNote.trim()) {
            showError("Erreur", "Une note est requise pour ce résultat");
            noteRef.current?.focus();
            return;
        }
        setNewActionSaving(true);
        try {
            const selectedCampaign = campaigns[0];
            const channel = (selectedCampaign?.mission?.channel ?? "CALL") as "CALL" | "EMAIL" | "LINKEDIN";
            const res = await fetch("/api/actions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactId: contactId || undefined,
                    companyId: contactId ? undefined : companyId,
                    campaignId,
                    channel: newActionResult === "ENVOIE_MAIL" ? "EMAIL" : channel,
                    result: newActionResult,
                    note: newActionNote.trim() || undefined,
                    callbackDate:
                        newActionResult === "CALLBACK_REQUESTED" && newCallbackDateValue
                            ? new Date(newCallbackDateValue).toISOString()
                            : newActionResult === "MEETING_BOOKED" && rdvDate
                                ? new Date(rdvDate).toISOString()
                                : undefined,
                    ...(newActionResult === "MEETING_BOOKED" && {
                        meetingType: meetingType || undefined,
                        meetingCategory: meetingCat || undefined,
                        meetingAddress: meetingAddress?.trim() || undefined,
                        meetingJoinUrl: meetingJoinUrl?.trim() || undefined,
                        meetingPhone: meetingPhone?.trim() || undefined,
                    }),
                }),
            });
            const json = await res.json();
            if (json.success) {
                success("Action enregistrée", "L'action a été ajoutée à l'historique");
                setNewActionNote("");
                setNewActionResult("");
                setNewCallbackDateValue("");
                setActions((prev) => [
                    {
                        id: json.data.id,
                        result: json.data.result,
                        note: json.data.note ?? null,
                        createdAt: json.data.createdAt,
                        campaign: json.data.campaign,
                    },
                    ...prev,
                ]);
                onActionRecorded?.();
                if (andNext && onValidateAndNext) onValidateAndNext();
            } else {
                showError("Erreur", json.error || "Impossible d'enregistrer l'action");
            }
        } catch {
            showError("Erreur", "Impossible d'enregistrer l'action");
        } finally {
            setNewActionSaving(false);
        }
    };

    const handleSaveContact = async () => {
        if (!contactId) return;
        setSavingContact(true);
        try {
            const payload = {
                ...editContactData,
                additionalPhones: (editContactData.additionalPhones ?? []).filter(Boolean),
                additionalEmails: (editContactData.additionalEmails ?? []).filter(Boolean),
            };
            const res = await fetch(`/api/contacts/${contactId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (json.success) {
                setContact({ ...contact!, ...editContactData });
                setIsEditingContact(false);
                success("Succès", "Contact mis à jour");
            } else {
                showError("Erreur", json.error || "Impossible de mettre à jour le contact");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setSavingContact(false);
        }
    };

    const handleSaveCompany = async () => {
        if (!companyId) return;
        setSavingCompany(true);
        try {
            const res = await fetch(`/api/companies/${companyId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editCompanyData),
            });
            const json = await res.json();
            if (json.success) {
                setCompany({ ...company!, ...editCompanyData });
                setIsEditingCompany(false);
                success("Succès", "Société mise à jour");
            } else {
                showError("Erreur", json.error || "Impossible de mettre à jour la société");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setSavingCompany(false);
        }
    };

    // ── Render guards ──────────────────────────────────────────────────────────

    if (!isOpen) return null;

    const canSubmit =
        !!newActionResult &&
        (!noteRequiredForResult || newActionNote.trim().length > 0) &&
        !newActionSaving;

    const visibleActions = historyExpanded ? actions : actions.slice(0, 5);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={displayName}
            description={missionName ? `Mission : ${missionName}` : undefined}
            size="lg"
        >
            {loading ? (
                <div className="space-y-5 p-1">
                    <div className="flex gap-3">
                        <TextSkeleton lines={2} className="flex-1" />
                        <TextSkeleton lines={1} className="w-20" />
                    </div>
                    <ListSkeleton items={3} hasAvatar className="mt-2" />
                    <TextSkeleton lines={4} />
                </div>
            ) : (companyId && !company) || (contactId && !contact) ? (
                /* ── Error state ── */
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
                        <AlertCircle className="w-7 h-7 text-amber-500" />
                    </div>
                    <p className="text-slate-800 font-semibold mb-1">Données inaccessibles</p>
                    <p className="text-sm text-slate-500 mb-5 max-w-xs">
                        Vérifiez votre connexion et réessayez.
                    </p>
                    <Button
                        variant="secondary"
                        onClick={() => setRetryKey((k) => k + 1)}
                        className="gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Réessayer
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col gap-4 pb-4">

                    {/* ── Prior call badge + quick history hint ── */}
                    {hasPriorCall && (
                        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                        <PhoneCall className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>Déjà appelé</span>
                                    </div>
                                    <p className="text-xs text-emerald-800">
                                        Un ou plusieurs appels ont déjà eu lieu avec {contactId ? "ce contact" : "cette société"}.
                                    </p>
                                </div>
                                {priorCallActions.length > 0 && (
                                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-emerald-800">
                                        {priorCallActions.map((a) => (
                                            <li key={a.id} className="flex items-center gap-1.5 flex-wrap">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                                <span className="font-semibold">
                                                    {statusLabels[a.result] ?? a.result}
                                                </span>
                                                <span className="text-emerald-800/70">
                                                    ·{" "}
                                                    {new Date(a.createdAt).toLocaleDateString("fr-FR", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                    })}{" "}
                                                    {new Date(a.createdAt).toLocaleTimeString("fr-FR", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                                {a.sdr?.name && (
                                                    <span className="text-emerald-800/70">
                                                        · par <span className="font-medium">{a.sdr.name}</span>
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setHistoryExpanded(true)}
                                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 px-2.5 py-1 rounded-full transition-colors"
                            >
                                <History className="w-3 h-3" aria-hidden="true" />
                                <span>Voir l&apos;historique</span>
                            </button>
                        </div>
                    )}

                    {/* ── Quick Action Bar ── */}
                    <section
                        aria-label="Actions rapides"
                        className="flex flex-wrap gap-2"
                    >
                        {primaryPhone && (
                            <button
                                type="button"
                                disabled={voipState === "initiating"}
                                aria-label={`Appeler ${primaryPhone.number}`}
                                onClick={async () => {
                                    const campaignId = campaigns[0]?.id;
                                    if (campaignId && userId) {
                                        try {
                                            await voipInitiate({
                                                contactId: contactId ?? undefined,
                                                companyId: contactId ? undefined : companyId,
                                                phone: primaryPhone.number,
                                                campaignId,
                                                missionId: missionId ?? undefined,
                                            });
                                        } catch {
                                            window.open(`tel:${primaryPhone.number}`, "_self");
                                        }
                                    } else {
                                        window.open(`tel:${primaryPhone.number}`, "_self");
                                    }
                                }}
                                className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-all duration-150 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                            >
                                {voipState === "initiating" ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                        <span>Connexion…</span>
                                    </>
                                ) : (
                                    <>
                                        <PhoneCall className="w-4 h-4" aria-hidden="true" />
                                        <span>Appeler</span>
                                        {primaryPhone.label === "Société" && (
                                            <span className="text-xs opacity-75 font-normal">
                                                (société)
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        )}

                        {primaryEmail && (
                            <a
                                href={`mailto:${primaryEmail}`}
                                aria-label={`Envoyer un email à ${primaryEmail}`}
                                className="flex-1 min-w-[110px] flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                            >
                                <Send className="w-4 h-4" aria-hidden="true" />
                                Email
                            </a>
                        )}

                        {(contact?.linkedin || company?.website) && (
                            <a
                                href={
                                    contact?.linkedin
                                        ? contact.linkedin.startsWith("http")
                                            ? contact.linkedin
                                            : `https://${contact.linkedin}`
                                        : company?.website?.startsWith("http")
                                            ? company.website
                                            : `https://${company?.website}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={contact?.linkedin ? "Ouvrir le profil LinkedIn" : "Ouvrir le site web"}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-sm shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
                            >
                                {contact?.linkedin ? (
                                    <Linkedin className="w-4 h-4 text-blue-600" aria-hidden="true" />
                                ) : (
                                    <Globe className="w-4 h-4 text-slate-500" aria-hidden="true" />
                                )}
                                {contact?.linkedin ? "LinkedIn" : "Site web"}
                            </a>
                        )}
                    </section>

                    {/* ── Tab Navigation ── */}
                    {contact && (
                        <div
                            role="tablist"
                            aria-label="Informations"
                            className="flex rounded-xl bg-slate-100 p-1 gap-1"
                        >
                            <button
                                role="tab"
                                id="tab-contact"
                                aria-selected={activeTab === "contact"}
                                aria-controls="tabpanel-contact"
                                onClick={() => setActiveTab("contact")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                                    activeTab === "contact"
                                        ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/8"
                                        : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                <User className="w-4 h-4" aria-hidden="true" />
                                Contact
                            </button>
                            <button
                                role="tab"
                                id="tab-company"
                                aria-selected={activeTab === "company"}
                                aria-controls="tabpanel-company"
                                onClick={() => setActiveTab("company")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                                    activeTab === "company"
                                        ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/8"
                                        : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                <Building2 className="w-4 h-4" aria-hidden="true" />
                                Société
                            </button>
                        </div>
                    )}

                    {/* ── Contact Tab ── */}
                    {activeTab === "contact" && contact && (
                        <section
                            id="tabpanel-contact"
                            role="tabpanel"
                            aria-labelledby="tab-contact"
                            className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                        >
                            {/* Contact header */}
                            <div className="flex items-start gap-4 p-4 border-b border-slate-100">
                                <div
                                    className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-base font-bold text-indigo-700 shadow-sm shrink-0"
                                    aria-hidden="true"
                                >
                                    {(contact.firstName?.[0] || contact.lastName?.[0] || "?").toUpperCase()}
                                </div>

                                <div className="flex-1 min-w-0">
                                    {isEditingContact ? (
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={editContactData.firstName || ""}
                                                    onChange={(e) =>
                                                        setEditContactData({ ...editContactData, firstName: e.target.value })
                                                    }
                                                    placeholder="Prénom"
                                                    aria-label="Prénom"
                                                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                                                />
                                                <input
                                                    type="text"
                                                    value={editContactData.lastName || ""}
                                                    onChange={(e) =>
                                                        setEditContactData({ ...editContactData, lastName: e.target.value })
                                                    }
                                                    placeholder="Nom"
                                                    aria-label="Nom de famille"
                                                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                value={editContactData.title || ""}
                                                onChange={(e) =>
                                                    setEditContactData({ ...editContactData, title: e.target.value })
                                                }
                                                placeholder="Titre / Poste"
                                                aria-label="Titre ou poste"
                                                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                                                {contact.firstName || ""} {contact.lastName || ""}
                                                {!contact.firstName && !contact.lastName && (
                                                    <span className="text-slate-400 italic font-normal">Sans nom</span>
                                                )}
                                            </h3>
                                            {contact.title && (
                                                <p className="text-xs text-slate-500 mt-0.5">{contact.title}</p>
                                            )}
                                            <div className="mt-1.5">
                                                <StatusPill status={contact.status} />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex gap-1 shrink-0">
                                    {isEditingContact ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingContact(false)}
                                                disabled={savingContact}
                                                aria-label="Annuler les modifications"
                                                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                                            >
                                                <X className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveContact}
                                                disabled={savingContact}
                                                aria-label="Sauvegarder le contact"
                                                className="w-8 h-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                                            >
                                                {savingContact ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                                ) : (
                                                    <Save className="w-4 h-4" aria-hidden="true" />
                                                )}
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditContactData({
                                                    firstName: contact.firstName,
                                                    lastName: contact.lastName,
                                                    title: contact.title,
                                                    email: contact.email,
                                                    phone: contact.phone,
                                                    additionalPhones: Array.isArray(contact.additionalPhones) ? contact.additionalPhones : [],
                                                    additionalEmails: Array.isArray(contact.additionalEmails) ? contact.additionalEmails : [],
                                                    linkedin: contact.linkedin,
                                                });
                                                setIsEditingContact(true);
                                            }}
                                            aria-label="Modifier le contact"
                                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                                        >
                                            <Pencil className="w-4 h-4" aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Contact fields */}
                            <div>
                                {(contact.phone || isEditingContact) && (
                                    <InfoRow
                                        icon={Phone}
                                        iconColor="text-emerald-600"
                                        iconBg="bg-emerald-50"
                                        label="Téléphone"
                                        editing={isEditingContact}
                                        action={
                                            !isEditingContact && contact.phone ? (
                                                <CopyButton text={contact.phone} label="Téléphone" />
                                            ) : undefined
                                        }
                                    >
                                        {isEditingContact ? (
                                            <input
                                                type="tel"
                                                value={editContactData.phone || ""}
                                                onChange={(e) =>
                                                    setEditContactData({ ...editContactData, phone: e.target.value })
                                                }
                                                placeholder="Numéro de téléphone"
                                                aria-label="Téléphone principal"
                                                className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                                            />
                                        ) : (
                                            <a
                                                href={`tel:${contact.phone}`}
                                                className="text-sm font-medium text-emerald-600 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 rounded"
                                            >
                                                {contact.phone}
                                            </a>
                                        )}
                                    </InfoRow>
                                )}

                                {(contact.email || isEditingContact) && (
                                    <InfoRow
                                        icon={Mail}
                                        iconColor="text-indigo-600"
                                        iconBg="bg-indigo-50"
                                        label="Email"
                                        editing={isEditingContact}
                                        action={
                                            !isEditingContact && contact.email ? (
                                                <CopyButton text={contact.email} label="Email" />
                                            ) : undefined
                                        }
                                    >
                                        {isEditingContact ? (
                                            <input
                                                type="email"
                                                value={editContactData.email || ""}
                                                onChange={(e) =>
                                                    setEditContactData({ ...editContactData, email: e.target.value })
                                                }
                                                placeholder="Adresse email"
                                                aria-label="Email principal"
                                                className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                                            />
                                        ) : (
                                            <a
                                                href={`mailto:${contact.email}`}
                                                className="text-sm font-medium text-indigo-600 hover:underline truncate block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
                                            >
                                                {contact.email}
                                            </a>
                                        )}
                                    </InfoRow>
                                )}

                                {/* Additional phones */}
                                {(isEditingContact
                                    ? (editContactData.additionalPhones?.length ?? 0) > 0
                                    : Array.isArray(contact.additionalPhones) &&
                                    contact.additionalPhones.filter(Boolean).length > 0) && (
                                        <div className="px-4 py-3 border-b border-slate-100">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                                                <Phone className="w-3 h-3 text-emerald-500" aria-hidden="true" />
                                                Autres numéros
                                            </p>
                                            {isEditingContact ? (
                                                <div className="space-y-2">
                                                    {(editContactData.additionalPhones ?? []).map((num, idx) => (
                                                        <div key={idx} className="flex gap-2">
                                                            <input
                                                                type="tel"
                                                                value={num}
                                                                aria-label={`Numéro supplémentaire ${idx + 1}`}
                                                                onChange={(e) => {
                                                                    const next = [...(editContactData.additionalPhones ?? [])];
                                                                    next[idx] = e.target.value;
                                                                    setEditContactData({ ...editContactData, additionalPhones: next });
                                                                }}
                                                                placeholder="Numéro"
                                                                className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                            />
                                                            <button
                                                                type="button"
                                                                aria-label="Supprimer ce numéro"
                                                                onClick={() =>
                                                                    setEditContactData({
                                                                        ...editContactData,
                                                                        additionalPhones: (editContactData.additionalPhones ?? []).filter((_, i) => i !== idx),
                                                                    })
                                                                }
                                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setEditContactData({
                                                                ...editContactData,
                                                                additionalPhones: [...(editContactData.additionalPhones ?? []), ""],
                                                            })
                                                        }
                                                        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                                        Ajouter un numéro
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(contact.additionalPhones ?? []).filter(Boolean).map((num, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs"
                                                        >
                                                            <a href={`tel:${num}`} className="text-emerald-700 hover:underline font-medium">
                                                                {num}
                                                            </a>
                                                            <CopyButton text={num} label="Numéro" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                {isEditingContact && (editContactData.additionalPhones?.length ?? 0) === 0 && (
                                    <div className="px-4 py-3 border-b border-slate-100">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
                                            Autres numéros
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditContactData({
                                                    ...editContactData,
                                                    additionalPhones: [""],
                                                })
                                            }
                                            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
                                        >
                                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                            Ajouter un numéro
                                        </button>
                                    </div>
                                )}

                                {/* Additional emails */}
                                {(isEditingContact
                                    ? (editContactData.additionalEmails?.length ?? 0) > 0
                                    : Array.isArray(contact.additionalEmails) &&
                                    contact.additionalEmails.filter(Boolean).length > 0) && (
                                        <div className="px-4 py-3 border-b border-slate-100">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                                                <Mail className="w-3 h-3 text-indigo-500" aria-hidden="true" />
                                                Autres emails
                                            </p>
                                            {isEditingContact ? (
                                                <div className="space-y-2">
                                                    {(editContactData.additionalEmails ?? []).map((em, idx) => (
                                                        <div key={idx} className="flex gap-2">
                                                            <input
                                                                type="email"
                                                                value={em}
                                                                aria-label={`Email supplémentaire ${idx + 1}`}
                                                                onChange={(e) => {
                                                                    const next = [...(editContactData.additionalEmails ?? [])];
                                                                    next[idx] = e.target.value;
                                                                    setEditContactData({ ...editContactData, additionalEmails: next });
                                                                }}
                                                                placeholder="Email"
                                                                className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                            />
                                                            <button
                                                                type="button"
                                                                aria-label="Supprimer cet email"
                                                                onClick={() =>
                                                                    setEditContactData({
                                                                        ...editContactData,
                                                                        additionalEmails: (editContactData.additionalEmails ?? []).filter((_, i) => i !== idx),
                                                                    })
                                                                }
                                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setEditContactData({
                                                                ...editContactData,
                                                                additionalEmails: [...(editContactData.additionalEmails ?? []), ""],
                                                            })
                                                        }
                                                        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                                        Ajouter un email
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(contact.additionalEmails ?? []).filter(Boolean).map((em, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs"
                                                        >
                                                            <a
                                                                href={`mailto:${em}`}
                                                                className="text-indigo-700 hover:underline truncate max-w-[160px]"
                                                            >
                                                                {em}
                                                            </a>
                                                            <CopyButton text={em} label="Email" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                {isEditingContact && (editContactData.additionalEmails?.length ?? 0) === 0 && (
                                    <div className="px-4 py-3 border-b border-slate-100">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
                                            Autres emails
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditContactData({
                                                    ...editContactData,
                                                    additionalEmails: [""],
                                                })
                                            }
                                            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
                                        >
                                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                            Ajouter un email
                                        </button>
                                    </div>
                                )}

                                {(contact.linkedin || isEditingContact) && (
                                    <InfoRow
                                        icon={Linkedin}
                                        iconColor="text-blue-600"
                                        iconBg="bg-blue-50"
                                        label="LinkedIn"
                                        editing={isEditingContact}
                                        action={
                                            !isEditingContact && contact.linkedin ? (
                                                <a
                                                    href={
                                                        contact.linkedin.startsWith("http")
                                                            ? contact.linkedin
                                                            : `https://${contact.linkedin}`
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label="Ouvrir LinkedIn dans un nouvel onglet"
                                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                                </a>
                                            ) : undefined
                                        }
                                    >
                                        {isEditingContact ? (
                                            <input
                                                type="url"
                                                value={editContactData.linkedin || ""}
                                                onChange={(e) =>
                                                    setEditContactData({ ...editContactData, linkedin: e.target.value })
                                                }
                                                placeholder="URL LinkedIn"
                                                aria-label="Profil LinkedIn"
                                                className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                            />
                                        ) : (
                                            <a
                                                href={
                                                    contact.linkedin!.startsWith("http")
                                                        ? contact.linkedin!
                                                        : `https://${contact.linkedin}`
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm font-medium text-blue-600 hover:underline truncate block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 rounded"
                                            >
                                                Voir le profil
                                            </a>
                                        )}
                                    </InfoRow>
                                )}

                                {/* Contact custom data */}
                                {contact.customData &&
                                    typeof contact.customData === "object" &&
                                    Object.keys(contact.customData).length > 0 &&
                                    !isEditingContact && (
                                        <div className="px-4 py-3 bg-slate-50/60">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                                                <FileText className="w-3 h-3" aria-hidden="true" />
                                                Infos supplémentaires
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.entries(contact.customData as Record<string, unknown>).map(
                                                    ([key, value]) => {
                                                        if (value == null || value === "") return null;
                                                        return (
                                                            <div
                                                                key={key}
                                                                className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] text-slate-700"
                                                            >
                                                                <span className="font-semibold text-slate-500 mr-1">
                                                                    {formatCustomLabel(key)}:
                                                                </span>
                                                                <span>{String(value)}</span>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </div>
                                    )}

                                {!isEditingContact &&
                                    !contact.phone &&
                                    !contact.email &&
                                    !contact.linkedin &&
                                    !(contact.additionalPhones?.filter(Boolean).length) &&
                                    !(contact.additionalEmails?.filter(Boolean).length) && (
                                        <div className="flex flex-col items-center py-8 text-slate-400">
                                            <Info className="w-8 h-8 mb-2 opacity-40" aria-hidden="true" />
                                            <p className="text-sm">Aucune information de contact</p>
                                        </div>
                                    )}
                            </div>
                        </section>
                    )}

                    {/* ── Company Tab ── */}
                    {(activeTab === "company" || !contact) && company && (
                        <section
                            id="tabpanel-company"
                            role="tabpanel"
                            aria-labelledby="tab-company"
                            className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                        >
                            {/* No contact prompt */}
                            {!contact && (
                                <div className="mx-4 mt-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                                            <User className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900 text-sm">
                                                Aucun contact associé
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Ajoutez un contact pour enregistrer des actions.
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        onClick={() => setShowAddContact(true)}
                                        className="gap-2 shrink-0"
                                    >
                                        <Plus className="w-4 h-4" aria-hidden="true" />
                                        Ajouter
                                    </Button>
                                </div>
                            )}

                            {/* Company header */}
                            <div className="flex items-start gap-4 p-4 border-b border-slate-100">
                                <div
                                    className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center shrink-0 shadow-sm"
                                    aria-hidden="true"
                                >
                                    <Building2 className="w-5 h-5 text-violet-700" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    {isEditingCompany ? (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={editCompanyData.name || ""}
                                                onChange={(e) =>
                                                    setEditCompanyData({ ...editCompanyData, name: e.target.value })
                                                }
                                                placeholder="Nom de la société"
                                                aria-label="Nom de la société"
                                                className="w-full px-2.5 py-1.5 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                                            />
                                            <input
                                                type="text"
                                                value={editCompanyData.industry || ""}
                                                onChange={(e) =>
                                                    setEditCompanyData({ ...editCompanyData, industry: e.target.value })
                                                }
                                                placeholder="Secteur d'activité"
                                                aria-label="Secteur d'activité"
                                                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                                                {company.name}
                                            </h3>
                                            {company.industry && (
                                                <p className="text-xs text-slate-500 mt-0.5">{company.industry}</p>
                                            )}
                                            <div className="mt-1.5">
                                                <StatusPill status={company.status} />
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    {isEditingCompany ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingCompany(false)}
                                                disabled={savingCompany}
                                                aria-label="Annuler les modifications"
                                                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                                            >
                                                <X className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveCompany}
                                                disabled={savingCompany}
                                                aria-label="Sauvegarder la société"
                                                className="w-8 h-8 flex items-center justify-center bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                                            >
                                                {savingCompany ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                                ) : (
                                                    <Save className="w-4 h-4" aria-hidden="true" />
                                                )}
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditCompanyData({
                                                    name: company.name,
                                                    industry: company.industry,
                                                    country: company.country,
                                                    website: company.website,
                                                    size: company.size,
                                                    phone: company.phone,
                                                });
                                                setIsEditingCompany(true);
                                            }}
                                            aria-label="Modifier la société"
                                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                                        >
                                            <Pencil className="w-4 h-4" aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Company fields */}
                            <div>
                                {(company.phone || isEditingCompany) && (
                                    <InfoRow
                                        icon={Phone}
                                        iconColor="text-emerald-600"
                                        iconBg="bg-emerald-50"
                                        label="Téléphone"
                                        editing={isEditingCompany}
                                        action={
                                            !isEditingCompany && company.phone ? (
                                                <CopyButton text={company.phone} label="Téléphone société" />
                                            ) : undefined
                                        }
                                    >
                                        {isEditingCompany ? (
                                            <input
                                                type="tel"
                                                value={editCompanyData.phone || ""}
                                                onChange={(e) =>
                                                    setEditCompanyData({ ...editCompanyData, phone: e.target.value })
                                                }
                                                placeholder="Numéro de téléphone"
                                                aria-label="Téléphone de la société"
                                                className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                                            />
                                        ) : (
                                            <a
                                                href={`tel:${company.phone}`}
                                                className="text-sm font-medium text-emerald-600 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 rounded"
                                            >
                                                {company.phone}
                                            </a>
                                        )}
                                    </InfoRow>
                                )}

                                {(company.website || isEditingCompany) && (
                                    <InfoRow
                                        icon={Globe}
                                        iconColor="text-indigo-600"
                                        iconBg="bg-indigo-50"
                                        label="Site web"
                                        editing={isEditingCompany}
                                        action={
                                            !isEditingCompany && company.website ? (
                                                <a
                                                    href={
                                                        company.website.startsWith("http")
                                                            ? company.website
                                                            : `https://${company.website}`
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label="Ouvrir le site web dans un nouvel onglet"
                                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                                </a>
                                            ) : undefined
                                        }
                                    >
                                        {isEditingCompany ? (
                                            <input
                                                type="url"
                                                value={editCompanyData.website || ""}
                                                onChange={(e) =>
                                                    setEditCompanyData({ ...editCompanyData, website: e.target.value })
                                                }
                                                placeholder="Site web"
                                                aria-label="Site web de la société"
                                                className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                                            />
                                        ) : (
                                            <a
                                                href={
                                                    company.website!.startsWith("http")
                                                        ? company.website!
                                                        : `https://${company.website}`
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm font-medium text-indigo-600 hover:underline truncate block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
                                            >
                                                {company.website}
                                            </a>
                                        )}
                                    </InfoRow>
                                )}

                                {/* Country + Size grid */}
                                <div className="grid grid-cols-2 border-b border-slate-100">
                                    <div className="flex items-center gap-3 px-4 py-3 border-r border-slate-100 hover:bg-slate-50/60 transition-colors">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                        <div className="w-full">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Pays</p>
                                            {isEditingCompany ? (
                                                <input
                                                    type="text"
                                                    value={editCompanyData.country || ""}
                                                    onChange={(e) =>
                                                        setEditCompanyData({ ...editCompanyData, country: e.target.value })
                                                    }
                                                    placeholder="Pays"
                                                    aria-label="Pays"
                                                    className="w-full mt-0.5 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                                                />
                                            ) : (
                                                <p className="text-sm font-medium text-slate-700">{company.country || "—"}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                        <div className="w-full">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Effectif</p>
                                            {isEditingCompany ? (
                                                <input
                                                    type="text"
                                                    value={editCompanyData.size || ""}
                                                    onChange={(e) =>
                                                        setEditCompanyData({ ...editCompanyData, size: e.target.value })
                                                    }
                                                    placeholder="Taille"
                                                    aria-label="Taille de l'effectif"
                                                    className="w-full mt-0.5 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                                                />
                                            ) : (
                                                <p className="text-sm font-medium text-slate-700">{company.size || "—"}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Company custom data */}
                                {company.customData &&
                                    typeof company.customData === "object" &&
                                    Object.keys(company.customData).length > 0 &&
                                    !isEditingCompany && (
                                        <div className="px-4 py-3 bg-slate-50/60">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                                                <FileText className="w-3 h-3" aria-hidden="true" />
                                                Infos supplémentaires
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.entries(company.customData as Record<string, unknown>).map(
                                                    ([key, value]) => {
                                                        if (value == null || value === "") return null;
                                                        return (
                                                            <div
                                                                key={key}
                                                                className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] text-slate-700"
                                                            >
                                                                <span className="font-semibold text-slate-500 mr-1">
                                                                    {formatCustomLabel(key)}:
                                                                </span>
                                                                <span>{String(value)}</span>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </div>
                                    )}

                                {/* Other contacts */}
                                {company.contacts?.length > 0 && (
                                    <div className="px-4 py-3 border-t border-slate-100">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                                            <Users className="w-3 h-3" aria-hidden="true" />
                                            Autres contacts ({company.contacts.length})
                                        </p>
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                            {company.contacts.slice(0, 5).map((c) => (
                                                <div
                                                    key={c.id}
                                                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer"
                                                    onClick={() => onContactSelect?.(c.id)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            onContactSelect?.(c.id);
                                                        }
                                                    }}
                                                >
                                                    <div
                                                        className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0"
                                                        aria-hidden="true"
                                                    >
                                                        {(c.firstName?.[0] || c.lastName?.[0] || "?").toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                                                            {c.firstName || ""} {c.lastName || ""}
                                                        </p>
                                                        {c.title && (
                                                            <p className="text-xs text-slate-400 truncate">{c.title}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                        {c.phone && (
                                                            <a
                                                                href={`tel:${c.phone}`}
                                                                aria-label={`Appeler ${c.firstName || c.lastName || "contact"}`}
                                                                className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                                            >
                                                                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                                                            </a>
                                                        )}
                                                        {c.email && (
                                                            <a
                                                                href={`mailto:${c.email}`}
                                                                aria-label={`Envoyer un email à ${c.firstName || c.lastName || "contact"}`}
                                                                className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            >
                                                                <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ── Record Action Section ── */}
                    <section
                        aria-label="Enregistrer une action"
                        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                    >
                        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
                            <div
                                className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center"
                                aria-hidden="true"
                            >
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                            <h2 className="text-sm font-semibold text-slate-900">Enregistrer une action</h2>
                        </div>

                        <div className="p-4">
                            {campaignsLoading ? (
                                <div className="space-y-3 py-2">
                                    <TextSkeleton lines={1} className="h-9 w-full" />
                                    <TextSkeleton lines={2} />
                                </div>
                            ) : campaigns.length === 0 ? (
                                <p className="text-sm text-slate-500 py-4 text-center">
                                    Aucune campagne disponible pour cette mission.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {/* Outcome chips */}
                                    <fieldset>
                                        <legend className="text-xs font-semibold text-slate-600 mb-2">
                                            Résultat <span className="text-red-500">*</span>
                                        </legend>
                                        <div
                                            className="flex flex-wrap gap-2"
                                            role="group"
                                            aria-label="Sélectionnez le résultat de l'action"
                                        >
                                            {statusOptions.map((opt) => {
                                                const cfg =
                                                    RESULT_CHIP_CONFIG[opt.value] ||
                                                    RESULT_CHIP_CONFIG.NO_RESPONSE;
                                                const Icon = cfg.icon;
                                                const isSelected = newActionResult === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={isSelected}
                                                        onClick={() => {
                                                            setNewActionResult(opt.value);
                                                            if (opt.value === "ENVOIE_MAIL") onOpenEmailModal?.();
                                                        }}
                                                        className={cn(
                                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                                                            isSelected
                                                                ? cn(
                                                                    cfg.selectedBg,
                                                                    cfg.selectedText,
                                                                    cfg.selectedBorder,
                                                                    "ring-1",
                                                                    `focus-visible:ring-${cfg.dot.replace("bg-", "")}`
                                                                )
                                                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <Icon
                                                            className={cn("w-3.5 h-3.5 shrink-0", isSelected ? cfg.selectedText : "text-slate-400")}
                                                            aria-hidden="true"
                                                        />
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </fieldset>

                                    {/* Contextual: callback date */}
                                    {newActionResult === "CALLBACK_REQUESTED" && (
                                        <div
                                            role="group"
                                            aria-label="Date de rappel"
                                            className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5"
                                        >
                                            <DateTimePicker
                                                label="Date de rappel"
                                                value={newCallbackDateValue}
                                                onChange={setNewCallbackDateValue}
                                                placeholder="Choisir date et heure du rappel…"
                                                min={new Date().toISOString().slice(0, 16)}
                                                triggerClassName="border-amber-200 focus:ring-amber-400/40 focus:border-amber-400"
                                            />
                                            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                Optionnel. Vous pouvez aussi indiquer la date dans la note.
                                            </p>
                                        </div>
                                    )}

                                    {/* Contextual: meeting booking — always shown for MEETING_BOOKED */}
                                    {newActionResult === "MEETING_BOOKED" && (
                                        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 space-y-3">
                                            {/* Calendar button — only when a booking URL or at least one interlocuteur calendar exists */}
                                            {(clientBookingUrl || clientInterlocuteurs?.some(i => (i.bookingLinks?.length ?? 0) > 0)) && contactId && contact && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() => setShowBookingDrawer(true)}
                                                        className="gap-2 w-full"
                                                    >
                                                        <Calendar className="w-4 h-4" aria-hidden="true" />
                                                        Ouvrir le calendrier client
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Note */}
                                    <div>
                                        <label
                                            htmlFor="action-note"
                                            className="block text-xs font-semibold text-slate-600 mb-1.5"
                                        >
                                            Note
                                            {noteRequiredForResult && (
                                                <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                                            )}
                                            {noteRequiredForResult && (
                                                <span className="sr-only"> (obligatoire)</span>
                                            )}
                                        </label>
                                        <div className="relative">
                                            <textarea
                                                id="action-note"
                                                ref={noteRef}
                                                value={newActionNote}
                                                onChange={(e) => setNewActionNote(e.target.value)}
                                                placeholder={notePlaceholder}
                                                rows={3}
                                                maxLength={500}
                                                aria-required={noteRequiredForResult}
                                                aria-describedby="note-char-count"
                                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 resize-none transition-all"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between mt-1.5">
                                            <button
                                                type="button"
                                                onClick={handleImproveNote}
                                                disabled={!newActionNote.trim() || isImprovingNote}
                                                aria-label="Améliorer la note avec l'IA"
                                                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
                                            >
                                                {isImprovingNote ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                                                ) : (
                                                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                                                )}
                                                {isImprovingNote ? "Amélioration…" : "Améliorer avec l'IA"}
                                            </button>
                                            <p
                                                id="note-char-count"
                                                className="text-xs text-slate-400"
                                                aria-live="polite"
                                                aria-atomic="true"
                                            >
                                                {newActionNote.length}/500
                                            </p>
                                        </div>
                                    </div>

                                    {/* Submit — sticky feel via border-top separation */}
                                    <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-slate-100">
                                        <Button
                                            type="button"
                                            variant="primary"
                                            onClick={() => handleAddAction(false)}
                                            disabled={!canSubmit}
                                            isLoading={newActionSaving}
                                            className={cn("gap-2", onValidateAndNext ? "flex-1" : "w-full")}
                                        >
                                            <Check className="w-4 h-4" aria-hidden="true" />
                                            Enregistrer
                                        </Button>
                                        {onValidateAndNext && (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => handleAddAction(true)}
                                                disabled={!canSubmit}
                                                isLoading={newActionSaving}
                                                className="gap-2 flex-1"
                                            >
                                                <ChevronRight className="w-4 h-4" aria-hidden="true" />
                                                Valider et suivant
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ── History Section ── */}
                    <section
                        aria-label="Historique des actions"
                        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                    >
                        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
                            <div
                                className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"
                                aria-hidden="true"
                            >
                                <History className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <h2 className="text-sm font-semibold text-slate-900">Historique</h2>
                            {actions.length > 0 && (
                                <span
                                    className="ml-auto text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5"
                                    aria-label={`${actions.length} actions`}
                                >
                                    {actions.length}
                                </span>
                            )}
                        </div>

                        <div className="p-4" aria-live="polite">
                            {actionsLoading ? (
                                <ListSkeleton items={3} hasAvatar={false} className="py-1" />
                            ) : actions.length === 0 ? (
                                <div className="flex flex-col items-center py-8 text-slate-400">
                                    <History className="w-9 h-9 mb-2 opacity-30" aria-hidden="true" />
                                    <p className="text-sm">Aucune action enregistrée</p>
                                </div>
                            ) : (
                                <>
                                    <ol className="space-y-0 pl-5 relative" aria-label="Liste des actions">
                                        {/* Vertical timeline line */}
                                        <div
                                            className="absolute top-3 bottom-3 left-[9px] w-[2px] bg-slate-100 rounded-full"
                                            aria-hidden="true"
                                        />

                                        {visibleActions.map((a, index) => {
                                            const cfg =
                                                RESULT_CHIP_CONFIG[a.result] ||
                                                RESULT_CHIP_CONFIG.NO_RESPONSE;
                                            const Icon = cfg.icon;
                                            const isExpanded = expandedNotes.has(a.id);
                                            const noteText = a.voipSummary || a.note;
                                            const hasLongNote = noteText && noteText.length > 80;
                                            const hasContent =
                                                a.note ||
                                                a.voipSummary ||
                                                (a.voipProvider && a.channel === "CALL");

                                            return (
                                                <li
                                                    key={a.id}
                                                    className="relative pb-3 last:pb-0"
                                                >
                                                    {/* Timeline dot */}
                                                    <div
                                                        className={cn(
                                                            "absolute left-[-20px] top-2 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 flex items-center justify-center",
                                                            cfg.dot
                                                        )}
                                                        aria-hidden="true"
                                                    >
                                                        <Icon className="w-2.5 h-2.5 text-white" />
                                                    </div>

                                                    {/* Card */}
                                                    <div
                                                        className={cn(
                                                            "rounded-xl border transition-all duration-150",
                                                            cfg.border,
                                                            "bg-white hover:shadow-sm"
                                                        )}
                                                    >
                                                        {/* Header row — clickable if has content */}
                                                        <button
                                                            type="button"
                                                            className={cn(
                                                                "w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left rounded-xl transition-colors",
                                                                hasContent
                                                                    ? "cursor-pointer hover:bg-slate-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300"
                                                                    : "cursor-default"
                                                            )}
                                                            onClick={() => hasContent && toggleNoteExpand(a.id)}
                                                            aria-expanded={hasContent ? isExpanded : undefined}
                                                            aria-label={
                                                                hasContent
                                                                    ? isExpanded
                                                                        ? `Masquer les détails de ${statusLabels[a.result] ?? a.result}`
                                                                        : `Voir les détails de ${statusLabels[a.result] ?? a.result}`
                                                                    : undefined
                                                            }
                                                            disabled={!hasContent}
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span
                                                                        className={cn(
                                                                            "text-sm font-semibold",
                                                                            cfg.text
                                                                        )}
                                                                    >
                                                                        {statusLabels[a.result] ?? a.result}
                                                                    </span>
                                                                    {a.campaign?.name && (
                                                                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium truncate max-w-[100px]">
                                                                            {a.campaign.name}
                                                                        </span>
                                                                    )}
                                                                    {a.sdr?.name && (
                                                                        <span className="text-[10px] text-indigo-600 font-medium bg-indigo-50 px-1.5 py-0.5 rounded">
                                                                            {a.sdr.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <time
                                                                    dateTime={a.createdAt}
                                                                    className="text-[11px] text-slate-400 font-medium"
                                                                >
                                                                    {new Date(a.createdAt).toLocaleDateString("fr-FR", {
                                                                        day: "2-digit",
                                                                        month: "short",
                                                                        year: "numeric",
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    })}
                                                                </time>
                                                            </div>
                                                            {hasContent && (
                                                                <ChevronDown
                                                                    className={cn(
                                                                        "w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200",
                                                                        isExpanded && "rotate-180"
                                                                    )}
                                                                    aria-hidden="true"
                                                                />
                                                            )}
                                                        </button>

                                                        {/* Expandable note content */}
                                                        {hasContent && isExpanded && (
                                                            <div className="px-3 pb-3 pt-0 border-t border-slate-100 space-y-2">
                                                                {a.voipProvider && !a.voipSummary && !a.note && (
                                                                    <div className="flex items-center gap-2 py-2 text-amber-600">
                                                                        <Loader2
                                                                            className="w-3.5 h-3.5 animate-spin shrink-0"
                                                                            aria-hidden="true"
                                                                        />
                                                                        <span className="text-xs font-medium">
                                                                            En attente du résumé{" "}
                                                                            {a.voipProvider === "allo"
                                                                                ? "Allo"
                                                                                : a.voipProvider === "aircall"
                                                                                    ? "Aircall"
                                                                                    : "Ringover"}
                                                                            …
                                                                        </span>
                                                                        <span className="sr-only">
                                                                            Chargement en cours
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {a.voipSummary && (
                                                                    <div className="pt-2">
                                                                        <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">
                                                                            {a.voipProvider === "allo"
                                                                                ? "Résumé Allo"
                                                                                : a.voipProvider === "aircall"
                                                                                    ? "Résumé Aircall"
                                                                                    : a.voipProvider === "ringover"
                                                                                        ? "Résumé Ringover"
                                                                                        : "Résumé appel"}
                                                                        </p>
                                                                        <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                                                                            {a.voipSummary}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {a.note && (!a.voipSummary || a.note !== a.voipSummary) && (
                                                                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed pt-2">
                                                                        {a.note}
                                                                    </p>
                                                                )}
                                                                {a.voipRecordingUrl && (
                                                                    <a
                                                                        href={a.voipRecordingUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                                                        Écouter l&apos;enregistrement
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ol>

                                    {/* Show more / less */}
                                    {actions.length > 5 && (
                                        <button
                                            type="button"
                                            onClick={() => setHistoryExpanded((v) => !v)}
                                            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 py-2 rounded-xl hover:bg-indigo-50 border border-dashed border-indigo-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                                        >
                                            {historyExpanded ? (
                                                <>
                                                    <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                                                    Voir moins
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                                                    Voir {actions.length - 5} action{actions.length - 5 > 1 ? "s" : ""} de plus
                                                </>
                                            )}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {/* ── Modals ── */}
            {company && (
                <ContactDrawer
                    isOpen={showAddContact}
                    onClose={() => setShowAddContact(false)}
                    contact={null}
                    isCreating={true}
                    companies={[{ id: company.id, name: company.name }]}
                    isManager={true}
                    onCreate={async (newContact) => {
                        setShowAddContact(false);
                        setContact(newContact as Contact);
                        setActiveTab("contact");
                        onActionRecorded?.();
                        try {
                            const res = await fetch(`/api/companies/${companyId}`);
                            const json = await res.json();
                            if (json.success && json.data) setCompany(json.data);
                        } catch {
                            // keep current state
                        }
                    }}
                />
            )}

            {contactId && contact && (clientBookingUrl || clientInterlocuteurs?.some(i => (i.bookingLinks?.length ?? 0) > 0)) && (
                <BookingDrawer
                    isOpen={showBookingDrawer}
                    onClose={() => setShowBookingDrawer(false)}
                    bookingUrl={clientBookingUrl || ""}
                    contactId={contactId}
                    contactName={`${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Contact"}
                    contactInfo={{
                        firstName: contact.firstName,
                        lastName: contact.lastName,
                        email: contact.email,
                        phone: contact.phone,
                        title: contact.title,
                        companyName: company?.name ?? undefined,
                        companyEmail: company?.email ?? undefined,
                        companyPhone: company?.phone ?? undefined,
                    }}
                    rdvDate={rdvDate ? new Date(rdvDate).toISOString() : undefined}
                    meetingType={meetingType || undefined}
                    meetingCategory={meetingCat || undefined}
                    meetingAddress={meetingType === "PHYSIQUE" ? meetingAddress : undefined}
                    meetingJoinUrl={meetingType === "VISIO" ? meetingJoinUrl : undefined}
                    meetingPhone={meetingType === "TELEPHONIQUE" ? (meetingPhone || contact.phone || undefined) : undefined}
                    interlocuteurs={clientInterlocuteurs}
                    onBookingSuccess={() => {
                        setShowBookingDrawer(false);
                        setNewActionResult("");
                        setNewActionNote("");
                        setRdvDate("");
                        setMeetingType("");
                        setMeetingCat("");
                        setMeetingJoinUrl("");
                        setMeetingAddress("");
                        setMeetingPhone("");
                        onActionRecorded?.();
                        setActionsLoading(true);
                        fetch(`/api/actions?contactId=${contactId}&limit=10`)
                            .then((r) => r.json())
                            .then((j) => {
                                if (j.success && Array.isArray(j.data)) setActions(j.data);
                            })
                            .catch(() => showError("Impossible de rafraîchir l'historique"))
                            .finally(() => setActionsLoading(false));
                    }}
                />
            )}

            {userId && voipModalData && (
                <VoipCallValidationModal
                    isOpen={voipModalOpen}
                    onClose={() => {
                        setVoipModalOpen(false);
                        setVoipModalData(null);
                        setVoipModalActionId("");
                        setVoipEnrichmentSummary(null);
                        onActionRecorded?.();
                    }}
                    actionId={voipModalActionId}
                    callData={voipModalData}
                    enrichmentSummary={voipEnrichmentSummary}
                    statusOptions={statusConfig?.statuses?.map((s) => ({
                        value: s.code,
                        label: s.label,
                    }))}
                    onValidated={() => {
                        setActionsLoading(true);
                        const q = contactId ? `contactId=${contactId}` : `companyId=${companyId}`;
                        fetch(`/api/actions?${q}&limit=10`)
                            .then((r) => r.json())
                            .then((j) => {
                                if (j.success && Array.isArray(j.data)) setActions(j.data);
                            })
                            .finally(() => setActionsLoading(false));
                    }}
                />
            )}
        </Drawer>
    );
}

export default UnifiedActionDrawer;