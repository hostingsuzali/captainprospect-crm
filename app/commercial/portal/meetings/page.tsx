"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    Calendar, Search, X, ThumbsUp, Minus, ThumbsDown, XCircle,
    Check, Loader2, MessageSquare, Building2, MapPin, Video, Phone,
    ArrowRight, ChevronDown, ChevronUp, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui";

// ── Types ──────────────────────────────────────────────────────────────────

interface Meeting {
    id: string;
    callbackDate?: string | null;
    result: string;
    note?: string | null;
    meetingType?: string | null;
    meetingAddress?: string | null;
    meetingJoinUrl?: string | null;
    meetingPhone?: string | null;
    cancellationReason?: string | null;
    contact?: {
        id: string;
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
        company: { id: string; name: string; industry?: string | null };
    } | null;
    campaign: { name: string; mission: { name: string } };
    sdr: { name: string };
    meetingFeedback?: {
        outcome: string;
        recontactRequested: string;
        clientNote?: string | null;
    } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const OUTCOME_OPTIONS = [
    { value: "POSITIVE", label: "Positif", icon: ThumbsUp, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    { value: "NEUTRAL", label: "Neutre", icon: Minus, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    { value: "NEGATIVE", label: "Négatif", icon: ThumbsDown, color: "text-red-600", bg: "bg-red-50 border-red-200" },
    { value: "NO_SHOW", label: "No-show", icon: XCircle, color: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
] as const;

const RECONTACT_OPTIONS = [
    { value: "YES", label: "Oui" },
    { value: "MAYBE", label: "Peut-être" },
    { value: "NO", label: "Non" },
] as const;

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
}

function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(dateStr: string) {
    const d = new Date(dateStr);
    return {
        day: d.getDate(),
        month: d.toLocaleDateString("fr-FR", { month: "short" }).toUpperCase().replace(".", ""),
    };
}

function meetingTypeLabel(type?: string | null) {
    switch (type) {
        case "VISIO": return "Visio";
        case "PHYSIQUE": return "Physique";
        case "TELEPHONIQUE": return "Téléphonique";
        default: return type ?? "";
    }
}

function MeetingTypePill({ type }: { type?: string | null }) {
    if (!type) return null;
    const config = {
        VISIO: { icon: Video, color: "text-blue-600 bg-blue-50 border-blue-200" },
        PHYSIQUE: { icon: MapPin, color: "text-purple-600 bg-purple-50 border-purple-200" },
        TELEPHONIQUE: { icon: Phone, color: "text-orange-600 bg-orange-50 border-orange-200" },
    } as Record<string, { icon: React.ElementType; color: string }>;
    const c = config[type];
    if (!c) return null;
    const Icon = c.icon;
    return (
        <span className={cn("inline-flex items-center gap-1 text-[10.5px] font-semibold border px-2 py-[2px] rounded-full", c.color)}>
            <Icon className="w-3 h-3" />{meetingTypeLabel(type)}
        </span>
    );
}

// ── Feedback Form Component ────────────────────────────────────────────────

function FeedbackForm({
    meeting,
    onSaved,
}: {
    meeting: Meeting;
    onSaved: (feedback: Meeting["meetingFeedback"]) => void;
}) {
    const toast = useToast();
    const [outcome, setOutcome] = useState(meeting.meetingFeedback?.outcome ?? "");
    const [recontact, setRecontact] = useState(meeting.meetingFeedback?.recontactRequested ?? "");
    const [note, setNote] = useState(meeting.meetingFeedback?.clientNote ?? "");
    const [isSaving, setIsSaving] = useState(false);

    const isEditing = !!meeting.meetingFeedback;
    const hasChanges =
        outcome !== (meeting.meetingFeedback?.outcome ?? "") ||
        recontact !== (meeting.meetingFeedback?.recontactRequested ?? "") ||
        note !== (meeting.meetingFeedback?.clientNote ?? "");

    const handleSubmit = async () => {
        if (!outcome || !recontact) {
            toast.error("Champs requis", "Veuillez sélectionner un résultat et une préférence de recontact");
            return;
        }
        setIsSaving(true);
        try {
            const method = isEditing ? "PATCH" : "POST";
            const res = await fetch(`/api/commercial/meetings/${meeting.id}/feedback`, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ outcome, recontactRequested: recontact, clientNote: note }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            toast.success("Feedback enregistré", "Merci pour votre retour !");
            onSaved({ outcome: outcome as never, recontactRequested: recontact as never, clientNote: note });
        } catch {
            toast.error("Erreur", "Impossible d'enregistrer le feedback");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mt-4 pt-4 border-t border-[#E8EBF0] space-y-4">
            <p className="text-[12px] font-semibold text-[#6B7194] uppercase tracking-wider">
                {isEditing ? "Votre feedback" : "Donnez votre feedback"}
            </p>

            {/* Outcome */}
            <div>
                <p className="text-[12px] font-medium text-[#3D3F6B] mb-2">Résultat du RDV</p>
                <div className="flex flex-wrap gap-2">
                    {OUTCOME_OPTIONS.map(({ value, label, icon: Icon, color, bg }) => (
                        <button
                            key={value}
                            onClick={() => setOutcome(value)}
                            className={cn(
                                "inline-flex items-center gap-1.5 text-[12px] font-semibold border px-3 py-1.5 rounded-lg transition-all",
                                outcome === value ? bg + " ring-2 ring-offset-1 ring-current " + color : "text-[#6B7194] bg-white border-[#E8EBF0] hover:border-gray-300"
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />{label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Recontact */}
            <div>
                <p className="text-[12px] font-medium text-[#3D3F6B] mb-2">Recontacter ce prospect ?</p>
                <div className="flex gap-2">
                    {RECONTACT_OPTIONS.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => setRecontact(value)}
                            className={cn(
                                "text-[12px] font-semibold border px-3 py-1.5 rounded-lg transition-all",
                                recontact === value
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-offset-1 ring-emerald-400"
                                    : "text-[#6B7194] bg-white border-[#E8EBF0] hover:border-gray-300"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Note */}
            <div>
                <p className="text-[12px] font-medium text-[#3D3F6B] mb-2">Note (optionnel)</p>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Commentaire sur le rendez-vous..."
                    rows={3}
                    className="w-full text-sm text-[#12122A] bg-[#F8F9FC] border border-[#E8EBF0] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all"
                />
            </div>

            {(!isEditing || hasChanges) && (
                <button
                    onClick={handleSubmit}
                    disabled={isSaving || !outcome || !recontact}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {isEditing ? "Mettre à jour" : "Envoyer le feedback"}
                </button>
            )}
        </div>
    );
}

// ── Meeting Card ───────────────────────────────────────────────────────────

function MeetingCard({ meeting, onFeedbackSaved }: {
    meeting: Meeting;
    onFeedbackSaved: (id: string, feedback: Meeting["meetingFeedback"]) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const isCancelled = meeting.result === "MEETING_CANCELLED";
    const hasFeedback = !!meeting.meetingFeedback;
    const dateInfo = meeting.callbackDate ? formatShortDate(meeting.callbackDate) : null;

    return (
        <div className={cn(
            "premium-card overflow-hidden transition-all duration-200",
            isCancelled && "opacity-60"
        )}>
            <div
                className="flex items-start gap-4 p-5 cursor-pointer hover:bg-[#FAFBFF] transition-colors"
                onClick={() => setExpanded((v) => !v)}
            >
                {/* Date pill */}
                <div className={cn(
                    "w-[52px] shrink-0 flex flex-col items-center py-2 px-1 rounded-xl border",
                    isCancelled
                        ? "bg-gray-50 border-gray-200"
                        : "bg-emerald-50 border-emerald-100"
                )}>
                    {dateInfo ? (
                        <>
                            <span className="text-[18px] font-extrabold text-[#12122A] leading-none">{dateInfo.day}</span>
                            <span className="text-[9px] font-bold text-[#8B8DAF] uppercase tracking-wide mt-0.5">{dateInfo.month}</span>
                        </>
                    ) : (
                        <span className="text-[8px] font-bold text-[#8B8DAF] uppercase text-center leading-tight">À conf.</span>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[14px] font-bold text-[#12122A]">
                            {meeting.contact
                                ? [meeting.contact.firstName, meeting.contact.lastName].filter(Boolean).join(" ") || "Contact"
                                : "Contact inconnu"}
                        </span>
                        {meeting.contact?.title && (
                            <span className="text-[11px] text-[#8B8DAF]">— {meeting.contact.title}</span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {meeting.contact?.company && (
                            <span className="inline-flex items-center gap-1 text-[12px] text-[#5C5E7E] font-medium">
                                <Building2 className="w-3 h-3 text-[#A0A3BD]" />
                                {meeting.contact.company.name}
                            </span>
                        )}
                        {meeting.callbackDate && (
                            <span className="text-[11.5px] text-[#8B8DAF]">
                                {formatDate(meeting.callbackDate)} · {formatTime(meeting.callbackDate)}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <MeetingTypePill type={meeting.meetingType} />
                        <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-[2px] rounded-full">
                            {meeting.campaign.mission.name}
                        </span>
                        {isCancelled && (
                            <span className="text-[10.5px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-[2px] rounded-full">
                                Annulé
                            </span>
                        )}
                        {hasFeedback && !isCancelled && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-[2px] rounded-full">
                                <Check className="w-3 h-3" /> Feedback envoyé
                            </span>
                        )}
                        {!hasFeedback && !isCancelled && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-[2px] rounded-full">
                                <MessageSquare className="w-3 h-3" /> Feedback attendu
                            </span>
                        )}
                    </div>
                </div>

                {/* Expand chevron */}
                <div className="shrink-0 pt-1">
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-[#A0A3BD]" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-[#A0A3BD]" />
                    )}
                </div>
            </div>

            {/* Expanded section */}
            {expanded && (
                <div className="px-5 pb-5 border-t border-[#F0F1F5]">
                    {/* Meeting details */}
                    {(meeting.meetingJoinUrl || meeting.meetingAddress || meeting.meetingPhone) && (
                        <div className="mt-4 space-y-2">
                            {meeting.meetingJoinUrl && (
                                <a
                                    href={meeting.meetingJoinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                    <Video className="w-4 h-4" /> Rejoindre la visio
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </a>
                            )}
                            {meeting.meetingAddress && (
                                <p className="inline-flex items-center gap-2 text-sm text-[#5C5E7E]">
                                    <MapPin className="w-4 h-4 text-[#A0A3BD]" /> {meeting.meetingAddress}
                                </p>
                            )}
                            {meeting.meetingPhone && (
                                <p className="inline-flex items-center gap-2 text-sm text-[#5C5E7E]">
                                    <Phone className="w-4 h-4 text-[#A0A3BD]" /> {meeting.meetingPhone}
                                </p>
                            )}
                        </div>
                    )}

                    {meeting.note && (
                        <div className="mt-4 bg-[#F8F9FC] rounded-lg px-4 py-3 border border-[#E8EBF0]">
                            <p className="text-[11px] font-semibold text-[#8B8DAF] uppercase tracking-wider mb-1">Note SDR</p>
                            <p className="text-sm text-[#3D3F6B] leading-relaxed whitespace-pre-wrap">{meeting.note}</p>
                        </div>
                    )}

                    {/* Feedback form */}
                    {!isCancelled && (
                        <FeedbackForm
                            meeting={meeting}
                            onSaved={(fb) => onFeedbackSaved(meeting.id, fb)}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CommercialMeetingsPage() {
    const toast = useToast();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "upcoming" | "feedback_pending" | "cancelled">("upcoming");

    const fetchMeetings = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/commercial/meetings");
            const json = await res.json();
            if (json.success) setMeetings(json.data?.allMeetings ?? []);
        } catch {
            toast.error("Erreur", "Impossible de charger les rendez-vous");
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

    const handleFeedbackSaved = useCallback((id: string, fb: Meeting["meetingFeedback"]) => {
        setMeetings((prev) =>
            prev.map((m) => m.id === id ? { ...m, meetingFeedback: fb } : m)
        );
    }, []);

    const filteredMeetings = useMemo(() => {
        const now = new Date();
        return meetings
            .filter((m) => {
                if (filter === "upcoming") return m.result === "MEETING_BOOKED" && m.callbackDate && new Date(m.callbackDate) >= now;
                if (filter === "feedback_pending") return m.result === "MEETING_BOOKED" && !m.meetingFeedback;
                if (filter === "cancelled") return m.result === "MEETING_CANCELLED";
                return true;
            })
            .filter((m) => {
                if (!search) return true;
                const q = search.toLowerCase();
                return (
                    m.contact?.firstName?.toLowerCase().includes(q) ||
                    m.contact?.lastName?.toLowerCase().includes(q) ||
                    m.contact?.company?.name?.toLowerCase().includes(q) ||
                    m.campaign.mission.name.toLowerCase().includes(q)
                );
            });
    }, [meetings, filter, search]);

    const pendingFeedbackCount = meetings.filter(
        (m) => m.result === "MEETING_BOOKED" && !m.meetingFeedback
    ).length;

    const FILTER_TABS = [
        { id: "upcoming" as const, label: "À venir" },
        { id: "all" as const, label: "Tous" },
        { id: "feedback_pending" as const, label: `Feedback attendu${pendingFeedbackCount > 0 ? ` (${pendingFeedbackCount})` : ""}` },
        { id: "cancelled" as const, label: "Annulés" },
    ];

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-bold text-[#12122A] tracking-tight">Mes Rendez-vous</h1>
                    <p className="text-sm text-[#6B7194] mt-0.5">
                        {meetings.filter((m) => m.result === "MEETING_BOOKED").length} RDV confirmés
                    </p>
                </div>
            </div>

            {/* Filters + search */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                    <input
                        type="text"
                        placeholder="Rechercher un contact, une entreprise..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-9 py-2.5 text-sm bg-white border border-[#E8EBF0] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="w-3.5 h-3.5 text-[#A0A3BD] hover:text-[#6B7194]" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1 bg-white border border-[#E8EBF0] rounded-xl p-1">
                    <Filter className="w-3.5 h-3.5 text-[#A0A3BD] ml-2 shrink-0" />
                    {FILTER_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={cn(
                                "text-[11.5px] font-semibold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap",
                                filter === tab.id
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : "text-[#6B7194] hover:bg-[#F4F5FA]"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Meeting list */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse h-24 bg-white rounded-2xl border border-[#E8EBF0]" />
                    ))}
                </div>
            ) : filteredMeetings.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-[#F4F6F9] flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-6 h-6 text-[#A0A3BD]" />
                    </div>
                    <p className="text-sm font-medium text-[#6B7194]">Aucun rendez-vous trouvé</p>
                    <p className="text-xs text-[#A0A3BD] mt-1">Essayez de modifier vos filtres ou votre recherche</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredMeetings.map((m) => (
                        <MeetingCard
                            key={m.id}
                            meeting={m}
                            onFeedbackSaved={handleFeedbackSaved}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
