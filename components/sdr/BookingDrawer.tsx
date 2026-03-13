"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/components/ui";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import {
    Loader2,
    Calendar,
    X,
    ExternalLink,
    Mail,
    Phone,
    Building2,
    Briefcase,
    CheckCircle2,
    Copy,
    ChevronRight,
    Video,
    MapPin,
    Globe,
    Linkedin,
    Clock,
    User,
    PhoneCall,
    Send,
    Check,
    CalendarCheck,
    Sparkles,
    Info,
    AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export interface BookingContactInfo {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
    companyName?: string | null;
    linkedin?: string | null;
    website?: string | null;
}

export interface SdrBookingLink {
    label: string;
    url: string;
    durationMinutes: number;
}

export interface SdrContactEntry {
    value: string;
    label: string;
    isPrimary: boolean;
}

export interface SdrInterlocuteur {
    id: string;
    firstName: string;
    lastName: string;
    title?: string;
    department?: string;
    territory?: string;
    emails: SdrContactEntry[];
    phones: SdrContactEntry[];
    bookingLinks: SdrBookingLink[];
    notes?: string;
    isActive: boolean;
}

interface BookingDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    bookingUrl: string;
    contactId: string;
    contactName: string;
    contactInfo?: BookingContactInfo;
    rdvDate?: string;
    meetingType?: "VISIO" | "PHYSIQUE" | "TELEPHONIQUE";
    meetingCategory?: "EXPLORATOIRE" | "BESOIN";
    meetingAddress?: string;
    meetingJoinUrl?: string;
    meetingPhone?: string;
    onRdvDateChange?: (value: string) => void;
    onMeetingTypeChange?: (value: "VISIO" | "PHYSIQUE" | "TELEPHONIQUE" | "") => void;
    onMeetingCategoryChange?: (value: "EXPLORATOIRE" | "BESOIN" | "") => void;
    onMeetingAddressChange?: (value: string) => void;
    onMeetingJoinUrlChange?: (value: string) => void;
    onMeetingPhoneChange?: (value: string) => void;
    onBookingSuccess?: () => void;
    interlocuteurs?: SdrInterlocuteur[];
}

interface CalendarOption {
    id: string;
    label: string;
    sublabel?: string;
    url: string;
    initials?: string;
    avatarColor?: string;
}

const AVATAR_COLORS = [
    "bg-indigo-100 text-indigo-700",
    "bg-rose-100 text-rose-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-purple-100 text-purple-700",
    "bg-cyan-100 text-cyan-700",
];

const MEETING_TYPE_CONFIG = {
    VISIO: {
        icon: Video,
        label: "Visio",
        color: "text-indigo-700",
        bg: "bg-indigo-50",
        border: "border-indigo-300",
        selectedBg: "bg-indigo-600",
        pill: "bg-indigo-100 text-indigo-700",
    },
    PHYSIQUE: {
        icon: MapPin,
        label: "Physique",
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-300",
        selectedBg: "bg-emerald-600",
        pill: "bg-emerald-100 text-emerald-700",
    },
    TELEPHONIQUE: {
        icon: Phone,
        label: "Téléphonique",
        color: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-300",
        selectedBg: "bg-amber-600",
        pill: "bg-amber-100 text-amber-700",
    },
} as const;

const MEETING_CATEGORY_CONFIG = {
    EXPLORATOIRE: {
        label: "Exploratoire",
        color: "text-blue-700",
        bg: "bg-blue-50",
        border: "border-blue-300",
        desc: "Premier contact, découverte",
    },
    BESOIN: {
        label: "Analyse de besoin",
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-300",
        desc: "Qualification approfondie",
    },
} as const;

function hashStr(s: string) {
    return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function getEmbedBookingUrl(rawUrl: string): string {
    try {
        const url = new URL(rawUrl);
        if (url.hostname.endsWith("cal.com") || url.hostname === "cal.com") {
            url.searchParams.set("embed", "true");
        }
        if (url.hostname.endsWith("calendly.com") || url.hostname === "calendly.com") {
            url.searchParams.set("embed_domain", typeof window !== "undefined" ? window.location.hostname : "localhost");
            url.searchParams.set("embed_type", "Inline");
            url.searchParams.set("hide_gdpr_banner", "1");
        }
        return url.toString();
    } catch {
        return rawUrl;
    }
}

// ── Small helper: copy-to-clipboard pill button
function CopyPill({ text, label }: { text: string; label: string }) {
    const { success } = useToast();
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            onClick={() => {
                navigator.clipboard.writeText(text);
                success("Copié", `${label} dans le presse-papier`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            }}
            title={`Copier ${label}`}
            className="ml-auto shrink-0 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded transition-colors"
        >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </button>
    );
}

// ============================================
// BOOKING DIALOG — full-screen two-panel layout
// ============================================

export function BookingDrawer({
    isOpen,
    onClose,
    bookingUrl,
    contactId,
    contactName,
    contactInfo,
    rdvDate,
    meetingType,
    meetingCategory,
    meetingAddress,
    meetingJoinUrl,
    meetingPhone,
    onRdvDateChange,
    onMeetingTypeChange,
    onMeetingCategoryChange,
    onMeetingAddressChange,
    onMeetingJoinUrlChange,
    onMeetingPhoneChange,
    onBookingSuccess,
    interlocuteurs,
}: BookingDrawerProps) {
    const { success, error: showError } = useToast();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [booked, setBooked] = useState(false);
    const [iframeLoading, setIframeLoading] = useState(true);

    const [rdvDateLocal, setRdvDateLocal] = useState<string>(rdvDate ?? "");
    const [meetingTypeLocal, setMeetingTypeLocal] = useState<"" | "VISIO" | "PHYSIQUE" | "TELEPHONIQUE">(meetingType ?? "");
    const [meetingCategoryLocal, setMeetingCategoryLocal] = useState<"" | "EXPLORATOIRE" | "BESOIN">(meetingCategory ?? "");
    const [meetingAddressLocal, setMeetingAddressLocal] = useState<string>(meetingAddress ?? "");
    const [meetingJoinUrlLocal, setMeetingJoinUrlLocal] = useState<string>(meetingJoinUrl ?? "");
    const [meetingPhoneLocal, setMeetingPhoneLocal] = useState<string>(meetingPhone ?? "");

    const activeInterlocuteurs = (interlocuteurs || []).filter(
        i => i.isActive && i.bookingLinks.length > 0
    );

    // Build calendar options
    const bookingOptions: CalendarOption[] = [];
    if (bookingUrl?.trim()) {
        bookingOptions.push({
            id: "general",
            label: "Calendrier général",
            sublabel: "Lien de réservation client",
            url: bookingUrl,
            initials: "CG",
            avatarColor: "bg-slate-100 text-slate-600",
        });
    }
    activeInterlocuteurs.forEach((interl) => {
        const color = AVATAR_COLORS[hashStr(interl.id) % AVATAR_COLORS.length];
        const initials = `${interl.firstName[0]}${interl.lastName[0]}`.toUpperCase();
        interl.bookingLinks.forEach((bl, idx) => {
            bookingOptions.push({
                id: `${interl.id}-${idx}`,
                label: `${interl.firstName} ${interl.lastName}`,
                sublabel: `${bl.label} · ${bl.durationMinutes} min`,
                url: bl.url,
                initials,
                avatarColor: color,
            });
        });
    });

    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

    const selectedOption = bookingOptions.find(o => o.id === selectedOptionId) || bookingOptions[0] || null;
    const embedUrl = selectedOption ? getEmbedBookingUrl(selectedOption.url) : "";

    // Reset on open
    useEffect(() => {
        if (!isOpen) return;
        setBooked(false);
        setIsProcessing(false);
        setIframeLoading(true);
        setSelectedOptionId(bookingOptions[0]?.id ?? null);

        setRdvDateLocal(rdvDate ?? "");
        setMeetingTypeLocal(meetingType ?? "");
        setMeetingCategoryLocal(meetingCategory ?? "");
        setMeetingAddressLocal(meetingAddress ?? "");
        setMeetingJoinUrlLocal(meetingJoinUrl ?? "");
        setMeetingPhoneLocal(meetingPhone ?? "");
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const effectiveRdvDate = onRdvDateChange ? (rdvDate ?? "") : rdvDateLocal;
    const effectiveMeetingType = onMeetingTypeChange ? (meetingType ?? "") : meetingTypeLocal;
    const effectiveMeetingCategory = onMeetingCategoryChange ? (meetingCategory ?? "") : meetingCategoryLocal;
    const effectiveMeetingAddress = onMeetingAddressChange ? (meetingAddress ?? "") : meetingAddressLocal;
    const effectiveMeetingJoinUrl = onMeetingJoinUrlChange ? (meetingJoinUrl ?? "") : meetingJoinUrlLocal;
    const effectiveMeetingPhone = onMeetingPhoneChange ? (meetingPhone ?? "") : meetingPhoneLocal;

    const setEffectiveRdvDate = (v: string) => {
        onRdvDateChange?.(v);
        if (!onRdvDateChange) setRdvDateLocal(v);
    };
    const setEffectiveMeetingType = (v: "" | "VISIO" | "PHYSIQUE" | "TELEPHONIQUE") => {
        onMeetingTypeChange?.(v);
        if (!onMeetingTypeChange) setMeetingTypeLocal(v);
    };
    const setEffectiveMeetingCategory = (v: "" | "EXPLORATOIRE" | "BESOIN") => {
        onMeetingCategoryChange?.(v);
        if (!onMeetingCategoryChange) setMeetingCategoryLocal(v);
    };
    const setEffectiveMeetingAddress = (v: string) => {
        onMeetingAddressChange?.(v);
        if (!onMeetingAddressChange) setMeetingAddressLocal(v);
    };
    const setEffectiveMeetingJoinUrl = (v: string) => {
        onMeetingJoinUrlChange?.(v);
        if (!onMeetingJoinUrlChange) setMeetingJoinUrlLocal(v);
    };
    const setEffectiveMeetingPhone = (v: string) => {
        onMeetingPhoneChange?.(v);
        if (!onMeetingPhoneChange) setMeetingPhoneLocal(v);
    };

    const handleSelectCalendar = useCallback((id: string) => {
        if (id === selectedOptionId) return;
        setIframeLoading(true);
        setSelectedOptionId(id);
    }, [selectedOptionId]);

    // Listen for booking completion postMessage
    useEffect(() => {
        if (!isOpen) return;

        const handleMessage = async (event: MessageEvent) => {
            const origin = event.origin;
            const isAllowed =
                origin === window.location.origin ||
                origin.endsWith(".calendly.com") ||
                origin === "https://calendly.com" ||
                origin.endsWith(".cal.com") ||
                origin === "https://cal.com";

            if (!isAllowed) return;

            const processBooking = async (eventData: unknown) => {
                setIsProcessing(true);
                try {
                    if (effectiveMeetingType === "PHYSIQUE" && !effectiveMeetingAddress.trim()) {
                        showError("Adresse requise", "Veuillez renseigner une adresse pour un RDV physique.");
                        return;
                    }
                    const res = await fetch("/api/actions/booking-success", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contactId,
                            eventData,
                            rdvDate: effectiveRdvDate || undefined,
                            ...(effectiveMeetingType && { meetingType: effectiveMeetingType }),
                            ...(effectiveMeetingCategory && { meetingCategory: effectiveMeetingCategory }),
                            ...(effectiveMeetingAddress != null && effectiveMeetingAddress.trim() && { meetingAddress: effectiveMeetingAddress.trim() }),
                            ...(effectiveMeetingJoinUrl != null && effectiveMeetingJoinUrl.trim() && { meetingJoinUrl: effectiveMeetingJoinUrl.trim() }),
                            ...(effectiveMeetingPhone != null && effectiveMeetingPhone.trim() && { meetingPhone: effectiveMeetingPhone.trim() }),
                        }),
                    });
                    const json = await res.json();
                    if (json.success) {
                        setBooked(true);
                        success("Rendez-vous confirmé", `Le rendez-vous avec ${contactName} a été enregistré`);
                        onBookingSuccess?.();
                        setTimeout(onClose, 1800);
                    } else {
                        showError("Erreur", json.error || "Impossible d'enregistrer le rendez-vous");
                    }
                } catch (err) {
                    console.error("Failed to process booking:", err);
                    showError("Erreur", "Impossible d'enregistrer le rendez-vous");
                } finally {
                    setIsProcessing(false);
                }
            };

            if (event.data.event === "calendly.event_scheduled") {
                await processBooking(event.data.payload);
            } else if (event.data.type === "booking_success" || event.data.event === "booking.completed") {
                await processBooking(event.data);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [isOpen, contactId, contactName, effectiveRdvDate, effectiveMeetingType, effectiveMeetingCategory, effectiveMeetingAddress, effectiveMeetingJoinUrl, effectiveMeetingPhone, onBookingSuccess, onClose, success, showError]);

    if (!isOpen) return null;

    const formattedDate = effectiveRdvDate
        ? new Date(effectiveRdvDate).toLocaleString("fr-FR", {
            weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
        })
        : null;

    const contactInitials = (
        (contactInfo?.firstName?.[0] || "") + (contactInfo?.lastName?.[0] || "") || contactName?.[0] || "?"
    ).toUpperCase();

    const hasMultipleOptions = bookingOptions.length > 1;

    const activeMeetingTypeCfg = effectiveMeetingType
        ? MEETING_TYPE_CONFIG[effectiveMeetingType as keyof typeof MEETING_TYPE_CONFIG]
        : null;
    const activeMeetingCatCfg = effectiveMeetingCategory
        ? MEETING_CATEGORY_CONFIG[effectiveMeetingCategory as keyof typeof MEETING_CATEGORY_CONFIG]
        : null;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Dialog */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Planifier un RDV avec ${contactName}`}
                className="fixed z-[61] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-6xl h-[calc(100vh-3rem)] max-h-[860px] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
                style={{ animation: "dialogPop 0.2s cubic-bezier(0.34,1.56,0.64,1) both" }}
            >
                <style>{`
                  @keyframes dialogPop {
                    from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
                    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                  }
                `}</style>

                {/* ── Top bar ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-indigo-700 shrink-0 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm">
                            <CalendarCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-white">Planifier un rendez-vous</h2>
                            <p className="text-xs text-indigo-200 mt-0.5">
                                {contactName}
                                {contactInfo?.companyName ? ` — ${contactInfo.companyName}` : ""}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Summary badge when type + date are set */}
                        {effectiveMeetingType && (
                            <span className={cn(
                                "hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border",
                                activeMeetingTypeCfg?.pill || "bg-white/10 text-white",
                                "bg-white/15 border-white/20 text-white"
                            )}>
                                {activeMeetingTypeCfg && <activeMeetingTypeCfg.icon className="w-3.5 h-3.5" />}
                                {activeMeetingTypeCfg?.label}
                            </span>
                        )}
                        {formattedDate && (
                            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/15 border border-white/20 text-white capitalize truncate max-w-[200px]">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                {formattedDate}
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            aria-label="Fermer"
                            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ── Main body: left panel + right iframe ── */}
                <div className="flex flex-1 min-h-0">

                    {/* ══════════════════════════════════════════
                        LEFT PANEL — rich contact info + RDV form
                    ══════════════════════════════════════════ */}
                    <div className={cn(
                        "shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col overflow-y-auto",
                        hasMultipleOptions ? "w-[340px]" : "w-[300px]"
                    )}>

                        {/* ── Contact card (rich) ── */}
                        <div className="p-5 border-b border-slate-200 bg-white">
                            {/* Section label */}
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <User className="w-3 h-3" />
                                Contact
                            </p>

                            {/* Avatar + name row */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-600 flex items-center justify-center text-white text-base font-bold shrink-0 shadow-md ring-2 ring-indigo-100">
                                    {contactInitials}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-900 truncate leading-tight">
                                        {contactName || "Contact"}
                                    </p>
                                    {contactInfo?.title && (
                                        <p className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1">
                                            <Briefcase className="w-3 h-3 shrink-0 text-slate-400" />
                                            {contactInfo.title}
                                        </p>
                                    )}
                                    {contactInfo?.companyName && (
                                        <p className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1">
                                            <Building2 className="w-3 h-3 shrink-0 text-slate-400" />
                                            {contactInfo.companyName}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Contact info rows */}
                            <div className="space-y-1.5">
                                {contactInfo?.email && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 group/row hover:border-slate-200 transition-colors">
                                        <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                        <a
                                            href={`mailto:${contactInfo.email}`}
                                            className="text-xs text-slate-700 hover:text-indigo-600 truncate flex-1 min-w-0 transition-colors"
                                        >
                                            {contactInfo.email}
                                        </a>
                                        <CopyPill text={contactInfo.email} label="Email" />
                                    </div>
                                )}
                                {contactInfo?.phone && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 group/row hover:border-slate-200 transition-colors">
                                        <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <a
                                            href={`tel:${contactInfo.phone}`}
                                            className="text-xs text-slate-700 hover:text-emerald-600 flex-1 min-w-0 transition-colors"
                                        >
                                            {contactInfo.phone}
                                        </a>
                                        <CopyPill text={contactInfo.phone} label="Téléphone" />
                                    </div>
                                )}
                                {contactInfo?.linkedin && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                                        <Linkedin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        <a
                                            href={contactInfo.linkedin.startsWith("http") ? contactInfo.linkedin : `https://${contactInfo.linkedin}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-slate-700 hover:text-blue-600 truncate flex-1 transition-colors"
                                        >
                                            LinkedIn
                                        </a>
                                        <ExternalLink className="w-3 h-3 text-slate-300 mr-1" />
                                    </div>
                                )}
                                {contactInfo?.website && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                                        <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <a
                                            href={contactInfo.website.startsWith("http") ? contactInfo.website : `https://${contactInfo.website}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-slate-700 hover:text-indigo-600 truncate flex-1 transition-colors"
                                        >
                                            {contactInfo.website}
                                        </a>
                                        <ExternalLink className="w-3 h-3 text-slate-300 mr-1" />
                                    </div>
                                )}
                            </div>

                            {/* Quick-action buttons */}
                            {(contactInfo?.phone || contactInfo?.email) && (
                                <div className="flex gap-2 mt-3">
                                    {contactInfo?.phone && (
                                        <a
                                            href={`tel:${contactInfo.phone}`}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                                        >
                                            <PhoneCall className="w-3.5 h-3.5" />
                                            Appeler
                                        </a>
                                    )}
                                    {contactInfo?.email && (
                                        <a
                                            href={`mailto:${contactInfo.email}`}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            Email
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── RDV Details form ── */}
                        <div className="p-5 border-b border-slate-200 space-y-4">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                Détails du rendez-vous
                            </p>

                            {/* Date & time */}
                            <div>
                                <DateTimePicker
                                    label="Date et heure"
                                    value={effectiveRdvDate}
                                    onChange={setEffectiveRdvDate}
                                    placeholder="Choisir date et heure…"
                                    min={new Date().toISOString().slice(0, 16)}
                                    triggerClassName="border-slate-200 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white"
                                />
                                <p className="text-[11px] text-slate-400 mt-1.5 flex items-start gap-1">
                                    <Info className="w-3 h-3 shrink-0 mt-0.5 text-indigo-400" />
                                    Optionnel — le calendrier renverra automatiquement la date sélectionnée.
                                </p>
                            </div>

                            {/* Meeting type */}
                            <div>
                                <p className="text-xs font-semibold text-slate-700 mb-2">Type de réunion</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {(["VISIO", "PHYSIQUE", "TELEPHONIQUE"] as const).map((type) => {
                                        const cfg = MEETING_TYPE_CONFIG[type];
                                        const Icon = cfg.icon;
                                        const isSelected = effectiveMeetingType === type;
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setEffectiveMeetingType(isSelected ? "" : type)}
                                                className={cn(
                                                    "flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-semibold border transition-all duration-150",
                                                    isSelected
                                                        ? `${cfg.bg} ${cfg.border} ${cfg.color} ring-1 ring-inset ${cfg.border}`
                                                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                                                )}
                                                aria-pressed={isSelected}
                                            >
                                                <Icon className={cn("w-4 h-4", isSelected ? cfg.color : "text-slate-400")} />
                                                {cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Conditional sub-field */}
                            {effectiveMeetingType === "PHYSIQUE" && (
                                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                    <label htmlFor="booking-addr" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Adresse du RDV <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            id="booking-addr"
                                            type="text"
                                            value={effectiveMeetingAddress}
                                            onChange={(e) => setEffectiveMeetingAddress(e.target.value)}
                                            placeholder="Adresse complète du lieu"
                                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 transition-colors"
                                        />
                                    </div>
                                    {!effectiveMeetingAddress.trim() && (
                                        <p className="flex items-center gap-1 text-[11px] text-amber-600 mt-1.5">
                                            <AlertCircle className="w-3 h-3 shrink-0" />
                                            Requis pour finaliser la réservation
                                        </p>
                                    )}
                                </div>
                            )}
                            {effectiveMeetingType === "VISIO" && (
                                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                    <label htmlFor="booking-join" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Lien de connexion <span className="text-slate-400 font-normal">(optionnel)</span>
                                    </label>
                                    <div className="relative">
                                        <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            id="booking-join"
                                            type="url"
                                            value={effectiveMeetingJoinUrl}
                                            onChange={(e) => setEffectiveMeetingJoinUrl(e.target.value)}
                                            placeholder="https://zoom.us/… ou Meet…"
                                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-colors"
                                        />
                                    </div>
                                </div>
                            )}
                            {effectiveMeetingType === "TELEPHONIQUE" && (
                                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                    <label htmlFor="booking-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Numéro à appeler <span className="text-slate-400 font-normal">(optionnel)</span>
                                    </label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            id="booking-phone"
                                            type="tel"
                                            value={effectiveMeetingPhone}
                                            onChange={(e) => setEffectiveMeetingPhone(e.target.value)}
                                            placeholder={contactInfo?.phone ?? "Numéro du contact"}
                                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-colors"
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1.5">
                                        Par défaut : téléphone du contact si disponible.
                                    </p>
                                </div>
                            )}

                            {/* Category */}
                            <div>
                                <p className="text-xs font-semibold text-slate-700 mb-2">
                                    Catégorie <span className="text-slate-400 font-normal">(optionnel)</span>
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["EXPLORATOIRE", "BESOIN"] as const).map((cat) => {
                                        const cfg = MEETING_CATEGORY_CONFIG[cat];
                                        const isSelected = effectiveMeetingCategory === cat;
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setEffectiveMeetingCategory(isSelected ? "" : cat)}
                                                aria-pressed={isSelected}
                                                className={cn(
                                                    "flex flex-col items-start px-3 py-2.5 rounded-xl text-left border transition-all duration-150",
                                                    isSelected
                                                        ? `${cfg.bg} ${cfg.border} ${cfg.color} ring-1 ring-inset ${cfg.border}`
                                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                                )}
                                            >
                                                <span className="text-xs font-semibold leading-tight">{cfg.label}</span>
                                                <span className={cn(
                                                    "text-[10px] mt-0.5 leading-tight",
                                                    isSelected ? cfg.color : "text-slate-400"
                                                )}>
                                                    {cfg.desc}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Active selection summary pill */}
                            {(effectiveMeetingType || effectiveMeetingCategory || formattedDate) && (
                                <div className="flex flex-wrap gap-1.5 pt-1 animate-in fade-in duration-200">
                                    {effectiveMeetingType && activeMeetingTypeCfg && (
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                                            activeMeetingTypeCfg.bg,
                                            activeMeetingTypeCfg.border,
                                            activeMeetingTypeCfg.color
                                        )}>
                                            <activeMeetingTypeCfg.icon className="w-3 h-3" />
                                            {activeMeetingTypeCfg.label}
                                        </span>
                                    )}
                                    {effectiveMeetingCategory && activeMeetingCatCfg && (
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                                            activeMeetingCatCfg.bg,
                                            activeMeetingCatCfg.border,
                                            activeMeetingCatCfg.color
                                        )}>
                                            <Sparkles className="w-3 h-3" />
                                            {activeMeetingCatCfg.label}
                                        </span>
                                    )}
                                    {formattedDate && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 capitalize">
                                            <Clock className="w-3 h-3 shrink-0" />
                                            <span className="truncate max-w-[130px]">{formattedDate}</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Calendar selection ── */}
                        {bookingOptions.length > 0 && (
                            <div className="p-5 flex-1">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3" />
                                    {hasMultipleOptions ? "Choisir un calendrier" : "Calendrier"}
                                </p>
                                <div className="space-y-2">
                                    {bookingOptions.map((opt) => {
                                        const isSelected = selectedOption?.id === opt.id;
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => handleSelectCalendar(opt.id)}
                                                className={cn(
                                                    "w-full text-left rounded-xl border p-3 transition-all duration-150 group",
                                                    isSelected
                                                        ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200 shadow-sm"
                                                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                                                        isSelected ? "bg-indigo-600 text-white" : (opt.avatarColor || "bg-slate-100 text-slate-600")
                                                    )}>
                                                        {opt.initials || "CG"}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn(
                                                            "text-sm font-medium truncate",
                                                            isSelected ? "text-indigo-900" : "text-slate-800"
                                                        )}>
                                                            {opt.label}
                                                        </p>
                                                        {opt.sublabel && (
                                                            <p className={cn(
                                                                "text-xs truncate mt-0.5",
                                                                isSelected ? "text-indigo-600" : "text-slate-500"
                                                            )}>
                                                                {opt.sublabel}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {isSelected && (
                                                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                                    )}
                                                    {!isSelected && hasMultipleOptions && (
                                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── Bottom actions: copy / open link ── */}
                        {selectedOption && (
                            <div className="px-5 py-3 border-t border-slate-200 mt-auto space-y-2 bg-white">
                                <button
                                    type="button"
                                    onClick={() => { navigator.clipboard.writeText(selectedOption.url); success("Lien copié", ""); }}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    Copier le lien de réservation
                                </button>
                                <a
                                    href={selectedOption.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Ouvrir dans un nouvel onglet
                                </a>
                            </div>
                        )}
                    </div>

                    {/* ══════════════════════════════════════════
                        RIGHT PANEL — calendar iframe
                    ══════════════════════════════════════════ */}
                    <div className="flex-1 relative bg-white min-w-0">
                        {!selectedOption ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-50">
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                                    <Calendar className="w-8 h-8 text-slate-300" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-slate-600">Aucun calendrier configuré</p>
                                    <p className="text-xs text-slate-400 mt-1">Contactez votre administrateur</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Iframe loading spinner */}
                                {iframeLoading && !isProcessing && !booked && (
                                    <div className="absolute inset-0 bg-white z-[5] flex flex-col items-center justify-center gap-3">
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-full border-4 border-indigo-100" />
                                            <Loader2 className="w-7 h-7 text-indigo-500 animate-spin absolute inset-0 m-auto" />
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium">Chargement du calendrier…</p>
                                        <p className="text-xs text-slate-400">Merci de patienter</p>
                                    </div>
                                )}

                                {/* Processing overlay */}
                                {isProcessing && (
                                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4">
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-full border-4 border-indigo-100" />
                                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin absolute inset-0 m-auto" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-base font-semibold text-slate-800">Enregistrement…</p>
                                            <p className="text-sm text-slate-500 mt-1">Finalisation du rendez-vous</p>
                                        </div>
                                    </div>
                                )}

                                {/* Booked success */}
                                {booked && (
                                    <div className="absolute inset-0 bg-white z-10 flex flex-col items-center justify-center gap-6">
                                        <div
                                            className="w-24 h-24 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center"
                                            style={{ animation: "successPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}
                                        >
                                            <style>{`
                                              @keyframes successPop {
                                                from { transform: scale(0.5); opacity: 0; }
                                                to   { transform: scale(1); opacity: 1; }
                                              }
                                            `}</style>
                                            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xl font-bold text-slate-900">RDV confirmé !</p>
                                            <p className="text-sm text-slate-500 mt-1.5">
                                                Rendez-vous avec <span className="font-semibold text-slate-700">{contactName}</span> enregistré avec succès.
                                            </p>
                                            {effectiveMeetingType && activeMeetingTypeCfg && (
                                                <span className={cn(
                                                    "inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-sm font-semibold border",
                                                    activeMeetingTypeCfg.bg,
                                                    activeMeetingTypeCfg.border,
                                                    activeMeetingTypeCfg.color
                                                )}>
                                                    <activeMeetingTypeCfg.icon className="w-4 h-4" />
                                                    {activeMeetingTypeCfg.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <iframe
                                    ref={iframeRef}
                                    src={embedUrl}
                                    key={selectedOption.id}
                                    onLoad={() => setIframeLoading(false)}
                                    className="w-full h-full border-0"
                                    title={selectedOption.label}
                                    allow="camera; microphone; geolocation"
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default BookingDrawer;
