"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Drawer, Button, Badge, Select, useToast, TextSkeleton, ListSkeleton } from "@/components/ui";
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
    Briefcase,
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
} from "lucide-react";
import { BookingModal } from "@/components/sdr/BookingModal";
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
}

interface UnifiedActionDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    contactId: string | null;
    companyId: string;
    missionId?: string;
    missionName?: string;
    /** Client booking URL (Calendly etc.) for MEETING_BOOKED - when set, drawer shows "Planifier un RDV" and calendar modal */
    clientBookingUrl?: string;
    onActionRecorded?: () => void;
    /** When user selects "Envoie mail" in the drawer, call this to open the email sending modal (table view) */
    onOpenEmailModal?: () => void;
    /** When provided (e.g. table view), enables "Valider et suivant" to record action and open next item in drawer */
    onValidateAndNext?: () => void;
}

// ============================================
// STATUS CONFIG
// ============================================

const STATUS_CONFIG = {
    INCOMPLETE: { label: "Incomplet", color: "text-red-500", bg: "bg-red-50", borderColor: "border-red-200", icon: AlertCircle },
    PARTIAL: { label: "Partiel", color: "text-amber-500", bg: "bg-amber-50", borderColor: "border-amber-200", icon: Clock },
    ACTIONABLE: { label: "Actionnable", color: "text-emerald-500", bg: "bg-emerald-50", borderColor: "border-emerald-200", icon: CheckCircle },
};

// ============================================
// ACTION RESULT COLORS
// ============================================

const ACTION_RESULT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    NO_RESPONSE: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" },
    BAD_CONTACT: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", dot: "bg-red-400" },
    INTERESTED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400" },
    CALLBACK_REQUESTED: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400" },
    MEETING_BOOKED: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-400" },
    MEETING_CANCELLED: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", dot: "bg-red-400" },
    DISQUALIFIED: { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-400" },
    ENVOIE_MAIL: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-400" },
};

// ============================================
// UNIFIED ACTION DRAWER COMPONENT
// ============================================

export function UnifiedActionDrawer({
    isOpen,
    onClose,
    contactId,
    companyId,
    missionId,
    missionName,
    clientBookingUrl,
    onActionRecorded,
    onOpenEmailModal,
    onValidateAndNext,
}: UnifiedActionDrawerProps) {
    const { success, error: showError } = useToast();

    // Tab state
    const [activeTab, setActiveTab] = useState<"contact" | "company">("contact");

    // Data states
    const [contact, setContact] = useState<Contact | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(false);

    // Actions state
    const [actions, setActions] = useState<Array<{ id: string; result: string; note: string | null; createdAt: string; campaign?: { name: string }; sdr?: { id: string; name: string } }>>([]);
    const [actionsLoading, setActionsLoading] = useState(false);

    // Campaign state for recording actions
    const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; mission?: { channel: string } }>>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(false);

    // Config-driven status options
    const [statusConfig, setStatusConfig] = useState<{ statuses: Array<{ code: string; label: string; requiresNote: boolean }> } | null>(null);

    // New action form
    const [newActionResult, setNewActionResult] = useState<string>("");
    const [newActionNote, setNewActionNote] = useState("");
    const [newActionSaving, setNewActionSaving] = useState(false);
    const [newCallbackDateValue, setNewCallbackDateValue] = useState("");
    const [isImprovingNote, setIsImprovingNote] = useState(false);

    const [showBookingModal, setShowBookingModal] = useState(false);
    const [showAddContact, setShowAddContact] = useState(false);

    // History expanded notes state
    const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

    // Inline editing states
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [isEditingCompany, setIsEditingCompany] = useState(false);
    const [editContactData, setEditContactData] = useState<Partial<Contact>>({});
    const [editCompanyData, setEditCompanyData] = useState<Partial<Company>>({});
    const [savingContact, setSavingContact] = useState(false);
    const [savingCompany, setSavingCompany] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    const toggleNoteExpand = (actionId: string) => {
        setExpandedNotes((prev) => {
            const next = new Set(prev);
            if (next.has(actionId)) next.delete(actionId);
            else next.add(actionId);
            return next;
        });
    };

    // Fetch data when drawer opens
    useEffect(() => {
        if (!isOpen || !companyId) {
            setContact(null);
            setCompany(null);
            setActions([]);
            return;
        }

        const controller = new AbortController();
        const signal = controller.signal;
        setLoading(true);

        // Fetch company data
        fetch(`/api/companies/${companyId}`, { signal })
            .then((res) => res.json())
            .then((json) => {
                if (signal.aborted) return;
                if (json.success && json.data) {
                    setCompany(json.data);
                }
            })
            .catch((err) => {
                if ((err as Error).name === "AbortError") return;
                setCompany(null);
                showError("Impossible de charger la société");
            })
            .finally(() => {
                if (!signal.aborted) setLoading(false);
            });

        // Fetch contact data if contactId provided
        if (contactId) {
            fetch(`/api/contacts/${contactId}`, { signal })
                .then((res) => res.json())
                .then((json) => {
                    if (signal.aborted) return;
                    if (json.success && json.data) {
                        setContact(json.data);
                    }
                })
                .catch((err) => {
                    if ((err as Error).name === "AbortError") return;
                    setContact(null);
                    showError("Impossible de charger le contact");
                });

            setActiveTab("contact");
        } else {
            setContact(null);
            setActiveTab("company");
        }

        return () => controller.abort();
    }, [isOpen, contactId, companyId, showError, retryKey]);

    // Fetch actions history
    useEffect(() => {
        if (!isOpen) {
            setActions([]);
            return;
        }

        const controller = new AbortController();
        const signal = controller.signal;
        setActionsLoading(true);
        const queryParam = contactId ? `contactId=${contactId}` : `companyId=${companyId}`;

        fetch(`/api/actions?${queryParam}&limit=10`, { signal })
            .then((res) => res.json())
            .then((json) => {
                if (signal.aborted) return;
                if (json.success && Array.isArray(json.data)) {
                    setActions(json.data);
                } else {
                    setActions([]);
                }
            })
            .catch((err) => {
                if ((err as Error).name === "AbortError") return;
                setActions([]);
                showError("Impossible de charger l'historique des actions");
            })
            .finally(() => {
                if (!signal.aborted) setActionsLoading(false);
            });
        return () => controller.abort();
    }, [isOpen, contactId, companyId, showError]);

    // Fetch campaigns for action recording
    useEffect(() => {
        if (!isOpen || !missionId) {
            setCampaigns([]);
            return;
        }

        const controller = new AbortController();
        const signal = controller.signal;
        setCampaignsLoading(true);
        fetch(`/api/campaigns?missionId=${missionId}&isActive=true&limit=50`, { signal })
            .then((res) => res.json())
            .then((json) => {
                if (signal.aborted) return;
                if (json.success && Array.isArray(json.data)) {
                    setCampaigns(json.data);
                } else {
                    setCampaigns([]);
                }
            })
            .catch((err) => {
                if ((err as Error).name === "AbortError") return;
                setCampaigns([]);
                showError("Impossible de charger les campagnes");
            })
            .finally(() => {
                if (!signal.aborted) setCampaignsLoading(false);
            });
        return () => controller.abort();
    }, [isOpen, missionId, showError]);

    // Fetch status config when mission is available
    useEffect(() => {
        if (!isOpen || !missionId) {
            setStatusConfig(null);
            return;
        }
        const controller = new AbortController();
        const signal = controller.signal;
        fetch(`/api/config/action-statuses?missionId=${missionId}`, { signal })
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
    }, [isOpen, missionId, showError]);

    const getRequiresNote = (code: string) =>
        statusConfig?.statuses?.find((s) => s.code === code)?.requiresNote ??
        ["INTERESTED", "CALLBACK_REQUESTED", "ENVOIE_MAIL"].includes(code);

    const statusOptions = statusConfig?.statuses?.length
        ? statusConfig.statuses.map((s) => ({ value: s.code, label: s.label }))
        : Object.entries(ACTION_RESULT_LABELS).map(([value, label]) => ({ value, label }));

    const statusLabels: Record<string, string> = statusConfig?.statuses?.length
        ? Object.fromEntries(statusConfig.statuses.map((s) => [s.code, s.label]))
        : { ...ACTION_RESULT_LABELS };

    // Get primary phone number
    const primaryPhone = useMemo(() => {
        if (contact?.phone) return { number: contact.phone, label: "Contact" };
        if (company?.phone) return { number: company.phone, label: "Société" };
        return null;
    }, [contact, company]);

    // Get primary email
    const primaryEmail = useMemo(() => {
        if (contact?.email) return contact.email;
        const contactWithEmail = company?.contacts?.find(c => c.email);
        return contactWithEmail?.email || null;
    }, [contact, company]);

    // Copy to clipboard
    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        success("Copié", `${label} copié dans le presse-papier`);
    };

    // Improve note with Mistral (orthography + rephrase)
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

    // Record action (andNext: when true and onValidateAndNext provided, call it after success to open next in table view)
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

        const noteRequired = getRequiresNote(newActionResult);
        if (noteRequired && !newActionNote.trim()) {
            showError("Erreur", "Une note est requise pour ce résultat");
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
                    callbackDate: newActionResult === "CALLBACK_REQUESTED" && newCallbackDateValue
                        ? new Date(newCallbackDateValue).toISOString()
                        : undefined,
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
                if (andNext && onValidateAndNext) {
                    onValidateAndNext();
                }
            } else {
                showError("Erreur", json.error || "Impossible d'enregistrer l'action");
            }
        } catch {
            showError("Erreur", "Impossible d'enregistrer l'action");
        } finally {
            setNewActionSaving(false);
        }
    };


    // Handle saving contact
    const handleSaveContact = async () => {
        if (!contactId || !editContactData) return;
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

    // Handle saving company
    const handleSaveCompany = async () => {
        if (!companyId || !editCompanyData) return;
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

    // Generate display name
    const displayName = useMemo(() => {
        if (contact) {
            const name = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
            return name || company?.name || "Sans nom";
        }
        return company?.name || "Sans nom";
    }, [contact, company]);

    if (!isOpen) return null;

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={displayName}
            description={missionName ? `Mission: ${missionName}` : undefined}
            size="lg"
        >
            {loading ? (
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <TextSkeleton lines={2} className="flex-1" />
                        <TextSkeleton lines={1} className="w-24" />
                    </div>
                    <ListSkeleton items={4} hasAvatar className="mt-4" />
                    <TextSkeleton lines={3} />
                </div>
            ) : (companyId && !company) || (contactId && !contact) ? (
                <div className="py-12 text-center">
                    <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <p className="text-slate-700 font-medium mb-2">Impossible de charger les données</p>
                    <p className="text-sm text-slate-500 mb-4">Vérifiez votre connexion et réessayez.</p>
                    <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)} className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Réessayer
                    </Button>
                </div>
            ) : (
                <div className="space-y-5">
                    {/* Quick Actions Bar */}
                    <div className="flex flex-wrap gap-2">
                        {primaryPhone && (
                            <a
                                href={`tel:${primaryPhone.number}`}
                                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <PhoneCall className="w-4 h-4" />
                                <span>Appeler</span>
                                {primaryPhone.label === "Société" && (
                                    <span className="text-xs opacity-80">({primaryPhone.label})</span>
                                )}
                            </a>
                        )}
                        {primaryEmail && (
                            <a
                                href={`mailto:${primaryEmail}`}
                                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Send className="w-4 h-4" />
                                Email
                            </a>
                        )}
                        {(contact?.linkedin || company?.website) && (
                            <a
                                href={contact?.linkedin
                                    ? (contact.linkedin.startsWith("http") ? contact.linkedin : `https://${contact.linkedin}`)
                                    : (company?.website?.startsWith("http") ? company.website : `https://${company?.website}`)
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-all duration-200"
                            >
                                {contact?.linkedin ? <Linkedin className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                                {contact?.linkedin ? "LinkedIn" : "Site web"}
                            </a>
                        )}
                    </div>

                    {/* Tab Navigation */}
                    {contact && (
                        <div className="flex rounded-xl bg-slate-100/80 p-1">
                            <button
                                onClick={() => setActiveTab("contact")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                    activeTab === "contact"
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-slate-600 hover:text-slate-900"
                                )}
                            >
                                <User className="w-4 h-4" />
                                Contact
                            </button>
                            <button
                                onClick={() => setActiveTab("company")}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                    activeTab === "company"
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-slate-600 hover:text-slate-900"
                                )}
                            >
                                <Building2 className="w-4 h-4" />
                                Société
                            </button>
                        </div>
                    )}

                    {/* Contact Tab Content */}
                    {activeTab === "contact" && contact && (
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-4">
                            {/* Contact Header */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3.5 flex-1">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-lg font-bold text-indigo-600 shadow-sm shrink-0">
                                        {(contact.firstName?.[0] || contact.lastName?.[0] || "?").toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {isEditingContact ? (
                                            <div className="space-y-2">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={editContactData.firstName || ""}
                                                        onChange={(e) => setEditContactData({ ...editContactData, firstName: e.target.value })}
                                                        placeholder="Prénom"
                                                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={editContactData.lastName || ""}
                                                        onChange={(e) => setEditContactData({ ...editContactData, lastName: e.target.value })}
                                                        placeholder="Nom"
                                                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={editContactData.title || ""}
                                                    onChange={(e) => setEditContactData({ ...editContactData, title: e.target.value })}
                                                    placeholder="Titre / Poste"
                                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className="text-base font-semibold text-slate-900 leading-tight">
                                                    {contact.firstName || ""} {contact.lastName || ""}
                                                    {!contact.firstName && !contact.lastName && (
                                                        <span className="text-slate-400 italic">Sans nom</span>
                                                    )}
                                                </h3>
                                                {contact.title && (
                                                    <p className="text-sm text-slate-500 mt-0.5">{contact.title}</p>
                                                )}
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mt-1.5",
                                                    STATUS_CONFIG[contact.status].bg,
                                                    STATUS_CONFIG[contact.status].color
                                                )}>
                                                    {(() => {
                                                        const StatusIcon = STATUS_CONFIG[contact.status].icon;
                                                        return <StatusIcon className="w-3 h-3" />;
                                                    })()}
                                                    {STATUS_CONFIG[contact.status].label}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    {isEditingContact ? (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setIsEditingContact(false)}
                                                disabled={savingContact}
                                                className="h-8 w-8 p-0 text-slate-500"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                onClick={handleSaveContact}
                                                isLoading={savingContact}
                                                className="h-8 w-8 p-0 bg-indigo-600 hover:bg-indigo-700"
                                            >
                                                <Save className="w-4 h-4" />
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                const extraPhones = contact.additionalPhones && Array.isArray(contact.additionalPhones) ? contact.additionalPhones : [];
                                                const extraEmails = contact.additionalEmails && Array.isArray(contact.additionalEmails) ? contact.additionalEmails : [];
                                                setEditContactData({
                                                    firstName: contact.firstName,
                                                    lastName: contact.lastName,
                                                    title: contact.title,
                                                    email: contact.email,
                                                    phone: contact.phone,
                                                    additionalPhones: extraPhones,
                                                    additionalEmails: extraEmails,
                                                    linkedin: contact.linkedin
                                                });
                                                setIsEditingContact(true);
                                            }}
                                            className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Contact Details */}
                            <div className="grid gap-2.5 pt-1">
                                {(contact.phone || isEditingContact) && (
                                    <div className="flex items-center gap-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Téléphone</p>
                                            {isEditingContact ? (
                                                <input
                                                    type="text"
                                                    value={editContactData.phone || ""}
                                                    onChange={(e) => setEditContactData({ ...editContactData, phone: e.target.value })}
                                                    placeholder="Numéro de téléphone"
                                                    className="w-full mt-0.5 px-2 py-1 text-sm border border-slate-300 rounded-md"
                                                />
                                            ) : (
                                                <a href={`tel:${contact.phone}`} className="text-sm font-medium text-emerald-600 hover:underline">
                                                    {contact.phone}
                                                </a>
                                            )}
                                        </div>
                                        {!isEditingContact && contact.phone && (
                                            <button
                                                onClick={() => copyToClipboard(contact.phone!, "Téléphone")}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {(contact.email || isEditingContact) && (
                                    <div className="flex items-center gap-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                            <Mail className="w-3.5 h-3.5 text-indigo-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Email</p>
                                            {isEditingContact ? (
                                                <input
                                                    type="email"
                                                    value={editContactData.email || ""}
                                                    onChange={(e) => setEditContactData({ ...editContactData, email: e.target.value })}
                                                    placeholder="Adresse email"
                                                    className="w-full mt-0.5 px-2 py-1 text-sm border border-slate-300 rounded-md"
                                                />
                                            ) : (
                                                <a href={`mailto:${contact.email}`} className="text-sm font-medium text-indigo-600 hover:underline truncate block">
                                                    {contact.email}
                                                </a>
                                            )}
                                        </div>
                                        {!isEditingContact && contact.email && (
                                            <button
                                                onClick={() => copyToClipboard(contact.email!, "Email")}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Additional phone numbers */}
                                {(isEditingContact ? (editContactData.additionalPhones?.length ?? 0) > 0 : (contact.additionalPhones && Array.isArray(contact.additionalPhones) && contact.additionalPhones.filter(Boolean).length > 0)) && (
                                    <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                                            <Phone className="w-3 h-3 text-emerald-500" />
                                            Autres numéros
                                        </p>
                                        {isEditingContact ? (
                                            <>
                                                {(editContactData.additionalPhones ?? []).map((num, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={num}
                                                            onChange={(e) => {
                                                                const next = [...(editContactData.additionalPhones ?? [])];
                                                                next[idx] = e.target.value;
                                                                setEditContactData({ ...editContactData, additionalPhones: next });
                                                            }}
                                                            placeholder="Numéro"
                                                            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-md"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditContactData({
                                                                ...editContactData,
                                                                additionalPhones: (editContactData.additionalPhones ?? []).filter((_, i) => i !== idx),
                                                            })}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <Button type="button" variant="outline" size="sm" onClick={() => setEditContactData({
                                                    ...editContactData,
                                                    additionalPhones: [...(editContactData.additionalPhones ?? []), ""],
                                                })} className="gap-2">
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Ajouter un numéro
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5">
                                                {(contact.additionalPhones && Array.isArray(contact.additionalPhones) ? contact.additionalPhones.filter(Boolean) : []).map((num, idx) => (
                                                    <div key={idx} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs">
                                                        <a href={`tel:${num}`} className="text-emerald-700 hover:underline font-medium">{num}</a>
                                                        <button onClick={() => copyToClipboard(num, "Numéro")} className="p-0.5 text-emerald-500 hover:bg-emerald-100 rounded">
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {isEditingContact && (editContactData.additionalPhones?.length ?? 0) === 0 && (
                                    <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-2">Autres numéros</p>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setEditContactData({
                                            ...editContactData,
                                            additionalPhones: [...(editContactData.additionalPhones ?? []), ""],
                                        })} className="gap-2">
                                            <Plus className="w-3.5 h-3.5" />
                                            Ajouter un numéro
                                        </Button>
                                    </div>
                                )}

                                {/* Additional emails */}
                                {(isEditingContact ? (editContactData.additionalEmails?.length ?? 0) > 0 : (contact.additionalEmails && Array.isArray(contact.additionalEmails) && contact.additionalEmails.filter(Boolean).length > 0)) && (
                                    <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                                            <Mail className="w-3 h-3 text-indigo-500" />
                                            Autres emails
                                        </p>
                                        {isEditingContact ? (
                                            <>
                                                {(editContactData.additionalEmails ?? []).map((em, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <input
                                                            type="email"
                                                            value={em}
                                                            onChange={(e) => {
                                                                const next = [...(editContactData.additionalEmails ?? [])];
                                                                next[idx] = e.target.value;
                                                                setEditContactData({ ...editContactData, additionalEmails: next });
                                                            }}
                                                            placeholder="Email"
                                                            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-md"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditContactData({
                                                                ...editContactData,
                                                                additionalEmails: (editContactData.additionalEmails ?? []).filter((_, i) => i !== idx),
                                                            })}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <Button type="button" variant="outline" size="sm" onClick={() => setEditContactData({
                                                    ...editContactData,
                                                    additionalEmails: [...(editContactData.additionalEmails ?? []), ""],
                                                })} className="gap-2">
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Ajouter un email
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5">
                                                {(contact.additionalEmails && Array.isArray(contact.additionalEmails) ? contact.additionalEmails.filter(Boolean) : []).map((em, idx) => (
                                                    <div key={idx} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs">
                                                        <a href={`mailto:${em}`} className="text-indigo-700 hover:underline truncate max-w-[160px]">{em}</a>
                                                        <button onClick={() => copyToClipboard(em, "Email")} className="p-0.5 text-indigo-500 hover:bg-indigo-100 rounded shrink-0">
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {isEditingContact && (editContactData.additionalEmails?.length ?? 0) === 0 && (
                                    <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-2">Autres emails</p>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setEditContactData({
                                            ...editContactData,
                                            additionalEmails: [...(editContactData.additionalEmails ?? []), ""],
                                        })} className="gap-2">
                                            <Plus className="w-3.5 h-3.5" />
                                            Ajouter un email
                                        </Button>
                                    </div>
                                )}

                                {(contact.linkedin || isEditingContact) && (
                                    <div className="flex items-center gap-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                            <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">LinkedIn</p>
                                            {isEditingContact ? (
                                                <input
                                                    type="text"
                                                    value={editContactData.linkedin || ""}
                                                    onChange={(e) => setEditContactData({ ...editContactData, linkedin: e.target.value })}
                                                    placeholder="URL LinkedIn"
                                                    className="w-full mt-0.5 px-2 py-1 text-sm border border-slate-300 rounded-md"
                                                />
                                            ) : (
                                                <a
                                                    href={contact.linkedin!.startsWith("http") ? contact.linkedin : `https://${contact.linkedin}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm font-medium text-blue-600 hover:underline truncate block"
                                                >
                                                    Voir le profil
                                                </a>
                                            )}
                                        </div>
                                        {!isEditingContact && contact.linkedin && (
                                            <a
                                                href={contact.linkedin.startsWith("http") ? contact.linkedin : `https://${contact.linkedin}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                )}

                                {!isEditingContact && !contact.phone && !contact.email && !contact.linkedin &&
                                    !(contact.additionalPhones && contact.additionalPhones.filter(Boolean).length > 0) &&
                                    !(contact.additionalEmails && contact.additionalEmails.filter(Boolean).length > 0) && (
                                    <div className="text-center py-6 text-slate-400">
                                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">Aucune information de contact</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Company Tab Content */}
                    {(activeTab === "company" || !contact) && company && (
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-4">
                            {/* When no contact (company-only row): allow adding a contact */}
                            {!contact && (
                                <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                                            <User className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 text-sm">Aucun contact pour cette société</p>
                                            <p className="text-xs text-slate-500">Ajoutez un contact pour enregistrer des actions.</p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        onClick={() => setShowAddContact(true)}
                                        className="gap-2 shrink-0"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Ajouter un contact
                                    </Button>
                                </div>
                            )}

                            {/* Company Header */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3.5 flex-1">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center shadow-sm shrink-0">
                                        <Building2 className="w-6 h-6 text-violet-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {isEditingCompany ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={editCompanyData.name || ""}
                                                    onChange={(e) => setEditCompanyData({ ...editCompanyData, name: e.target.value })}
                                                    placeholder="Nom de la société"
                                                    className="w-full px-2.5 py-1.5 text-sm font-semibold border border-slate-300 rounded-lg"
                                                />
                                                <input
                                                    type="text"
                                                    value={editCompanyData.industry || ""}
                                                    onChange={(e) => setEditCompanyData({ ...editCompanyData, industry: e.target.value })}
                                                    placeholder="Secteur d'activité"
                                                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className="text-base font-semibold text-slate-900 leading-tight">{company.name}</h3>
                                                {company.industry && (
                                                    <p className="text-sm text-slate-500 mt-0.5">{company.industry}</p>
                                                )}
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mt-1.5",
                                                    STATUS_CONFIG[company.status].bg,
                                                    STATUS_CONFIG[company.status].color
                                                )}>
                                                    {(() => {
                                                        const StatusIcon = STATUS_CONFIG[company.status].icon;
                                                        return <StatusIcon className="w-3 h-3" />;
                                                    })()}
                                                    {STATUS_CONFIG[company.status].label}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    {isEditingCompany ? (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setIsEditingCompany(false)}
                                                disabled={savingCompany}
                                                className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                onClick={handleSaveCompany}
                                                isLoading={savingCompany}
                                                className="h-8 w-8 p-0 bg-violet-600 hover:bg-violet-700"
                                            >
                                                <Save className="w-4 h-4" />
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setEditCompanyData({
                                                    name: company.name,
                                                    industry: company.industry,
                                                    country: company.country,
                                                    website: company.website,
                                                    size: company.size,
                                                    phone: company.phone
                                                });
                                                setIsEditingCompany(true);
                                            }}
                                            className="h-8 w-8 p-0 text-slate-400 hover:text-violet-600 hover:bg-violet-50"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Company Details */}
                            <div className="grid gap-2.5 pt-1">
                                {(company.phone || isEditingCompany) && (
                                    <div className="flex items-center gap-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Téléphone</p>
                                            {isEditingCompany ? (
                                                <input
                                                    type="text"
                                                    value={editCompanyData.phone || ""}
                                                    onChange={(e) => setEditCompanyData({ ...editCompanyData, phone: e.target.value })}
                                                    placeholder="Numéro de téléphone"
                                                    className="w-full mt-0.5 px-2 py-1 text-sm border border-slate-300 rounded-md"
                                                />
                                            ) : (
                                                <a href={`tel:${company.phone}`} className="text-sm font-medium text-emerald-600 hover:underline">
                                                    {company.phone}
                                                </a>
                                            )}
                                        </div>
                                        {!isEditingCompany && company.phone && (
                                            <button
                                                onClick={() => copyToClipboard(company.phone!, "Téléphone")}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {(company.website || isEditingCompany) && (
                                    <div className="flex items-center gap-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                            <Globe className="w-3.5 h-3.5 text-indigo-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Site web</p>
                                            {isEditingCompany ? (
                                                <input
                                                    type="text"
                                                    value={editCompanyData.website || ""}
                                                    onChange={(e) => setEditCompanyData({ ...editCompanyData, website: e.target.value })}
                                                    placeholder="Site web (ex: exemple.com)"
                                                    className="w-full mt-0.5 px-2 py-1 text-sm border border-slate-300 rounded-md"
                                                />
                                            ) : (
                                                <a
                                                    href={company.website!.startsWith("http") ? company.website : `https://${company.website}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm font-medium text-indigo-600 hover:underline truncate block"
                                                >
                                                    {company.website}
                                                </a>
                                            )}
                                        </div>
                                        {!isEditingCompany && company.website && (
                                            <a
                                                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2.5">
                                    <div className="flex items-center gap-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <div className="w-full">
                                            <p className="text-[10px] text-slate-400 font-medium">Pays</p>
                                            {isEditingCompany ? (
                                                <input
                                                    type="text"
                                                    value={editCompanyData.country || ""}
                                                    onChange={(e) => setEditCompanyData({ ...editCompanyData, country: e.target.value })}
                                                    placeholder="Pays"
                                                    className="w-full mt-0.5 px-2 py-0.5 text-sm border border-slate-300 rounded-md"
                                                />
                                            ) : (
                                                <p className="text-sm font-medium text-slate-700">{company.country || "-"}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <div className="w-full">
                                            <p className="text-[10px] text-slate-400 font-medium">Taille</p>
                                            {isEditingCompany ? (
                                                <input
                                                    type="text"
                                                    value={editCompanyData.size || ""}
                                                    onChange={(e) => setEditCompanyData({ ...editCompanyData, size: e.target.value })}
                                                    placeholder="Taille d'effectif"
                                                    className="w-full mt-0.5 px-2 py-0.5 text-sm border border-slate-300 rounded-md"
                                                />
                                            ) : (
                                                <p className="text-sm font-medium text-slate-700">{company.size || "-"}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Other Contacts in Company */}
                                {company.contacts && company.contacts.length > 0 && (
                                    <div className="pt-2">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                                            <Users className="w-3 h-3" />
                                            Autres contacts ({company.contacts.length})
                                        </p>
                                        <div className="space-y-1.5 max-h-[150px] overflow-y-auto drawer-scrollbar">
                                            {company.contacts.slice(0, 5).map((c) => (
                                                <div
                                                    key={c.id}
                                                    className="flex items-center gap-2.5 p-2 bg-slate-50/80 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
                                                >
                                                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
                                                        {(c.firstName?.[0] || c.lastName?.[0] || "?").toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-700 truncate">
                                                            {c.firstName || ""} {c.lastName || ""}
                                                        </p>
                                                        {c.title && (
                                                            <p className="text-xs text-slate-400 truncate">{c.title}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-0.5">
                                                        {c.phone && (
                                                            <a href={`tel:${c.phone}`} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded-lg">
                                                                <Phone className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                        {c.email && (
                                                            <a href={`mailto:${c.email}`} className="p-1 text-indigo-500 hover:bg-indigo-50 rounded-lg">
                                                                <Mail className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Actions Section */}
                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-indigo-50/80 to-white border-b border-slate-100">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900">Enregistrer une action</h4>
                        </div>

                        <div className="p-5">
                            {campaignsLoading ? (
                                <div className="space-y-3 py-4">
                                    <TextSkeleton lines={1} className="h-10 w-full" />
                                    <TextSkeleton lines={2} />
                                </div>
                            ) : campaigns.length === 0 ? (
                                <p className="text-sm text-slate-500 py-4">Aucune campagne disponible pour cette mission.</p>
                            ) : (
                                <div className="space-y-4">
                                    {/* Result Select */}
                                    <Select
                                        placeholder="Sélectionner un résultat..."
                                        options={statusOptions}
                                        value={newActionResult}
                                        onChange={(value) => {
                                            setNewActionResult(value);
                                            if (value === "ENVOIE_MAIL") {
                                                onOpenEmailModal?.();
                                            }
                                        }}
                                    />

                                    {/* Callback Date */}
                                    {newActionResult === "CALLBACK_REQUESTED" && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Clock className="w-4 h-4 text-amber-600" />
                                                <label className="text-sm font-medium text-slate-900">Date de rappel</label>
                                            </div>
                                            <input
                                                type="datetime-local"
                                                value={newCallbackDateValue}
                                                onChange={(e) => setNewCallbackDateValue(e.target.value)}
                                                min={new Date().toISOString().slice(0, 16)}
                                                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-300"
                                            />
                                        </div>
                                    )}

                                    {/* Note */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Note
                                            {newActionResult && getRequiresNote(newActionResult) && (
                                                <span className="text-red-500 ml-1">*</span>
                                            )}
                                        </label>
                                        <textarea
                                            value={newActionNote}
                                            onChange={(e) => setNewActionNote(e.target.value)}
                                            placeholder="Ajouter une note..."
                                            rows={3}
                                            maxLength={500}
                                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none transition-all"
                                        />
                                        <div className="flex items-center justify-between mt-1.5 gap-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleImproveNote}
                                                disabled={!newActionNote.trim() || isImprovingNote}
                                                className="gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200/60 h-7 text-xs"
                                            >
                                                {isImprovingNote ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Sparkles className="w-3 h-3" />
                                                )}
                                                {isImprovingNote ? "En cours..." : "Améliorer avec l'IA"}
                                            </Button>
                                            <p className="text-xs text-slate-400">{newActionNote.length}/500</p>
                                        </div>
                                    </div>

                                    {/* MEETING_BOOKED: show calendar button when client has booking URL */}
                                    {newActionResult === "MEETING_BOOKED" && clientBookingUrl && contactId && contact && (
                                        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
                                            <p className="text-sm text-slate-700">
                                                Ouvrez le calendrier du client pour planifier un rendez-vous. Le RDV sera enregistré automatiquement.
                                            </p>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => setShowBookingModal(true)}
                                                className="gap-2 w-full"
                                            >
                                                <Calendar className="w-4 h-4" />
                                                Planifier un RDV
                                            </Button>
                                        </div>
                                    )}

                                    {/* Submit Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Button
                                            type="button"
                                            variant="primary"
                                            onClick={() => handleAddAction(false)}
                                            disabled={
                                                newActionSaving ||
                                                !newActionResult ||
                                                (["INTERESTED", "CALLBACK_REQUESTED"].includes(newActionResult) && !newActionNote.trim())
                                            }
                                            isLoading={newActionSaving}
                                            className={cn("gap-2", onValidateAndNext ? "flex-1" : "w-full")}
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            Enregistrer l'action
                                        </Button>
                                        {onValidateAndNext && (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => handleAddAction(true)}
                                                disabled={
                                                    newActionSaving ||
                                                    !newActionResult ||
                                                    (["INTERESTED", "CALLBACK_REQUESTED"].includes(newActionResult) && !newActionNote.trim())
                                                }
                                                isLoading={newActionSaving}
                                                className="gap-2 flex-1"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                                Valider et suivant
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* History Section - Enhanced with visible notes */}
                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                                <History className="w-3.5 h-3.5 text-slate-600" />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900">Historique des actions</h4>
                            {actions.length > 0 && (
                                <Badge className="ml-auto bg-slate-100 text-slate-600 text-xs">{actions.length}</Badge>
                            )}
                        </div>

                        <div className="p-4">
                            {actionsLoading ? (
                                <ListSkeleton items={4} hasAvatar={false} className="py-2" />
                            ) : actions.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Aucune action enregistrée</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[350px] overflow-y-auto drawer-scrollbar pr-1">
                                    {actions.map((a, index) => {
                                        const colors = ACTION_RESULT_COLORS[a.result] || ACTION_RESULT_COLORS.NO_RESPONSE;
                                        const isExpanded = expandedNotes.has(a.id);
                                        const hasLongNote = a.note && a.note.length > 80;

                                        return (
                                            <div
                                                key={a.id}
                                                className={cn(
                                                    "rounded-xl border transition-all duration-200",
                                                    colors.border,
                                                    "hover:shadow-sm"
                                                )}
                                            >
                                                {/* Action header */}
                                                <div className="flex items-center gap-3 px-3.5 py-2.5">
                                                    {/* Timeline dot */}
                                                    <div className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={cn("text-sm font-semibold", colors.text)}>
                                                                {statusLabels[a.result] ?? a.result}
                                                            </span>
                                                            {a.campaign?.name && (
                                                                <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]">
                                                                    {a.campaign.name}
                                                                </span>
                                                            )}
                                                            {a.sdr?.name && (
                                                                <span className="text-[10px] text-indigo-500 font-medium bg-indigo-50 px-1.5 py-0.5 rounded">
                                                                    {a.sdr.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] text-slate-400">
                                                            {new Date(a.createdAt).toLocaleDateString("fr-FR", {
                                                                day: "2-digit",
                                                                month: "short",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                    </div>

                                                    {/* Note indicator */}
                                                    {a.note && (
                                                        <button
                                                            onClick={() => toggleNoteExpand(a.id)}
                                                            className={cn(
                                                                "p-1 rounded-lg transition-colors shrink-0",
                                                                isExpanded
                                                                    ? "text-indigo-600 bg-indigo-50"
                                                                    : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                            )}
                                                            title={isExpanded ? "Masquer la note" : "Voir la note"}
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Note content - always visible for short notes, expandable for long */}
                                                {a.note && (
                                                    <div className={cn(
                                                        "px-3.5 pb-3 pt-0",
                                                        "border-t border-slate-100/60 mt-0"
                                                    )}>
                                                        <div className={cn(
                                                            "mt-2 px-3 py-2 rounded-lg bg-slate-50/80 border border-slate-100",
                                                        )}>
                                                            <div className="flex items-start gap-1.5">
                                                                <FileText className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                                                <p className={cn(
                                                                    "text-xs text-slate-600 whitespace-pre-wrap leading-relaxed",
                                                                    !isExpanded && hasLongNote && "line-clamp-2"
                                                                )}>
                                                                    {a.note}
                                                                </p>
                                                            </div>
                                                            {hasLongNote && (
                                                                <button
                                                                    onClick={() => toggleNoteExpand(a.id)}
                                                                    className="flex items-center gap-1 mt-1.5 text-[10px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                                                                >
                                                                    {isExpanded ? (
                                                                        <>
                                                                            <ChevronUp className="w-3 h-3" />
                                                                            Réduire
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <ChevronDown className="w-3 h-3" />
                                                                            Voir plus
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add contact (when drawer opened with company only) */}
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
                            if (json.success && json.data) {
                                setCompany(json.data);
                            }
                        } catch {
                            // keep current company state
                        }
                    }}
                />
            )}

            {/* Booking modal (MEETING_BOOKED) */}
            {contactId && contact && clientBookingUrl && (
                <BookingModal
                    isOpen={showBookingModal}
                    onClose={() => setShowBookingModal(false)}
                    bookingUrl={clientBookingUrl}
                    contactId={contactId}
                    contactName={`${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Contact"}
                    onBookingSuccess={() => {
                        setShowBookingModal(false);
                        setNewActionResult("");
                        setNewActionNote("");
                        onActionRecorded?.();
                        setActionsLoading(true);
                        fetch(`/api/actions?contactId=${contactId}&limit=10`)
                            .then((res) => res.json())
                            .then((json) => {
                                if (json.success && Array.isArray(json.data)) {
                                    setActions(json.data);
                                }
                            })
                            .catch(() => {
                                showError("Impossible de rafraîchir l'historique");
                            })
                            .finally(() => setActionsLoading(false));
                    }}
                />
            )}
        </Drawer>
    );
}

export default UnifiedActionDrawer;
