"use client";

import { useState, useEffect, useMemo } from "react";
import { Button, Select, Drawer, Modal, ConfirmModal, ContextMenu, useContextMenu, useToast } from "@/components/ui";
import { getPresetRange, toISO } from "@/components/dashboard/DateRangeFilter";
import {
    Calendar,
    User,
    Building2,
    Video,
    Loader2,
    Mail,
    Phone,
    Linkedin,
    ArrowRight,
    Save,
    RotateCcw,
    Eye,
    CalendarClock,
    XCircle,
    Trash2,
    Download,
    Circle,
} from "lucide-react";
import {
    MEETING_CANCELLATION_REASONS,
    getMeetingCancellationLabel,
} from "@/lib/constants/meetingCancellationReasons";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

type MeetingResult = "MEETING_BOOKED" | "MEETING_CANCELLED";

interface Meeting {
    id: string;
    createdAt: string;
    result?: MeetingResult;
    note?: string;
    callbackDate?: string | null;
    cancellationReason?: string;
    contact: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        title: string | null;
        email: string | null;
        phone?: string | null;
        linkedin?: string | null;
        company: {
            id: string;
            name: string;
            country?: string | null;
            industry?: string | null;
            website?: string | null;
            size?: string | null;
            list?: {
                id: string;
                name: string;
            } | null;
        };
    };
    mission: {
        id: string;
        name: string;
        client: {
            id: string;
            name: string;
        };
    } | null;
    list?: {
        id: string;
        name: string;
    } | null;
}

interface Mission {
    id: string;
    name: string;
    client: {
        name: string;
    };
}

interface List {
    id: string;
    name: string;
    mission: {
        id: string;
        name: string;
    };
}

type RdvStatus = "upcoming" | "past" | "rescheduled" | "cancelled";

function getRdvStatus(m: Meeting): RdvStatus {
    if (m.result === "MEETING_CANCELLED") return "cancelled";
    const meetingDate = m.callbackDate ? new Date(m.callbackDate) : new Date(m.createdAt);
    return meetingDate > new Date() ? "upcoming" : "past";
}

function getMeetingDisplayDate(m: Meeting): Date {
    return m.callbackDate ? new Date(m.callbackDate) : new Date(m.createdAt);
}

function getInitials(m: Meeting): string {
    const f = m.contact.firstName?.[0] ?? "";
    const l = m.contact.lastName?.[0] ?? "";
    return (f + l).toUpperCase() || "?";
}

const AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#059669", "#d97706", "#0ea5e9", "#ec4899", "#64748b"];

function getAvatarColor(m: Meeting): string {
    let h = 0;
    for (let i = 0; i < m.id.length; i++) h = ((h << 5) - h) + m.id.charCodeAt(i);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ============================================
// SDR MEETINGS PAGE
// ============================================

export default function SDRMeetingsPage() {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<RdvStatus | "all">("all");

    // Fetch meetings
    useEffect(() => {
        const fetchMeetings = async () => {
            setIsLoading(true);
            try {
                const { start, end } = getPresetRange("last12months");
                const params = new URLSearchParams({
                    startDate: toISO(start),
                    endDate: toISO(end),
                });
                const res = await fetch(`/api/sdr/meetings?${params.toString()}`);
                const json = await res.json();
                if (json.success) {
                    setMeetings(json.data);
                }
            } catch (err) {
                console.error("Failed to fetch meetings:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMeetings();
    }, []);

    // Stats by status
    const stats = useMemo(() => {
        const upcoming = meetings.filter((m) => getRdvStatus(m) === "upcoming").length;
        const past = meetings.filter((m) => getRdvStatus(m) === "past").length;
        const rescheduled = meetings.filter((m) => getRdvStatus(m) === "rescheduled").length;
        const cancelled = meetings.filter((m) => getRdvStatus(m) === "cancelled").length;
        return { upcoming, past, rescheduled, cancelled, all: meetings.length };
    }, [meetings]);

    // Filtered meetings by status tab
    const filteredMeetings = useMemo(() => {
        if (statusFilter === "all") return meetings;
        return meetings.filter((m) => getRdvStatus(m) === statusFilter);
    }, [meetings, statusFilter]);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [editNote, setEditNote] = useState("");
    const [editResult, setEditResult] = useState<MeetingResult>("MEETING_BOOKED");
    const [saving, setSaving] = useState(false);
    const [savingError, setSavingError] = useState<string | null>(null);
    const [remettreSubmitting, setRemettreSubmitting] = useState(false);

    // Cancel-with-reason modal
    const [cancelModalMeeting, setCancelModalMeeting] = useState<Meeting | null>(null);
    const [cancelReason, setCancelReason] = useState<string>("");
    const [cancelNote, setCancelNote] = useState("");
    const [cancelSubmitting, setCancelSubmitting] = useState(false);

    // Reschedule modal
    const [rescheduleMeeting, setRescheduleMeeting] = useState<Meeting | null>(null);
    const [rescheduleDateValue, setRescheduleDateValue] = useState("");
    const [rescheduleNote, setRescheduleNote] = useState("");
    const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

    // Delete confirm
    const [deleteConfirmMeeting, setDeleteConfirmMeeting] = useState<Meeting | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Context menu (right-click)
    const { position: contextMenuPosition, contextData: contextMenuMeeting, handleContextMenu, close: closeContextMenu } = useContextMenu();
    const { success: showSuccess, error: showError } = useToast();

    function formatScheduledDate(meeting: Meeting): string {
        const date = meeting.callbackDate ? new Date(meeting.callbackDate) : new Date(meeting.createdAt);
        return date.toLocaleDateString("fr-FR", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    // Sync edit state when modal opens
    useEffect(() => {
        if (selectedMeeting) {
            setEditNote(selectedMeeting.note ?? "");
            setEditResult((selectedMeeting.result as MeetingResult) || "MEETING_BOOKED");
            setSavingError(null);
        }
    }, [selectedMeeting]);

    const handleSaveMeeting = async () => {
        if (!selectedMeeting) return;
        setSaving(true);
        setSavingError(null);
        try {
            const res = await fetch(`/api/actions/${selectedMeeting.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ result: editResult, note: editNote || undefined }),
            });
            const json = await res.json();
            if (!json.success) {
                setSavingError(json.error || "Erreur lors de l'enregistrement");
                return;
            }
            setMeetings((prev) =>
                prev.map((m) =>
                    m.id === selectedMeeting.id
                        ? { ...m, result: editResult, note: editNote || undefined }
                        : m
                )
            );
            setSelectedMeeting((prev) =>
                prev && prev.id === selectedMeeting.id
                    ? { ...prev, result: editResult, note: editNote || undefined }
                    : prev
            );
        } catch (err) {
            setSavingError("Erreur réseau");
        } finally {
            setSaving(false);
        }
    };

    const openCancelModal = (meeting: Meeting) => {
        setCancelModalMeeting(meeting);
        setCancelReason("");
        setCancelNote("");
    };

    const handleConfirmCancel = async () => {
        if (!cancelModalMeeting || !cancelReason.trim()) return;
        setCancelSubmitting(true);
        setSavingError(null);
        try {
            const res = await fetch(`/api/actions/${cancelModalMeeting.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    result: "MEETING_CANCELLED",
                    cancellationReason: cancelReason,
                    note: cancelNote.trim() || undefined,
                }),
            });
            const json = await res.json();
            if (!json.success) {
                setSavingError(json.error || "Erreur");
                return;
            }
            const updated = {
                ...cancelModalMeeting,
                result: "MEETING_CANCELLED" as const,
                note: cancelNote.trim() || cancelModalMeeting.note,
                cancellationReason: cancelReason,
            };
            setMeetings((prev) =>
                prev.map((m) => (m.id === cancelModalMeeting.id ? updated : m))
            );
            if (selectedMeeting?.id === cancelModalMeeting.id) {
                setSelectedMeeting(updated);
                setEditResult("MEETING_CANCELLED");
                setEditNote(cancelNote.trim() || (updated.note ?? ""));
            }
            setCancelModalMeeting(null);
            showSuccess("RDV annulé");
        } catch (err) {
            setSavingError("Erreur réseau");
        } finally {
            setCancelSubmitting(false);
        }
    };

    const openRescheduleModal = (meeting: Meeting) => {
        setRescheduleMeeting(meeting);
        const base = meeting.callbackDate ? new Date(meeting.callbackDate) : new Date(meeting.createdAt);
        setRescheduleDateValue(base.toISOString().slice(0, 16));
        setRescheduleNote("");
    };

    const handleConfirmReschedule = async () => {
        if (!rescheduleMeeting || !rescheduleDateValue) return;
        setRescheduleSubmitting(true);
        setSavingError(null);
        try {
            const res = await fetch(`/api/actions/${rescheduleMeeting.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    callbackDate: new Date(rescheduleDateValue).toISOString(),
                    note: rescheduleNote.trim() ? rescheduleNote.trim() : rescheduleMeeting.note,
                }),
            });
            const json = await res.json();
            if (!json.success) {
                setSavingError(json.error || "Erreur");
                return;
            }
            const updated = {
                ...rescheduleMeeting,
                callbackDate: new Date(rescheduleDateValue).toISOString(),
                note: rescheduleNote.trim() || rescheduleMeeting.note,
            };
            setMeetings((prev) =>
                prev.map((m) => (m.id === rescheduleMeeting.id ? updated : m))
            );
            if (selectedMeeting?.id === rescheduleMeeting.id) setSelectedMeeting(updated);
            setRescheduleMeeting(null);
            showSuccess("RDV reprogrammé");
        } catch (err) {
            setSavingError("Erreur réseau");
        } finally {
            setRescheduleSubmitting(false);
        }
    };

    const handleDeleteMeeting = async () => {
        if (!deleteConfirmMeeting) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/actions/${deleteConfirmMeeting.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                showError(json?.error || "Erreur lors de la suppression");
                return;
            }
            setMeetings((prev) => prev.filter((m) => m.id !== deleteConfirmMeeting.id));
            if (selectedMeeting?.id === deleteConfirmMeeting.id) setSelectedMeeting(null);
            setDeleteConfirmMeeting(null);
            closeContextMenu();
            showSuccess("Rendez-vous supprimé");
        } catch (err) {
            showError("Erreur de connexion");
        } finally {
            setDeleting(false);
        }
    };

    const getContextMenuItems = (meeting: Meeting) => [
        {
            label: "Ouvrir",
            icon: <Eye className="w-4 h-4" />,
            onClick: () => setSelectedMeeting(meeting),
        },
        ...(meeting.result === "MEETING_BOOKED"
            ? [
                  {
                      label: "Reprogrammer le RDV",
                      icon: <CalendarClock className="w-4 h-4" />,
                      onClick: () => openRescheduleModal(meeting),
                  },
                  {
                      label: "Annuler le RDV",
                      icon: <XCircle className="w-4 h-4" />,
                      onClick: () => openCancelModal(meeting),
                  },
              ]
            : []),
        {
            label: "Supprimer",
            icon: <Trash2 className="w-4 h-4" />,
            onClick: () => setDeleteConfirmMeeting(meeting),
            variant: "danger" as const,
            divider: true,
        },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">Chargement des rendez-vous...</p>
                </div>
            </div>
        );
    }

    const statusBadge = (status: RdvStatus) => {
        const config = {
            upcoming: { label: "À venir", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <Circle className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600 shrink-0" /> },
            past: { label: "Passé", cls: "bg-slate-100 text-slate-600 border-slate-200", icon: <Circle className="w-2.5 h-2.5 fill-slate-400 text-slate-400 shrink-0" /> },
            rescheduled: { label: "Reporté", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Circle className="w-2.5 h-2.5 fill-amber-500 text-amber-500 shrink-0" /> },
            cancelled: { label: "Annulé", cls: "bg-red-50 text-red-700 border-red-200", icon: <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500 shrink-0" /> },
        };
        const c = config[status] ?? config.past;
        return (
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border", c.cls)}>
                {c.icon}
                {c.label}
            </span>
        );
    };

    const formatCardTime = (d: Date) =>
        d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    const formatCardMonth = (d: Date) =>
        d.toLocaleDateString("fr-FR", { month: "short" }).toUpperCase().replace(".", "");

    return (
        <div className="space-y-6 animate-fade-in p-2 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-900">
                        Mes Rendez-vous
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        Consultez, qualifiez et gérez vos rendez-vous
                    </p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 shrink-0">
                    <Download className="w-4 h-4" />
                    Exporter
                </Button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { key: "upcoming", label: "À venir", val: stats.upcoming, icon: "calendar", color: "emerald" },
                    { key: "past", label: "Passés", val: stats.past, icon: "clock", color: "slate" },
                    { key: "rescheduled", label: "Reportés", val: stats.rescheduled, icon: "calendar-clock", color: "amber" },
                    { key: "cancelled", label: "Annulés", val: stats.cancelled, icon: "x-circle", color: "red" },
                ].map((s) => (
                    <div
                        key={s.key}
                        className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-3"
                    >
                        <div
                            className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                                s.color === "emerald" && "bg-emerald-50",
                                s.color === "slate" && "bg-slate-100",
                                s.color === "amber" && "bg-amber-50",
                                s.color === "red" && "bg-red-50"
                            )}
                        >
                            <Calendar className={cn("w-4 h-4", s.color === "emerald" && "text-emerald-600", s.color === "slate" && "text-slate-600", s.color === "amber" && "text-amber-600", s.color === "red" && "text-red-600")} />
                        </div>
                        <div>
                            <div className={cn("text-xl font-extrabold tracking-tight", s.color === "emerald" && "text-emerald-700", s.color === "slate" && "text-slate-700", s.color === "amber" && "text-amber-700", s.color === "red" && "text-red-700")}>
                                {s.val}
                            </div>
                            <div className="text-xs text-slate-500">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-1 p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm w-fit">
                {(["all", "upcoming", "past", "rescheduled", "cancelled"] as const).map((f) => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => setStatusFilter(f)}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
                            statusFilter === f
                                ? "bg-indigo-600 text-white shadow-md"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                        )}
                    >
                        {f === "all" ? "Tous" : f === "upcoming" ? "À venir" : f === "past" ? "Passés" : f === "rescheduled" ? "Reportés" : "Annulés"}
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full", statusFilter === f ? "bg-white/20" : "bg-slate-200 text-slate-600")}>
                            {f === "all" ? stats.all : f === "upcoming" ? stats.upcoming : f === "past" ? stats.past : f === "rescheduled" ? stats.rescheduled : stats.cancelled}
                        </span>
                    </button>
                ))}
            </div>

            {/* List */}
            {filteredMeetings.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                    <Calendar className="w-14 h-14 mx-auto mb-3 text-slate-300" strokeWidth={1.5} />
                    <h3 className="text-lg font-semibold text-slate-800">Aucun rendez-vous</h3>
                    <p className="text-slate-500 mt-1 max-w-sm mx-auto text-sm">
                        {statusFilter === "all"
                            ? "Vos rendez-vous validés apparaîtront ici."
                            : statusFilter === "upcoming"
                                ? "Aucun rendez-vous à venir."
                                : statusFilter === "past"
                                    ? "Aucun rendez-vous passé."
                                    : statusFilter === "rescheduled"
                                        ? "Aucun rendez-vous reporté."
                                        : "Aucun rendez-vous annulé."}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {filteredMeetings.map((meeting) => {
                        const d = getMeetingDisplayDate(meeting);
                        const status = getRdvStatus(meeting);
                        return (
                            <div
                                key={meeting.id}
                                className="group bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                                onClick={() => setSelectedMeeting(meeting)}
                                onContextMenu={(e) => handleContextMenu(e, meeting)}
                            >
                                <div className="flex flex-col sm:flex-row">
                                    {/* Date col - ticket style */}
                                    <div className="relative sm:w-20 shrink-0 p-4 flex flex-col items-center justify-center bg-gradient-to-br from-violet-500 to-violet-600 text-white border-b sm:border-b-0 sm:border-r-0 border-violet-400/30 shadow-[2px_0_8px_rgba(139,92,246,0.25)] after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:w-4 after:h-4 after:rounded-full after:bg-white after:content-[''] sm:rounded-l-xl">
                                        <div className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">{d.getDate()}</div>
                                        <div className="text-[11px] font-semibold text-violet-100 uppercase tracking-wide mt-0.5">{formatCardMonth(d)}</div>
                                        <div className="text-xs font-semibold text-violet-200 mt-1">{formatCardTime(d)}</div>
                                    </div>

                                    {/* Main */}
                                    <div className="flex-1 p-4 sm:p-5 flex flex-col gap-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {statusBadge(status)}
                                            {meeting.mission && (
                                                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                                                    {meeting.mission.name}
                                                </span>
                                            )}
                                            {meeting.list && (
                                                <span className="text-xs text-slate-500">{meeting.list.name}</span>
                                            )}
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                                                    style={{ backgroundColor: getAvatarColor(meeting) }}
                                                >
                                                    {getInitials(meeting)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900">{meeting.contact.firstName} {meeting.contact.lastName}</div>
                                                    <div className="text-xs text-slate-500">{meeting.contact.title ?? ""}</div>
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        {meeting.contact.email && (
                                                            <a href={`mailto:${meeting.contact.email}`} className="text-xs text-indigo-600 hover:underline bg-indigo-50 px-2 py-0.5 rounded inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                <Mail className="w-3 h-3" />{meeting.contact.email}
                                                            </a>
                                                        )}
                                                        {meeting.contact.phone && (
                                                            <a href={`tel:${meeting.contact.phone}`} className="text-xs text-indigo-600 hover:underline bg-indigo-50 px-2 py-0.5 rounded inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                <Phone className="w-3 h-3" />{meeting.contact.phone}
                                                            </a>
                                                        )}
                                                        {meeting.contact.linkedin && (
                                                            <a href={meeting.contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline bg-indigo-50 px-2 py-0.5 rounded inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                <Linkedin className="w-3 h-3" />LinkedIn
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="sm:border-l sm:border-slate-200 sm:pl-6 flex flex-col gap-0.5">
                                                <div className="font-semibold text-slate-900">{meeting.contact.company.name}</div>
                                                <div className="text-xs text-slate-500 flex flex-wrap gap-x-2 gap-y-0">
                                                    {meeting.contact.company.industry && <span>{meeting.contact.company.industry}</span>}
                                                    {meeting.contact.company.country && <span className="inline-flex items-center gap-1"><Circle className="w-1 h-1 fill-current shrink-0" />{meeting.contact.company.country}</span>}
                                                    {meeting.contact.company.size && <span className="inline-flex items-center gap-1"><Circle className="w-1 h-1 fill-current shrink-0" />{meeting.contact.company.size}</span>}
                                                    {meeting.contact.company.website && (
                                                        <a href={meeting.contact.company.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                                                            {meeting.contact.company.website.replace(/^https?:\/\//, "")}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {meeting.note && (
                                            <div className="text-sm text-slate-600 bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 rounded-r italic">
                                                &ldquo;{meeting.note}&rdquo;
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="sm:w-40 shrink-0 p-4 border-t sm:border-t-0 sm:border-l border-slate-200 flex flex-col justify-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full justify-center gap-1.5 text-xs"
                                            onClick={(e) => { e.stopPropagation(); setSelectedMeeting(meeting); }}
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            Voir le détail
                                        </Button>
                                        {meeting.result === "MEETING_BOOKED" && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full justify-center gap-1.5 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                                    onClick={(e) => { e.stopPropagation(); openRescheduleModal(meeting); }}
                                                >
                                                    <CalendarClock className="w-3.5 h-3.5" />
                                                    Reprogrammer
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full justify-center gap-1.5 text-xs text-amber-700 hover:bg-amber-50"
                                                    onClick={(e) => { e.stopPropagation(); openCancelModal(meeting); }}
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Annuler
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Meeting Detail Drawer */}
            {selectedMeeting && (
                <Drawer
                    isOpen={!!selectedMeeting}
                    onClose={() => setSelectedMeeting(null)}
                    title="Détails du rendez-vous"
                    description={selectedMeeting ? formatScheduledDate(selectedMeeting) : undefined}
                    size="xl"
                    footer={
                        <div className="flex justify-end gap-2 w-full">
                            {savingError && (
                                <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl flex-1">{savingError}</p>
                            )}
                            <Button variant="ghost" onClick={() => setSelectedMeeting(null)}>
                                Fermer
                            </Button>
                            <Button onClick={handleSaveMeeting} disabled={saving} className="gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Enregistrer
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-8">
                        {/* Top Card: Date & Context */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 text-white flex flex-col justify-between shadow-lg shadow-indigo-200">
                                <div>
                                    <p className="text-indigo-100 text-sm font-medium uppercase tracking-wide">Date & Heure du RDV</p>
                                    <p className="text-lg font-semibold mt-2">
                                        {formatScheduledDate(selectedMeeting)}
                                    </p>
                                </div>
                            </div>

                            <div className="md:col-span-2 bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <p className="text-slate-500 text-sm font-bold uppercase tracking-wide">Statut du RDV</p>
                                        <Select
                                            value={editResult}
                                            onChange={(v) => {
                                                if (v === "MEETING_CANCELLED") openCancelModal(selectedMeeting);
                                                else setEditResult(v as MeetingResult);
                                            }}
                                            options={[
                                                { value: "MEETING_BOOKED", label: "Confirmé" },
                                                { value: "MEETING_CANCELLED", label: "Annulé" },
                                            ]}
                                            className="min-w-[140px] border border-slate-200 rounded-xl bg-white"
                                        />
                                    </div>
                                    {editResult === "MEETING_CANCELLED" && (
                                        <>
                                            {selectedMeeting.cancellationReason && (
                                                <p className="text-sm text-slate-600 bg-slate-100 rounded-lg px-3 py-2">
                                                    Raison : {getMeetingCancellationLabel(selectedMeeting.cancellationReason)}
                                                </p>
                                            )}
                                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                                                Le contact redevient disponible dans la file de prospection (Actions).
                                            </p>
                                        </>
                                    )}
                                    {editResult === "MEETING_BOOKED" && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => openRescheduleModal(selectedMeeting)}
                                                className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                            >
                                                <CalendarClock className="w-4 h-4" />
                                                Reprogrammer le RDV
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => openCancelModal(selectedMeeting)}
                                                disabled={saving || cancelSubmitting}
                                                className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                                            >
                                                {cancelSubmitting ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="w-4 h-4" />
                                                )}
                                                Annuler le RDV
                                            </Button>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                        {selectedMeeting.mission && (
                                            <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                                <span className="text-sm font-medium text-slate-700">{selectedMeeting.mission.name}</span>
                                            </div>
                                        )}
                                        {selectedMeeting.mission?.client && (
                                            <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                                <User className="w-3 h-3 text-slate-400" />
                                                <span className="text-sm font-medium text-slate-700">{selectedMeeting.mission.client.name}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2 text-sm text-slate-500">
                                    <Video className="w-4 h-4 text-indigo-500" />
                                    <span>Lieu : Visio Conférence</span>
                                </div>
                            </div>
                        </div>

                        {/* Middle: Contact & Company */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <User className="w-4 h-4 text-indigo-500" />
                                    Contact
                                </h3>
                                <div className="bg-white border ring-1 ring-slate-100/50 border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                    <p className="text-lg font-bold text-slate-900">
                                        {selectedMeeting.contact.firstName} {selectedMeeting.contact.lastName}
                                    </p>
                                    <p className="text-slate-500 font-medium mb-4">{selectedMeeting.contact.title}</p>

                                    <div className="space-y-2">
                                        {selectedMeeting.contact.email && (
                                            <a href={`mailto:${selectedMeeting.contact.email}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                                    <Mail className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" />
                                                </div>
                                                <span className="text-sm text-slate-600 group-hover:text-indigo-700">{selectedMeeting.contact.email}</span>
                                            </a>
                                        )}
                                        {selectedMeeting.contact.phone && (
                                            <a href={`tel:${selectedMeeting.contact.phone}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                                    <Phone className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" />
                                                </div>
                                                <span className="text-sm text-slate-600 group-hover:text-indigo-700">{selectedMeeting.contact.phone}</span>
                                            </a>
                                        )}
                                        {(selectedMeeting.contact.linkedin ? (
                                            <a href={selectedMeeting.contact.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                                    <Linkedin className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                                                </div>
                                                <span className="text-sm text-slate-600 group-hover:text-blue-700">Voir le profil LinkedIn</span>
                                            </a>
                                        ) : (
                                            <div className="flex items-center gap-3 p-2 rounded-lg text-slate-400">
                                                <Linkedin className="w-4 h-4" />
                                                <span className="text-sm">Non renseigné</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-indigo-500" />
                                    Société
                                </h3>
                                <div className="bg-white border ring-1 ring-slate-100/50 border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow h-full">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                                            <Building2 className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-lg">{selectedMeeting.contact.company.name}</p>
                                            {selectedMeeting.contact.company.website && (
                                                <a href={selectedMeeting.contact.company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                                                    {selectedMeeting.contact.company.website.replace(/^https?:\/\//, "")} <ArrowRight className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                                        {selectedMeeting.contact.company.industry && (
                                            <div className="p-3 bg-slate-50 rounded-lg">
                                                <p className="text-xs text-slate-500 uppercase">Secteur</p>
                                                <p className="font-medium text-slate-900 text-sm mt-0.5">{selectedMeeting.contact.company.industry}</p>
                                            </div>
                                        )}
                                        {selectedMeeting.contact.company.country && (
                                            <div className="p-3 bg-slate-50 rounded-lg">
                                                <p className="text-xs text-slate-500 uppercase">Pays</p>
                                                <p className="font-medium text-slate-900 text-sm mt-0.5">{selectedMeeting.contact.company.country}</p>
                                            </div>
                                        )}
                                        {selectedMeeting.contact.company.size && (
                                            <div className="p-3 bg-slate-50 rounded-lg">
                                                <p className="text-xs text-slate-500 uppercase">Effectif</p>
                                                <p className="font-medium text-slate-900 text-sm mt-0.5">{selectedMeeting.contact.company.size}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom: Notes (inline editable) */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Note de prise de RDV</h3>
                            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-5 relative overflow-hidden">
                                <textarea
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    placeholder="Ajouter ou modifier une note..."
                                    className="w-full min-h-[100px] bg-transparent border-0 focus:ring-0 focus:outline-none resize-y text-slate-700 italic leading-relaxed text-lg placeholder:text-slate-400"
                                    rows={3}
                                />
                            </div>
                        </div>

                    </div>
                </Drawer>
            )}

            {/* Cancel meeting modal (reason required) */}
            <Modal
                isOpen={!!cancelModalMeeting}
                onClose={() => { setCancelModalMeeting(null); setCancelReason(""); setCancelNote(""); }}
                title="Annuler le rendez-vous"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-slate-600 text-sm">
                        Indiquez la raison de l&apos;annulation. Le contact redevient disponible dans la file de prospection.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Raison d&apos;annulation *</label>
                        <Select
                            value={cancelReason}
                            onChange={setCancelReason}
                            options={[
                                { value: "", label: "Choisir une raison..." },
                                ...MEETING_CANCELLATION_REASONS.map((r) => ({ value: r.code, label: r.label })),
                            ]}
                            className="w-full border border-slate-200 rounded-xl"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Note (optionnel)</label>
                        <textarea
                            value={cancelNote}
                            onChange={(e) => setCancelNote(e.target.value)}
                            placeholder="Précision..."
                            className="w-full min-h-[80px] px-3 py-2 border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            rows={2}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                    <Button variant="ghost" onClick={() => { setCancelModalMeeting(null); setCancelReason(""); setCancelNote(""); }}>
                        Fermer
                    </Button>
                    <Button
                        variant="secondary"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={handleConfirmCancel}
                        disabled={!cancelReason.trim() || cancelSubmitting}
                    >
                        {cancelSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Confirmer l&apos;annulation
                    </Button>
                </div>
            </Modal>

            {/* Reschedule meeting modal */}
            <Modal
                isOpen={!!rescheduleMeeting}
                onClose={() => { setRescheduleMeeting(null); setRescheduleDateValue(""); setRescheduleNote(""); }}
                title="Reprogrammer le RDV"
                size="sm"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nouvelle date et heure *</label>
                        <input
                            type="datetime-local"
                            value={rescheduleDateValue}
                            onChange={(e) => setRescheduleDateValue(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Note (optionnel)</label>
                        <textarea
                            value={rescheduleNote}
                            onChange={(e) => setRescheduleNote(e.target.value)}
                            placeholder="Ex: RDV reporté au..."
                            className="w-full min-h-[60px] px-3 py-2 border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            rows={2}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                    <Button variant="ghost" onClick={() => { setRescheduleMeeting(null); setRescheduleDateValue(""); setRescheduleNote(""); }}>
                        Fermer
                    </Button>
                    <Button
                        onClick={handleConfirmReschedule}
                        disabled={!rescheduleDateValue || rescheduleSubmitting}
                        className="gap-2"
                    >
                        {rescheduleSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                        Enregistrer la nouvelle date
                    </Button>
                </div>
            </Modal>

            {/* Delete confirmation */}
            <ConfirmModal
                isOpen={!!deleteConfirmMeeting}
                onClose={() => setDeleteConfirmMeeting(null)}
                onConfirm={handleDeleteMeeting}
                title="Supprimer ce rendez-vous ?"
                message="Cette action est irréversible. Le rendez-vous sera définitivement supprimé."
                confirmText="Supprimer"
                variant="danger"
                isLoading={deleting}
            />

            {/* Right-click context menu */}
            <ContextMenu
                items={contextMenuMeeting ? getContextMenuItems(contextMenuMeeting) : []}
                position={contextMenuPosition}
                onClose={closeContextMenu}
            />
        </div>
    );
}
