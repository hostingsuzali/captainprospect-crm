"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button, Badge, Drawer, Modal, useToast } from "@/components/ui";
import {
    Calendar, User, Building2, Lightbulb, Search, X,
    ThumbsUp, Minus, ThumbsDown, XCircle, Mail, Phone,
    Linkedin, ArrowRight, Download, Check, Loader2, Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMeetingCancellationLabel } from "@/lib/constants/meetingCancellationReasons";
import { MeetingsSkeleton } from "@/components/client/skeletons";

interface Meeting {
    id: string;
    createdAt: string;
    callbackDate?: string | null;
    result?: string;
    note?: string | null;
    voipSummary?: string | null;
    cancellationReason?: string | null;
    contact: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        title: string | null;
        email: string | null;
        phone?: string | null;
        linkedin?: string | null;
        customData?: Record<string, unknown> | null;
        company: {
            id: string;
            name: string;
            industry?: string | null;
            country?: string | null;
            website?: string | null;
            size?: string | null;
            customData?: Record<string, unknown> | null;
        };
    };
    campaign: {
        id: string;
        name: string;
        mission: { id: string; name: string };
    };
    sdr?: { id: string; name: string | null } | null;
    meetingFeedback?: {
        id: string;
        outcome: string;
        recontactRequested: string;
        clientNote?: string | null;
    } | null;
}

type TabId = "upcoming" | "past" | "rescheduled" | "cancelled" | "all";

type RdvStatus = "upcoming" | "past" | "rescheduled" | "cancelled";

function getRdvStatus(m: Meeting): RdvStatus {
    if (m.result === "MEETING_CANCELLED") return "cancelled";
    const d = new Date(m.callbackDate || m.createdAt);
    return d >= new Date() ? "upcoming" : "past";
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

const OUTCOME_OPTIONS = [
    { value: "POSITIVE", label: "Positif", icon: ThumbsUp, color: "emerald" },
    { value: "NEUTRAL", label: "Neutre", icon: Minus, color: "blue" },
    { value: "NEGATIVE", label: "Negatif", icon: ThumbsDown, color: "red" },
    { value: "NO_SHOW", label: "Pas eu lieu", icon: XCircle, color: "slate" },
] as const;

const RECONTACT_OPTIONS = [
    { value: "YES", label: "Oui" },
    { value: "NO", label: "Non" },
    { value: "MAYBE", label: "Peut-etre" },
] as const;

const OUTCOME_LABELS: Record<string, { label: string; class: string }> = {
    POSITIVE: { label: "Positif", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    NEUTRAL: { label: "Neutre", class: "bg-blue-50 text-blue-700 border-blue-200" },
    NEGATIVE: { label: "Negatif", class: "bg-red-50 text-red-700 border-red-200" },
    NO_SHOW: { label: "Pas eu lieu", class: "bg-slate-100 text-slate-600 border-slate-200" },
};

function formatCustomLabel(key: string): string {
    const withSpaces = key
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2");
    return withSpaces
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function generateICS(meeting: Meeting): void {
    const contactName = [meeting.contact.firstName, meeting.contact.lastName].filter(Boolean).join(" ");
    const company = meeting.contact.company.name;
    const dt = new Date(meeting.callbackDate || meeting.createdAt);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dtStart = `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
    const end = new Date(dt.getTime() + 30 * 60 * 1000);
    const dtEnd = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;

    const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CaptainProspect//RDV//FR",
        "BEGIN:VEVENT",
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:RDV - ${contactName} (${company})`,
        `DESCRIPTION:${(meeting.note || "").replace(/\n/g, "\\n").slice(0, 200)}`,
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rdv-${contactName.replace(/\s+/g, "-").toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
}

function formatLongDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export default function ClientPortalMeetingsPage() {
    const { data: session } = useSession();
    const toast = useToast();
    const clientId = (session?.user as { clientId?: string })?.clientId;

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>("upcoming");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

    // Feedback form state
    const [feedbackOutcome, setFeedbackOutcome] = useState<string>("");
    const [feedbackRecontact, setFeedbackRecontact] = useState<string>("");
    const [feedbackNote, setFeedbackNote] = useState("");
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

    useEffect(() => {
        if (!clientId) return;
        (async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/clients/${clientId}/meetings`);
                const json = await res.json();
                if (json.success && json.data) {
                    setMeetings(json.data.allMeetings ?? []);
                }
            } catch (err) {
                console.error("Failed to fetch meetings:", err);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [clientId]);

    const stats = useMemo(() => {
        const upcoming = meetings.filter((m) => getRdvStatus(m) === "upcoming").length;
        const past = meetings.filter((m) => getRdvStatus(m) === "past").length;
        const rescheduled = meetings.filter((m) => getRdvStatus(m) === "rescheduled").length;
        const cancelled = meetings.filter((m) => getRdvStatus(m) === "cancelled").length;
        return { upcoming, past, rescheduled, cancelled, all: meetings.length };
    }, [meetings]);

    const isUpcoming = useCallback((m: Meeting) => getRdvStatus(m) === "upcoming", []);

    const filteredMeetings = useMemo(() => {
        let list: Meeting[];
        if (activeTab === "all") list = meetings;
        else if (activeTab === "upcoming") list = meetings.filter((m) => getRdvStatus(m) === "upcoming");
        else if (activeTab === "past") list = meetings.filter((m) => getRdvStatus(m) === "past");
        else if (activeTab === "rescheduled") list = meetings.filter((m) => getRdvStatus(m) === "rescheduled");
        else list = meetings.filter((m) => getRdvStatus(m) === "cancelled");

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((m) => {
                const name = [m.contact.firstName, m.contact.lastName].join(" ").toLowerCase();
                const company = m.contact.company.name.toLowerCase();
                return name.includes(q) || company.includes(q);
            });
        }

        return list.sort((a, b) => {
            const da = new Date(a.callbackDate || a.createdAt).getTime();
            const db = new Date(b.callbackDate || b.createdAt).getTime();
            return activeTab === "upcoming" ? da - db : db - da;
        });
    }, [meetings, activeTab, searchQuery]);

    const upcomingMeetings = useMemo(() => meetings.filter(isUpcoming), [meetings, isUpcoming]);
    const pastMeetings = useMemo(() => meetings.filter((m) => getRdvStatus(m) === "past"), [meetings]);

    const tabs = [
        { id: "all" as const, label: "Tous", badge: stats.all },
        { id: "upcoming" as const, label: "À venir", badge: stats.upcoming },
        { id: "past" as const, label: "Passés", badge: stats.past },
        { id: "rescheduled" as const, label: "Reportés", badge: stats.rescheduled },
        { id: "cancelled" as const, label: "Annulés", badge: stats.cancelled },
    ];

    useEffect(() => {
        if (!isLoading && stats.upcoming === 0 && stats.past > 0 && activeTab === "upcoming") {
            setActiveTab("past");
        }
    }, [isLoading, stats.upcoming, stats.past, activeTab]);

    const openDetail = (meeting: Meeting) => {
        setSelectedMeeting(meeting);
        setFeedbackOutcome("");
        setFeedbackRecontact("");
        setFeedbackNote("");
        setFeedbackSubmitted(false);
    };

    const handleSubmitFeedback = async () => {
        if (!selectedMeeting || !feedbackOutcome || !feedbackRecontact) return;
        setIsSubmittingFeedback(true);
        try {
            const res = await fetch(`/api/client/meetings/${selectedMeeting.id}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    outcome: feedbackOutcome,
                    recontactRequested: feedbackRecontact,
                    clientNote: feedbackNote || null,
                }),
            });
            const json = await res.json();
            if (json.success) {
                setFeedbackSubmitted(true);
                setMeetings((prev) =>
                    prev.map((m) =>
                        m.id === selectedMeeting.id
                            ? { ...m, meetingFeedback: json.data }
                            : m
                    )
                );
                toast.success("Merci !", "Votre retour a ete enregistre");
            } else {
                toast.error("Erreur", json.error || "Impossible d'enregistrer le retour");
            }
        } catch {
            toast.error("Erreur", "Impossible d'enregistrer le retour");
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    if (!clientId || isLoading) return <MeetingsSkeleton />;

    const isPast = (m: Meeting) => !isUpcoming(m);
    const hasFeedback = (m: Meeting) => !!m.meetingFeedback;

    const getOutcomeButtonClass = (optValue: string, selected: boolean) => {
        if (!selected) return "border-slate-200 hover:border-slate-300 bg-white text-slate-600";
        switch (optValue) {
            case "POSITIVE": return "border-emerald-500 bg-emerald-50 shadow-sm text-emerald-700";
            case "NEUTRAL": return "border-blue-500 bg-blue-50 shadow-sm text-blue-700";
            case "NEGATIVE": return "border-red-500 bg-red-50 shadow-sm text-red-700";
            case "NO_SHOW": return "border-slate-500 bg-slate-100 shadow-sm text-slate-700";
            default: return "border-indigo-500 bg-indigo-50 shadow-sm text-indigo-700";
        }
    };

    const statusBadge = (status: RdvStatus) => {
        const config = {
            upcoming: { label: "À venir", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "🟢" },
            past: { label: "Passé", cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "⚪" },
            rescheduled: { label: "Reporté", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "🟡" },
            cancelled: { label: "Annulé", cls: "bg-red-50 text-red-700 border-red-200", dot: "🔴" },
        };
        const c = config[status] ?? config.past;
        return (
            <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border", c.cls)}>
                <span>{c.dot}</span>
                {c.label}
            </span>
        );
    };

    const formatCardTime = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const formatCardMonth = (d: Date) => d.toLocaleDateString("fr-FR", { month: "short" }).toUpperCase().replace(".", "");

    return (
        <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 animate-fade-up">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-900">
                        Mes Rendez-vous
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Consultez, qualifiez et donnez votre avis sur vos rendez-vous
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Rechercher contact, entreprise..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-10 pl-9 pr-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 shrink-0">
                        <Download className="w-4 h-4" />
                        Exporter
                    </Button>
                </div>
            </div>

            {/* Summary stats (mes-rdv style) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up" style={{ animationDelay: "40ms" }}>
                {[
                    { key: "upcoming", label: "À venir", val: stats.upcoming, color: "emerald" },
                    { key: "past", label: "Passés", val: stats.past, color: "slate" },
                    { key: "rescheduled", label: "Reportés", val: stats.rescheduled, color: "amber" },
                    { key: "cancelled", label: "Annulés", val: stats.cancelled, color: "red" },
                ].map((s) => (
                    <div key={s.key} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-3">
                        <div className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                            s.color === "emerald" && "bg-emerald-50",
                            s.color === "slate" && "bg-slate-100",
                            s.color === "amber" && "bg-amber-50",
                            s.color === "red" && "bg-red-50"
                        )}>
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

            {/* Filter tabs (mes-rdv style) */}
            <div className="flex flex-wrap gap-1 p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm w-fit animate-fade-up" style={{ animationDelay: "60ms" }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
                            activeTab === tab.id ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                        )}
                    >
                        {tab.label}
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full", activeTab === tab.id ? "bg-white/20" : "bg-slate-200 text-slate-600")}>
                            {tab.badge}
                        </span>
                    </button>
                ))}
            </div>

            {/* RDV list (mes-rdv style) */}
            {filteredMeetings.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 animate-fade-up">
                    <div className="text-4xl mb-3">📅</div>
                    <h3 className="text-lg font-semibold text-slate-800">Aucun rendez-vous</h3>
                    <p className="text-slate-500 mt-1 max-w-sm mx-auto text-sm">
                        {activeTab === "upcoming" ? "Les prochains RDV planifiés par votre équipe apparaîtront ici." : activeTab === "past" ? "Votre historique de rendez-vous apparaîtra ici." : activeTab === "cancelled" ? "Aucun rendez-vous annulé." : activeTab === "rescheduled" ? "Aucun rendez-vous reporté." : "Vos rendez-vous apparaîtront ici dès qu'ils seront planifiés."}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3 animate-fade-up" style={{ animationDelay: "80ms" }}>
                    {filteredMeetings.map((meeting) => {
                        const d = new Date(meeting.callbackDate || meeting.createdAt);
                        const status = getRdvStatus(meeting);
                        const upcoming = isUpcoming(meeting);
                        const hasFeedback = !!meeting.meetingFeedback;

                        return (
                            <article
                                key={meeting.id}
                                className={cn("bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all", meeting.result === "MEETING_CANCELLED" && "opacity-85")}
                            >
                                <div className="flex flex-col sm:flex-row">
                                    {/* Date col */}
                                    <div className="sm:w-20 shrink-0 p-4 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200 flex flex-col items-center justify-center">
                                        <div className="text-2xl font-extrabold tracking-tight text-slate-900">{d.getDate()}</div>
                                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">{formatCardMonth(d)}</div>
                                        <div className="text-xs font-semibold text-indigo-600 mt-1">{formatCardTime(d)}</div>
                                    </div>

                                    {/* Main */}
                                    <div className="flex-1 p-4 sm:p-5 flex flex-col gap-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {statusBadge(status)}
                                            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                                                {meeting.campaign.mission.name}
                                            </span>
                                            <span className="text-xs text-slate-500">{meeting.campaign.name}</span>
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
                                                    {meeting.contact.company.country && <span>• {meeting.contact.company.country}</span>}
                                                    {meeting.contact.company.size && <span>• {meeting.contact.company.size}</span>}
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
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Briefing SDR{meeting.sdr?.name ? ` — ${meeting.sdr.name}` : ""}</span>
                                                <p className="mt-0.5">&ldquo;{meeting.note}&rdquo;</p>
                                            </div>
                                        )}

                                        {hasFeedback && meeting.meetingFeedback && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Votre retour :</span>
                                                <Badge className={cn("text-xs border font-medium", OUTCOME_LABELS[meeting.meetingFeedback.outcome]?.class ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                                                    {OUTCOME_LABELS[meeting.meetingFeedback.outcome]?.label ?? meeting.meetingFeedback.outcome}
                                                </Badge>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="sm:w-40 shrink-0 p-4 border-t sm:border-t-0 sm:border-l border-slate-200 flex flex-col justify-center gap-2">
                                        <Button variant="outline" size="sm" className="w-full justify-center gap-1.5 text-xs" onClick={() => openDetail(meeting)}>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                            Voir le détail
                                        </Button>
                                        {!upcoming && !hasFeedback && meeting.result !== "MEETING_CANCELLED" && (
                                            <Button variant="primary" size="sm" className="w-full justify-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={() => openDetail(meeting)}>
                                                Écrire un avis
                                            </Button>
                                        )}
                                        {upcoming && (
                                            <Button variant="outline" size="sm" className="w-full justify-center gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); generateICS(meeting); }}>
                                                <Download className="w-3.5 h-3.5" />
                                                Ajouter au calendrier
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {/* Detail Drawer */}
            {selectedMeeting && (
                <Drawer
                    isOpen={!!selectedMeeting}
                    onClose={() => setSelectedMeeting(null)}
                    title="Détail du rendez-vous"
                    description={selectedMeeting ? formatLongDate(selectedMeeting.callbackDate || selectedMeeting.createdAt) : undefined}
                    size="xl"
                    className="[&_h2]:font-serif [&_h2]:italic [&_h2]:text-xl"
                    footer={
                        <>
                            {isPast(selectedMeeting) && !hasFeedback(selectedMeeting) && !feedbackSubmitted && selectedMeeting.result !== "MEETING_CANCELLED" ? (
                                <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                                    <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => window.print()}>
                                        <Printer className="w-4 h-4" /> Imprimer
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        className="gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700"
                                        onClick={handleSubmitFeedback}
                                        disabled={!feedbackOutcome || !feedbackRecontact || isSubmittingFeedback}
                                    >
                                        {isSubmittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Enregistrer mon avis
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-3 w-full">
                                    <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => window.print()}>
                                        <Printer className="w-4 h-4" /> Imprimer la fiche
                                    </Button>
                                    {isUpcoming(selectedMeeting) && (
                                        <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => generateICS(selectedMeeting)}>
                                            <Download className="w-4 h-4" /> Ajouter au calendrier
                                        </Button>
                                    )}
                                    <Button variant="primary" size="sm" className="ml-auto rounded-lg bg-indigo-600 hover:bg-indigo-700" onClick={() => setSelectedMeeting(null)}>
                                        Fermer
                                    </Button>
                                </div>
                            )}
                        </>
                    }
                >
                    <div className="print-container -mx-6 -mb-6">
                        {/* Section: Status bar (mes-rdv modal-section) */}
                        <div className="px-6 py-[18px] border-b border-slate-200">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                                    <Calendar className="w-4 h-4 text-slate-500" />
                                    {formatLongDate(selectedMeeting.callbackDate || selectedMeeting.createdAt)}
                                </div>
                                {selectedMeeting.result === "MEETING_CANCELLED" ? (
                                    <Badge className="bg-red-50 text-red-600 border-red-200 font-medium">Annulé</Badge>
                                ) : isUpcoming(selectedMeeting) ? (
                                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 font-medium">À venir</Badge>
                                ) : (
                                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-medium">Passé</Badge>
                                )}
                            </div>
                            {selectedMeeting.result === "MEETING_CANCELLED" && selectedMeeting.cancellationReason && (
                                <p className="mt-2 text-xs text-slate-600 italic">
                                    Raison : {getMeetingCancellationLabel(selectedMeeting.cancellationReason)}
                                </p>
                            )}
                        </div>

                        {/* Section: Contact & Company (mes-rdv modal-2col, info-row) */}
                        <div className="px-6 py-[18px] border-b border-slate-200">
                            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Contact & Société</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Contact col */}
                                <div>
                                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">Contact</div>
                                    <div className="flex flex-col gap-[7px]">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Nom</span>
                                            <span className="text-[13.5px] font-medium text-slate-800">
                                                {[selectedMeeting.contact.firstName, selectedMeeting.contact.lastName].filter(Boolean).join(" ") || "—"}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Poste</span>
                                            <span className="text-[13.5px] font-medium text-slate-800">{selectedMeeting.contact.title ?? "—"}</span>
                                        </div>
                                        {selectedMeeting.contact.email && (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Email</span>
                                                <a href={`mailto:${selectedMeeting.contact.email}`} className="text-[13.5px] font-medium text-indigo-600 hover:underline">
                                                    {selectedMeeting.contact.email}
                                                </a>
                                            </div>
                                        )}
                                        {selectedMeeting.contact.phone && (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Téléphone</span>
                                                <a href={`tel:${selectedMeeting.contact.phone}`} className="text-[13.5px] font-medium text-indigo-600 hover:underline">
                                                    {selectedMeeting.contact.phone}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                    {selectedMeeting.contact.customData && typeof selectedMeeting.contact.customData === "object" && Object.keys(selectedMeeting.contact.customData as Record<string, unknown>).length > 0 && (
                                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                            <p className="text-[10.5px] font-semibold uppercase text-slate-500 mb-1">Infos supplémentaires</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.entries(selectedMeeting.contact.customData as Record<string, unknown>).map(([key, value]) => {
                                                    if (value === null || value === undefined || value === "") return null;
                                                    return (
                                                        <span key={key} className="inline-flex gap-1 px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-600">
                                                            <span className="font-semibold">{formatCustomLabel(key)}:</span>
                                                            <span>{String(value)}</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Company col */}
                                <div>
                                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">Société</div>
                                    <div className="flex flex-col gap-[7px]">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Nom</span>
                                            <span className="text-[13.5px] font-medium text-slate-800">{selectedMeeting.contact.company.name}</span>
                                        </div>
                                        {selectedMeeting.contact.company.website && (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Site web</span>
                                                <a href={selectedMeeting.contact.company.website} target="_blank" rel="noopener noreferrer" className="text-[13.5px] font-medium text-indigo-600 hover:underline">
                                                    {selectedMeeting.contact.company.website.replace(/^https?:\/\//, "")}
                                                </a>
                                            </div>
                                        )}
                                        {(selectedMeeting.contact.company.industry || selectedMeeting.contact.company.country || selectedMeeting.contact.company.size) && (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Infos</span>
                                                <span className="text-[13.5px] font-medium text-slate-800">
                                                    {[selectedMeeting.contact.company.industry && `Secteur : ${selectedMeeting.contact.company.industry}`, selectedMeeting.contact.company.country, selectedMeeting.contact.company.size].filter(Boolean).join(" · ") || "—"}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Mission</span>
                                            <span className="text-[13.5px] font-medium text-slate-800">{selectedMeeting.campaign.mission.name}</span>
                                        </div>
                                    </div>
                                    {selectedMeeting.contact.company.customData && typeof selectedMeeting.contact.company.customData === "object" && Object.keys(selectedMeeting.contact.company.customData as Record<string, unknown>).length > 0 && (
                                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                            <p className="text-[10.5px] font-semibold uppercase text-slate-500 mb-1">Infos supplémentaires</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.entries(selectedMeeting.contact.company.customData as Record<string, unknown>).map(([key, value]) => {
                                                    if (value === null || value === undefined || value === "") return null;
                                                    return (
                                                        <span key={key} className="inline-flex gap-1 px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-600">
                                                            <span className="font-semibold">{formatCustomLabel(key)}:</span>
                                                            <span>{String(value)}</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* SDR Briefing (mes-rdv sdr-note-box) */}
                        {selectedMeeting.note && (
                            <div className="px-6 py-[18px] border-b border-slate-200">
                                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
                                    Briefing SDR{selectedMeeting.sdr?.name ? ` — ${selectedMeeting.sdr.name}` : ""}
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-3 text-[13.5px] leading-relaxed text-slate-600 italic">
                                    {selectedMeeting.note}
                                </div>
                            </div>
                        )}

                        {/* Feedback form or summary (mes-rdv outcome-grid, recontact-row) */}
                        {isPast(selectedMeeting) && selectedMeeting.result !== "MEETING_CANCELLED" && (
                            <div className="px-6 py-[18px] border-b-0">
                                {(hasFeedback(selectedMeeting) || feedbackSubmitted) ? (
                                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                                <Check className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <span className="text-sm font-bold text-emerald-800">Merci pour votre retour</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge className={cn("text-xs border font-medium", OUTCOME_LABELS[selectedMeeting.meetingFeedback?.outcome || feedbackOutcome]?.class)}>
                                                {OUTCOME_LABELS[selectedMeeting.meetingFeedback?.outcome || feedbackOutcome]?.label}
                                            </Badge>
                                            <Badge className="bg-slate-50 text-slate-600 border-slate-200 text-xs font-medium">
                                                Recontact : {selectedMeeting.meetingFeedback?.recontactRequested || feedbackRecontact}
                                            </Badge>
                                        </div>
                                        {(selectedMeeting.meetingFeedback?.clientNote || feedbackNote) && (
                                            <p className="text-sm text-emerald-700 mt-3 italic">
                                                &ldquo;{selectedMeeting.meetingFeedback?.clientNote || feedbackNote}&rdquo;
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                                            Comment s&apos;est passé ce rendez-vous ?
                                        </div>
                                        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
                                            {OUTCOME_OPTIONS.map((opt) => {
                                                const Icon = opt.icon;
                                                const sel = feedbackOutcome === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setFeedbackOutcome(opt.value)}
                                                        className={cn(
                                                            "flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-lg border-[1.5px] bg-white text-xs font-semibold text-slate-600 transition-all",
                                                            sel
                                                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                                                            sel ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            <Icon className="w-3.5 h-3.5" />
                                                        </div>
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                                Souhaitez-vous que l&apos;équipe recontacte ce prospect ?
                                            </div>
                                            <div className="flex gap-2">
                                                {RECONTACT_OPTIONS.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setFeedbackRecontact(opt.value)}
                                                        className={cn(
                                                            "flex-1 py-2 rounded-lg border-[1.5px] text-[13px] font-semibold transition-all",
                                                            feedbackRecontact === opt.value
                                                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                                        )}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Commentaire (optionnel)</label>
                                            <textarea
                                                value={feedbackNote}
                                                onChange={(e) => setFeedbackNote(e.target.value)}
                                                placeholder="Ajoutez un commentaire..."
                                                rows={3}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none bg-white"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Drawer>
            )}
        </div>
    );
}
