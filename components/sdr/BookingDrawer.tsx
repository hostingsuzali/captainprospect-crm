"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui";
import {
    Loader2,
    Calendar,
    X,
    ExternalLink,
    User,
    Mail,
    Phone,
    Building2,
    Briefcase,
    CheckCircle2,
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

interface BookingDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    bookingUrl: string;
    contactId: string;
    contactName: string;
    contactInfo?: BookingContactInfo;
    rdvDate?: string; // ISO string pre-selected date
    onBookingSuccess?: () => void;
}

// ============================================
// BOOKING DRAWER — second right-side panel
// slides in next to the UnifiedDrawer, no dark overlay
// ============================================

export function BookingDrawer({
    isOpen,
    onClose,
    bookingUrl,
    contactId,
    contactName,
    contactInfo,
    rdvDate,
    onBookingSuccess,
}: BookingDrawerProps) {
    const { success, error: showError } = useToast();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [booked, setBooked] = useState(false);

    // Reset state when drawer opens
    useEffect(() => {
        if (isOpen) setBooked(false);
    }, [isOpen]);

    // Listen for postMessage events from booking tools (Calendly, cal.com, etc.)
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
                        }),
                    });

                    const json = await res.json();

                    if (json.success) {
                        setBooked(true);
                        success(
                            "Rendez-vous confirmé",
                            `Le rendez-vous avec ${contactName} a été enregistré`
                        );
                        onBookingSuccess?.();
                        setTimeout(() => {
                            onClose();
                        }, 1800);
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
            } else if (
                event.data.type === "booking_success" ||
                event.data.event === "booking.completed"
            ) {
                await processBooking(event.data);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [isOpen, contactId, contactName, rdvDate, onBookingSuccess, onClose, success, showError]);

    if (!isOpen) return null;

    // Format the pre-selected date for display
    const formattedDate = rdvDate
        ? new Date(rdvDate).toLocaleString("fr-FR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
        : null;

    // Initials for avatar
    const initials = (
        (contactInfo?.firstName?.[0] || "") + (contactInfo?.lastName?.[0] || "") ||
        contactName?.[0] ||
        "?"
    ).toUpperCase();

    return (
        <>
            {/* Very light overlay — won't block the main drawer visually */}
            <div
                className="fixed inset-0 z-[49] bg-black/10"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Second drawer panel */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Planifier un RDV avec ${contactName}`}
                className={cn(
                    "fixed top-0 bottom-0 right-0 z-[50] w-full max-w-[480px]",
                    "flex flex-col bg-white shadow-2xl shadow-black/25",
                    "animate-slide-in-right border-l border-slate-200"
                )}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-700">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white leading-tight">
                                Planifier un rendez-vous
                            </h2>
                            <p className="text-xs text-indigo-200 mt-0.5">Calendrier client</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Fermer"
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Contact Card ── */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                            {initials}
                        </div>

                        {/* Contact details */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                                {contactName || "Contact"}
                            </p>
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

                    {/* Contact meta row */}
                    {(contactInfo?.email || contactInfo?.phone) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 pl-[52px]">
                            {contactInfo?.email && (
                                <a
                                    href={`mailto:${contactInfo.email}`}
                                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline truncate max-w-full"
                                >
                                    <Mail className="w-3 h-3 shrink-0" />
                                    {contactInfo.email}
                                </a>
                            )}
                            {contactInfo?.phone && (
                                <a
                                    href={`tel:${contactInfo.phone}`}
                                    className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                                >
                                    <Phone className="w-3 h-3 shrink-0" />
                                    {contactInfo.phone}
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Pre-selected date badge ── */}
                {formattedDate && (
                    <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <div className="min-w-0">
                            <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
                                Date prévue —{" "}
                            </span>
                            <span className="text-xs font-semibold text-indigo-800 capitalize">
                                {formattedDate}
                            </span>
                        </div>
                    </div>
                )}

                {/* ── Hint banner ── */}
                <div className="px-4 py-2 bg-white border-b border-slate-100">
                    <p className="text-xs text-slate-500">
                        Confirmez le créneau dans le calendrier ci-dessous.{" "}
                        <span className="font-medium text-slate-700">
                            Le RDV sera enregistré automatiquement.
                        </span>
                    </p>
                </div>

                {/* ── Iframe ── */}
                <div className="flex-1 overflow-hidden relative">
                    {/* Processing overlay */}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            <p className="text-sm font-medium text-slate-700">
                                Enregistrement du rendez-vous…
                            </p>
                        </div>
                    )}

                    {/* Booked success overlay */}
                    {booked && (
                        <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <div className="text-center">
                                <p className="text-base font-semibold text-slate-900">RDV confirmé !</p>
                                <p className="text-sm text-slate-500 mt-1">
                                    Rendez-vous avec {contactName} enregistré
                                </p>
                            </div>
                        </div>
                    )}

                    <iframe
                        ref={iframeRef}
                        src={bookingUrl}
                        className="w-full h-full border-0"
                        title="Booking Calendar"
                        allow="camera; microphone; geolocation"
                    />
                </div>

                {/* ── Footer fallback ── */}
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <p className="text-xs text-slate-400">Problème avec le calendrier intégré ?</p>
                    <a
                        href={bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                        <ExternalLink className="w-3 h-3" />
                        Ouvrir dans un onglet
                    </a>
                </div>
            </div>
        </>
    );
}

export default BookingDrawer;
