"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/components/ui";
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
    onBookingSuccess,
    interlocuteurs,
}: BookingDrawerProps) {
    const { success, error: showError } = useToast();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [booked, setBooked] = useState(false);
    const [iframeLoading, setIframeLoading] = useState(true);

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
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // When selection changes, show loading
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
                    const res = await fetch("/api/actions/booking-success", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contactId,
                            eventData,
                            rdvDate: rdvDate || undefined,
                            ...(meetingType && { meetingType }),
                            ...(meetingCategory && { meetingCategory }),
                            ...(meetingAddress != null && meetingAddress.trim() && { meetingAddress: meetingAddress.trim() }),
                            ...(meetingJoinUrl != null && meetingJoinUrl.trim() && { meetingJoinUrl: meetingJoinUrl.trim() }),
                            ...(meetingPhone != null && meetingPhone.trim() && { meetingPhone: meetingPhone.trim() }),
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
    }, [isOpen, contactId, contactName, rdvDate, meetingType, meetingCategory, meetingAddress, meetingJoinUrl, meetingPhone, onBookingSuccess, onClose, success, showError]);

    if (!isOpen) return null;

    const formattedDate = rdvDate
        ? new Date(rdvDate).toLocaleString("fr-FR", {
            weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
        })
        : null;

    const contactInitials = (
        (contactInfo?.firstName?.[0] || "") + (contactInfo?.lastName?.[0] || "") || contactName?.[0] || "?"
    ).toUpperCase();

    const hasMultipleOptions = bookingOptions.length > 1;

    return (
        <>
            {/* Overlay */}
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />

            {/* Dialog — centered, capped width, never goes under sidebar */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Planifier un RDV avec ${contactName}`}
                className="fixed z-[61] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-5xl h-[calc(100%-3rem)] max-h-[780px] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
            >
                {/* ── Top bar ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
                            <Calendar className="w-4.5 h-4.5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Planifier un rendez-vous</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {contactName}
                                {contactInfo?.companyName ? ` — ${contactInfo.companyName}` : ""}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Fermer"
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Main body: sidebar + iframe ── */}
                <div className="flex flex-1 min-h-0">

                    {/* ── Left sidebar ── */}
                    <div className={cn(
                        "shrink-0 border-r border-slate-200 bg-slate-50/70 flex flex-col overflow-y-auto",
                        hasMultipleOptions ? "w-[320px]" : "w-[280px]"
                    )}>

                        {/* Contact card */}
                        <div className="p-5 border-b border-slate-200">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Contact</p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                                    {contactInitials}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">{contactName || "Contact"}</p>
                                    {contactInfo?.title && (
                                        <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                            <Briefcase className="w-3 h-3 shrink-0" />
                                            {contactInfo.title}
                                        </p>
                                    )}
                                    {contactInfo?.companyName && (
                                        <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                            <Building2 className="w-3 h-3 shrink-0" />
                                            {contactInfo.companyName}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {(contactInfo?.email || contactInfo?.phone) && (
                                <div className="mt-3 space-y-1.5">
                                    {contactInfo?.email && (
                                        <div className="flex items-center gap-2 group">
                                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="text-xs text-slate-600 truncate">{contactInfo.email}</span>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(contactInfo.email!); success("Copié", ""); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0"
                                            >
                                                <Copy className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                                            </button>
                                        </div>
                                    )}
                                    {contactInfo?.phone && (
                                        <div className="flex items-center gap-2 group">
                                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="text-xs text-slate-600">{contactInfo.phone}</span>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(contactInfo.phone!); success("Copié", ""); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0"
                                            >
                                                <Copy className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Date badge */}
                        {formattedDate && (
                            <div className="px-5 py-3 border-b border-slate-200">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Date prévue</p>
                                <div className="flex items-center gap-2 text-sm text-indigo-700 font-medium capitalize">
                                    <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                                    {formattedDate}
                                </div>
                            </div>
                        )}

                        {/* Calendar selection */}
                        {bookingOptions.length > 0 && (
                            <div className="p-5 flex-1">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
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
                                                        <CheckCircle2 className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
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

                        {/* Copy/open link */}
                        {selectedOption && (
                            <div className="px-5 py-3 border-t border-slate-200 mt-auto space-y-2">
                                <button
                                    type="button"
                                    onClick={() => { navigator.clipboard.writeText(selectedOption.url); success("Lien copié", ""); }}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    Copier le lien
                                </button>
                                <a
                                    href={selectedOption.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Ouvrir dans un nouvel onglet
                                </a>
                            </div>
                        )}
                    </div>

                    {/* ── Right panel: iframe ── */}
                    <div className="flex-1 relative bg-white min-w-0">
                        {!selectedOption ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50">
                                <Calendar className="w-12 h-12 text-slate-200" />
                                <p className="text-sm text-slate-400">Aucun calendrier configuré pour ce client.</p>
                            </div>
                        ) : (
                            <>
                                {/* Iframe loading spinner */}
                                {iframeLoading && !isProcessing && !booked && (
                                    <div className="absolute inset-0 bg-white z-[5] flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
                                        <p className="text-sm text-slate-500">Chargement du calendrier…</p>
                                    </div>
                                )}

                                {/* Processing overlay */}
                                {isProcessing && (
                                    <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                        <p className="text-sm font-medium text-slate-700">Enregistrement du rendez-vous…</p>
                                    </div>
                                )}

                                {/* Booked success */}
                                {booked && (
                                    <div className="absolute inset-0 bg-white z-10 flex flex-col items-center justify-center gap-5">
                                        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-semibold text-slate-900">RDV confirmé !</p>
                                            <p className="text-sm text-slate-500 mt-1">
                                                Rendez-vous avec {contactName} enregistré
                                            </p>
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
