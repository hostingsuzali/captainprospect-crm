"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button, Badge, Modal, useToast } from "@/components/ui";
import { Tabs } from "@/components/ui/Tabs";
import {
    Calendar, User, Building2, Lightbulb, Search, X,
    ThumbsUp, Minus, ThumbsDown, XCircle, Mail, Phone,
    Linkedin, ArrowRight, Download, Check, Loader2, Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MeetingsSkeleton } from "@/components/client/skeletons";

interface Meeting {
    id: string;
    createdAt: string;
    callbackDate?: string | null;
    result?: string;
    note?: string | null;
    voipSummary?: string | null;
    contact: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        title: string | null;
        email: string | null;
        phone?: string | null;
        customData?: Record<string, unknown> | null;
        company: { id: string; name: string; industry?: string | null; customData?: Record<string, unknown> | null };
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

type TabId = "upcoming" | "past" | "all";

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
        "PRODID:-//Suzalink//RDV//FR",
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

    const now = useMemo(() => new Date(), []);

    const isUpcoming = useCallback((m: Meeting) => {
        const d = new Date(m.callbackDate || m.createdAt);
        return d >= now && m.result !== "MEETING_CANCELLED";
    }, [now]);

    const upcomingMeetings = useMemo(() => meetings.filter(isUpcoming), [meetings, isUpcoming]);
    const pastMeetings = useMemo(() => meetings.filter((m) => !isUpcoming(m)), [meetings, isUpcoming]);

    const filteredMeetings = useMemo(() => {
        let list: Meeting[];
        if (activeTab === "upcoming") list = upcomingMeetings;
        else if (activeTab === "past") list = pastMeetings;
        else list = meetings;

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
    }, [meetings, activeTab, searchQuery, upcomingMeetings, pastMeetings]);

    const tabs = [
        { id: "upcoming" as const, label: "A venir", badge: upcomingMeetings.length },
        { id: "past" as const, label: "Passes", badge: pastMeetings.length },
        { id: "all" as const, label: "Tous", badge: meetings.length },
    ];

    useEffect(() => {
        if (!isLoading && upcomingMeetings.length === 0 && pastMeetings.length > 0) {
            setActiveTab("past");
        }
    }, [isLoading, upcomingMeetings.length, pastMeetings.length]);

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
    const colorClass = (v: string, color: string) =>
        v === feedbackOutcome
            ? `border-${color}-500 bg-${color}-50 shadow-sm`
            : "border-[#E8EBF0] hover:border-[#C5C8D4]";

    const insightHighOpsToday = filteredMeetings.filter((m) =>
        isUpcoming(m) &&
        new Date(m.callbackDate || m.createdAt).toDateString() === new Date().toDateString() &&
        m.meetingFeedback?.outcome === "POSITIVE"
    ).length;

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-6">
            {/* Hero header */}
            <section className="grid gap-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)] items-stretch animate-fade-up">
                <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.45)]">
                    <h1 className="text-3xl font-semibold tracking-tight">Mes Rendez-vous</h1>
                    <p className="mt-2 text-sm text-slate-200 max-w-xl">
                        Votre espace pour preparer vos echanges et suivre l&apos;avancement des opportunites en cours.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 backdrop-blur-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="font-semibold">{upcomingMeetings.length}</span>
                            <span className="text-slate-200">a venir</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 backdrop-blur-sm">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span className="font-semibold">{pastMeetings.length}</span>
                            <span className="text-slate-200">passes</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 backdrop-blur-sm">
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                            <span className="font-semibold">
                                {meetings.filter((m) => !!m.meetingFeedback).length}
                            </span>
                            <span className="text-slate-200">retours client</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {/* Search */}
                    <div className="relative w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                        <input
                            type="text"
                            placeholder="Rechercher un contact, une entreprise..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-11 pl-10 pr-9 rounded-full border border-[#E8EBF0] bg-white/80 backdrop-blur-sm text-sm text-[#12122A] placeholder:text-[#A0A3BD] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/30 focus:border-[#7C5CFC]/50 shadow-sm transition-all duration-200"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A3BD] hover:text-[#12122A] transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Insight card */}
                    <div className="rounded-2xl bg-white/90 border border-[#E8EBF0] px-4 py-3 shadow-sm flex gap-3">
                        <div className="mt-0.5">
                            <div className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                            </div>
                        </div>
                        <div className="text-xs text-[#4A4B6A] space-y-0.5">
                            <p className="font-semibold text-[#12122A]">Suggestion du jour</p>
                            <p>
                                Vous avez <span className="font-semibold">{upcomingMeetings.length}</span>{" "}
                                rendez-vous a venir dans votre agenda client.
                            </p>
                            {insightHighOpsToday > 0 ? (
                                <p>
                                    <span className="font-semibold">{insightHighOpsToday}</span> rendez-vous
                                    ont un retour positif — prenez quelques minutes pour preparer votre prochain
                                    contact.
                                </p>
                            ) : (
                                <p>
                                    Aucun rendez-vous critique aujourd&apos;hui — profitez-en pour relire vos
                                    derniers comptes-rendus.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Tabs */}
            <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
                <Tabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as TabId)}
                    variant="pills"
                />
            </div>

            {/* Meetings list with timeline */}
            {filteredMeetings.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-[#E8EBF0] animate-fade-up shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F4F6F9] to-[#E8EBF0] flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-7 h-7 text-[#A0A3BD]" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#12122A] mb-1">
                        {activeTab === "upcoming" ? "Aucun rendez-vous a venir" : activeTab === "past" ? "Aucun rendez-vous passe" : "Aucun rendez-vous"}
                    </h3>
                    <p className="text-sm text-[#6B7194] max-w-sm mx-auto">
                        {activeTab === "upcoming"
                            ? "Les prochains RDV planifies par votre equipe apparaitront ici."
                            : activeTab === "past"
                            ? "Votre historique de rendez-vous apparaitra ici."
                            : "Vos rendez-vous apparaitront ici des qu'ils seront planifies."}
                    </p>
                </div>
            ) : (
                <div className="relative animate-fade-up" style={{ animationDelay: "90ms" }}>
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-[#D5D8E3]" aria-hidden />
                    <div className="stagger-children space-y-4 pl-7">
                        {filteredMeetings.map((meeting, idx) => {
                        const contactName = [meeting.contact.firstName, meeting.contact.lastName].filter(Boolean).join(" ") || "Contact";
                        const upcoming = isUpcoming(meeting);
                        const cancelled = meeting.result === "MEETING_CANCELLED";
                        const baseDate = new Date(meeting.callbackDate || meeting.createdAt);
                        const dateStr = formatLongDate(meeting.callbackDate || meeting.createdAt);
                        const timeStr = baseDate.toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                        });
                        const statusLabel = cancelled ? "Annule" : upcoming ? "A venir" : "Passe";
                        const statusColor = cancelled
                            ? "bg-red-100 text-red-700 border-red-200"
                            : upcoming
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-700 border-slate-200";
                        const statusDotColor = cancelled ? "bg-red-400" : upcoming ? "bg-emerald-400" : "bg-slate-400";
                        const accentColor = cancelled
                            ? "border-l-4 border-l-red-400 bg-gradient-to-r from-red-50/90 via-rose-50/80 to-white/60 shadow-sm shadow-red-100/80"
                            : upcoming
                                ? "border-l-4 border-l-emerald-400 bg-gradient-to-r from-emerald-50/90 via-teal-50/80 to-white/60 shadow-sm shadow-emerald-100/80"
                                : "border-l-4 border-l-slate-300 bg-gradient-to-r from-slate-50/90 via-sky-50/80 to-white/60 shadow-sm shadow-slate-100/80";
                        const created = new Date(meeting.createdAt);
                        const isNew = Date.now() - created.getTime() < 1000 * 60 * 60 * 24 * 2;
                        const day = baseDate.getDate();
                        const monthLabel = baseDate.toLocaleDateString("fr-FR", { month: "short" }).toUpperCase();
                        const year = baseDate.getFullYear();

                        return (
                            <div key={meeting.id} className="relative flex gap-4">
                                {/* Timeline dot */}
                                <div className="flex flex-col items-center pt-4">
                                    <div
                                        className={cn(
                                            "w-3 h-3 rounded-full border-2 border-white shadow-sm",
                                            cancelled
                                                ? "bg-red-400"
                                                : upcoming
                                                    ? "bg-emerald-400 animate-pulse"
                                                    : "bg-slate-400"
                                        )}
                                    />
                                </div>
                                {/* Card */}
                                <div
                                    className={cn(
                                        "premium-card flex-1 rounded-2xl transition-all duration-300 hover:-translate-y-[4px] hover:shadow-2xl hover:shadow-slate-300/70 focus-within:ring-2 focus-within:ring-[#7C5CFC]/40 bg-white",
                                        accentColor
                                    )}
                                >
                                    <div className="flex items-stretch gap-4">
                                        {/* Left date pill */}
                                        <div className="flex-shrink-0 flex">
                                            <div className="relative">
                                                <div className="h-full w-20 rounded-2xl bg-gradient-to-b from-[#7C5CFC] via-[#865DFF] to-[#F43F5E] text-white flex flex-col items-center justify-center py-3 shadow-[0_12px_30px_rgba(124,92,252,0.45)]">
                                                    <span className="text-[10px] font-semibold tracking-[0.12em] opacity-80">
                                                        {monthLabel}
                                                    </span>
                                                    <span className="text-2xl font-extrabold leading-none mt-1">
                                                        {day}
                                                    </span>
                                                    <span className="mt-1 text-[10px] font-medium opacity-80">
                                                        {year}
                                                    </span>
                                                </div>
                                                {/* Faux ticket edge */}
                                                <div className="absolute inset-y-2 -right-[10px] w-5 bg-[#F8F9FC] rounded-r-2xl flex flex-col justify-between py-2">
                                                    <div className="w-5 h-3 rounded-l-full bg-[#F8F9FC]" />
                                                    <div className="w-5 h-3 rounded-l-full bg-[#F8F9FC]" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Main content */}
                                        <div className="flex-1 min-w-0 space-y-3">
                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-[#12122A] capitalize tracking-tight">
                                                        {dateStr}
                                                    </p>
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 border border-[#E8EBF0]/80 text-[11px] text-[#4A4B6A] shadow-xs">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#7C5CFC]" />
                                                        <span>Heure : {timeStr}</span>
                                                    </div>
                                                    {isNew && (
                                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-50 via-pink-50 to-amber-50 border border-pink-200/60 text-[10px] font-semibold text-pink-700 shadow-[0_0_0_1px_rgba(244,114,182,0.18)] mt-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                                                            Nouveau rendez-vous
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-row md:flex-col items-start md:items-end gap-2">
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border shadow-sm bg-white/80 backdrop-blur-sm",
                                                            statusColor
                                                        )}
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-current/70" />
                                                        {statusLabel}
                                                    </span>
                                                    <Badge className="bg-gradient-to-r from-indigo-50 via-violet-50 to-fuchsia-50 text-indigo-700 border-indigo-100/80 text-[11px] font-medium rounded-full px-3 py-1 shadow-sm shadow-indigo-50/80">
                                                        {meeting.campaign.mission.name}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                <div>
                                                    <p className="text-lg font-bold text-[#12122A] tracking-tight">
                                                        {contactName}
                                                    </p>
                                                    <p className="text-sm text-[#6B7194]">
                                                        {meeting.contact.title && <>{meeting.contact.title} &middot; </>}
                                                        {meeting.contact.company.name}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#6B7194]">
                                                    {meeting.contact.email && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 border border-slate-200">
                                                            <Mail className="w-3 h-3" />
                                                            Email
                                                        </span>
                                                    )}
                                                    {meeting.contact.phone && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 border border-slate-200">
                                                            <Phone className="w-3 h-3" />
                                                            Tel
                                                        </span>
                                                    )}
                                                    {meeting.voipSummary && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700">
                                                            <Linkedin className="w-3 h-3" />
                                                            Compte-rendu dispo
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {meeting.note && (
                                                <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60 rounded-xl p-4 mt-2">
                                                    <div className="flex items-start gap-2">
                                                        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold text-amber-700 mb-1">
                                                                Briefing SDR{meeting.sdr?.name ? ` — ${meeting.sdr.name}` : ""}
                                                            </p>
                                                            <p className="text-sm text-amber-800 italic line-clamp-2 leading-relaxed">{meeting.note}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {meeting.meetingFeedback && (
                                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50/80">
                                                    <span className="text-xs text-[#6B7194]">Votre retour :</span>
                                                    <Badge className={cn("text-xs border", OUTCOME_LABELS[meeting.meetingFeedback.outcome]?.class ?? "bg-slate-100")}>
                                                        {OUTCOME_LABELS[meeting.meetingFeedback.outcome]?.label ?? meeting.meetingFeedback.outcome}
                                                    </Badge>
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2 pt-2">
                                                {upcoming && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1.5 text-xs rounded-lg hover:border-[#7C5CFC]/30 hover:text-[#7C5CFC] transition-all"
                                                        onClick={(e) => { e.stopPropagation(); generateICS(meeting); }}
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        Ajouter au calendrier
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="gap-1.5 text-xs text-[#7C5CFC] hover:text-[#6C3AFF] hover:bg-[#7C5CFC]/5 rounded-lg ml-auto font-semibold"
                                                    onClick={() => openDetail(meeting)}
                                                >
                                                    Voir detail <ArrowRight className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedMeeting && (
                <Modal
                    isOpen={!!selectedMeeting}
                    onClose={() => setSelectedMeeting(null)}
                    title="Details du rendez-vous"
                    size="lg"
                >
                    <div className="space-y-6 print-container">
                        {/* Date & Status */}
                        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-[#F8F7FF] to-[#F4F6F9] border border-[#E8EBF0]/60">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C5CFC] to-[#A78BFA] flex items-center justify-center shadow-sm shadow-[#7C5CFC]/20">
                                <Calendar className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-lg font-bold text-[#12122A] capitalize">
                                {formatLongDate(selectedMeeting.callbackDate || selectedMeeting.createdAt)}
                            </span>
                            {selectedMeeting.result === "MEETING_CANCELLED" ? (
                                <Badge className="bg-red-50 text-red-600 border-red-200 font-semibold">Annule</Badge>
                            ) : isUpcoming(selectedMeeting) ? (
                                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 font-semibold">A venir</Badge>
                            ) : (
                                <Badge className="bg-slate-50 text-slate-500 border-slate-200 font-semibold">Passe</Badge>
                            )}
                        </div>

                        {/* Contact & Company */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-[#F8F7FF] to-[#F4F6F9] rounded-2xl p-5 space-y-3 border border-[#E8EBF0]/50">
                                <div className="flex items-center gap-2 text-xs font-semibold text-[#7C5CFC] uppercase tracking-wider">
                                    <User className="w-3.5 h-3.5" /> Contact
                                </div>
                                <p className="text-lg font-bold text-[#12122A]">
                                    {[selectedMeeting.contact.firstName, selectedMeeting.contact.lastName].filter(Boolean).join(" ")}
                                </p>
                                <p className="text-sm text-[#6B7194]">{selectedMeeting.contact.title ?? "—"}</p>
                                <div className="space-y-2 pt-2">
                                    {selectedMeeting.contact.email && (
                                        <a href={`mailto:${selectedMeeting.contact.email}`} className="flex items-center gap-2 text-sm text-[#6B7194] hover:text-[#7C5CFC] transition-colors group">
                                            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center group-hover:bg-[#7C5CFC]/10 transition-colors">
                                                <Mail className="w-3.5 h-3.5" />
                                            </div>
                                            {selectedMeeting.contact.email}
                                        </a>
                                    )}
                                    {selectedMeeting.contact.phone && (
                                        <a href={`tel:${selectedMeeting.contact.phone}`} className="flex items-center gap-2 text-sm text-[#6B7194] hover:text-[#7C5CFC] transition-colors group">
                                            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center group-hover:bg-[#7C5CFC]/10 transition-colors">
                                                <Phone className="w-3.5 h-3.5" />
                                            </div>
                                            {selectedMeeting.contact.phone}
                                        </a>
                                    )}
                                </div>
                                {selectedMeeting.contact.customData && typeof selectedMeeting.contact.customData === "object" && Object.keys(selectedMeeting.contact.customData as Record<string, unknown>).length > 0 && (
                                    <div className="mt-3 rounded-xl border border-[#E8EBF0] bg-white/70 px-3 py-2">
                                        <p className="text-[11px] font-semibold text-[#4A4B6A] mb-1">
                                            Infos supplémentaires contact
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {Object.entries(selectedMeeting.contact.customData as Record<string, unknown>).map(([key, value]) => {
                                                if (value === null || value === undefined || value === "") return null;
                                                return (
                                                    <span
                                                        key={key}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F4F6F9] border border-[#E0E4F0] text-[11px] text-[#4A4B6A]"
                                                    >
                                                        <span className="font-semibold">{formatCustomLabel(key)}:</span>
                                                        <span>{String(value)}</span>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="bg-gradient-to-br from-[#F8F7FF] to-[#F4F6F9] rounded-2xl p-5 space-y-3 border border-[#E8EBF0]/50">
                                <div className="flex items-center gap-2 text-xs font-semibold text-[#7C5CFC] uppercase tracking-wider">
                                    <Building2 className="w-3.5 h-3.5" /> Societe
                                </div>
                                <p className="text-lg font-bold text-[#12122A]">{selectedMeeting.contact.company.name}</p>
                                {selectedMeeting.contact.company.industry && (
                                    <p className="text-sm text-[#6B7194]">Secteur : {selectedMeeting.contact.company.industry}</p>
                                )}
                                <Badge className="bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border-indigo-100/80 text-xs mt-2 font-medium">
                                    Mission : {selectedMeeting.campaign.mission.name}
                                </Badge>
                                {selectedMeeting.contact.company.customData && typeof selectedMeeting.contact.company.customData === "object" && Object.keys(selectedMeeting.contact.company.customData as Record<string, unknown>).length > 0 && (
                                    <div className="mt-3 rounded-xl border border-[#E8EBF0] bg-white/70 px-3 py-2">
                                        <p className="text-[11px] font-semibold text-[#4A4B6A] mb-1">
                                            Infos supplémentaires société
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {Object.entries(selectedMeeting.contact.company.customData as Record<string, unknown>).map(([key, value]) => {
                                                if (value === null || value === undefined || value === "") return null;
                                                return (
                                                    <span
                                                        key={key}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F4F6F9] border border-[#E0E4F0] text-[11px] text-[#4A4B6A]"
                                                    >
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

                        {/* SDR Briefing */}
                        {selectedMeeting.note && (
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <Lightbulb className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <span className="text-sm font-bold text-amber-800">
                                        Briefing SDR{selectedMeeting.sdr?.name ? ` — ${selectedMeeting.sdr.name}` : ""}
                                    </span>
                                </div>
                                <p className="text-sm text-amber-800 italic leading-relaxed">{selectedMeeting.note}</p>
                            </div>
                        )}

                        {/* Feedback Form or Summary */}
                        {isPast(selectedMeeting) && (
                            <>
                                {(hasFeedback(selectedMeeting) || feedbackSubmitted) ? (
                                    <div className="bg-gradient-to-r from-emerald-50 to-green-50/50 border border-emerald-200/60 rounded-2xl p-5">
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
                                    <div className="border border-[#E8EBF0] rounded-2xl p-6 space-y-5 bg-white shadow-sm">
                                        <h3 className="text-sm font-bold text-[#12122A]">Comment s&apos;est passe ce rendez-vous ?</h3>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {OUTCOME_OPTIONS.map((opt) => {
                                                const Icon = opt.icon;
                                                const selected = feedbackOutcome === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setFeedbackOutcome(opt.value)}
                                                        className={cn(
                                                            "p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 text-center",
                                                            selected
                                                                ? `border-${opt.color}-500 bg-${opt.color}-50 shadow-md shadow-${opt.color}-100`
                                                                : "border-[#E8EBF0] hover:border-[#C5C8D4] hover:shadow-sm"
                                                        )}
                                                    >
                                                        <Icon className={cn("w-6 h-6 mx-auto mb-2 transition-transform", selected ? `text-${opt.color}-600 scale-110` : "text-[#A0A3BD]")} />
                                                        <span className={cn("text-sm font-semibold", selected ? `text-${opt.color}-700` : "text-[#6B7194]")}>
                                                            {opt.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div>
                                            <p className="text-sm font-semibold text-[#12122A] mb-3">
                                                Souhaitez-vous que l&apos;equipe recontacte ce prospect ?
                                            </p>
                                            <div className="flex gap-2">
                                                {RECONTACT_OPTIONS.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setFeedbackRecontact(opt.value)}
                                                        className={cn(
                                                            "px-6 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-300",
                                                            feedbackRecontact === opt.value
                                                                ? "border-[#7C5CFC] bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] text-[#7C5CFC] shadow-sm shadow-[#7C5CFC]/10"
                                                                : "border-[#E8EBF0] text-[#6B7194] hover:border-[#C5C8D4] hover:text-[#4A4B6A]"
                                                        )}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <textarea
                                            value={feedbackNote}
                                            onChange={(e) => setFeedbackNote(e.target.value)}
                                            placeholder="Ajoutez un commentaire (optionnel)"
                                            rows={3}
                                            className="w-full rounded-xl border border-[#E8EBF0] p-4 text-sm text-[#12122A] placeholder:text-[#A0A3BD] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/30 focus:border-[#7C5CFC]/50 resize-none bg-[#FAFBFD] transition-all duration-200"
                                        />

                                        <Button
                                            onClick={handleSubmitFeedback}
                                            disabled={!feedbackOutcome || !feedbackRecontact || isSubmittingFeedback}
                                            className="w-full md:w-auto bg-gradient-to-r from-[#6C3AFF] to-[#7C5CFC] hover:from-[#5B2AEE] hover:to-[#6C4CE0] text-white rounded-xl px-8 py-3 shadow-lg shadow-[#7C5CFC]/20 transition-all duration-300"
                                        >
                                            {isSubmittingFeedback ? (
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            ) : (
                                                <Check className="w-4 h-4 mr-2" />
                                            )}
                                            Envoyer mon retour
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-[#E8EBF0] no-print">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 rounded-xl hover:border-[#7C5CFC]/30 hover:text-[#7C5CFC] transition-all"
                                onClick={() => window.print()}
                            >
                                <Printer className="w-4 h-4" /> Imprimer la fiche
                            </Button>
                            {isUpcoming(selectedMeeting) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 rounded-xl hover:border-[#7C5CFC]/30 hover:text-[#7C5CFC] transition-all"
                                    onClick={() => generateICS(selectedMeeting)}
                                >
                                    <Download className="w-4 h-4" /> Ajouter au calendrier
                                </Button>
                            )}
                            <Button
                                variant="primary"
                                size="sm"
                                className="ml-auto rounded-xl bg-gradient-to-r from-[#6C3AFF] to-[#7C5CFC] hover:from-[#5B2AEE] hover:to-[#6C4CE0] shadow-sm"
                                onClick={() => setSelectedMeeting(null)}
                            >
                                Fermer
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
