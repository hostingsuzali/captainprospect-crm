"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, Badge, Button, Select, Modal } from "@/components/ui";
import {
    Calendar,
    Clock,
    User,
    Building2,
    Video,
    MapPin,
    Loader2,
    Filter,
    X,
    Mail,
    Phone,
    Globe,
    Linkedin,
    ArrowRight,
    Save,
    RotateCcw,
} from "lucide-react";
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
    description?: string;
    contact: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        title: string | null;
        email: string | null;
        company: {
            id: string;
            name: string;
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

// ============================================
// SDR MEETINGS PAGE
// ============================================

export default function SDRMeetingsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [lists, setLists] = useState<List[]>([]);

    // Get filters from URL
    const missionId = searchParams.get("missionId") || "";
    const listId = searchParams.get("listId") || "";

    // Fetch missions and lists for filters
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [missionsRes, listsRes] = await Promise.all([
                    fetch("/api/sdr/missions"),
                    fetch("/api/sdr/lists"),
                ]);
                const missionsJson = await missionsRes.json();
                const listsJson = await listsRes.json();

                if (missionsJson.success) {
                    setMissions(missionsJson.data);
                }
                if (listsJson.success) {
                    setLists(listsJson.data);
                }
            } catch (err) {
                console.error("Failed to fetch filters:", err);
            }
        };
        fetchFilters();
    }, []);

    // Fetch meetings with filters
    useEffect(() => {
        const fetchMeetings = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams();
                if (missionId) params.set("missionId", missionId);
                if (listId) params.set("listId", listId);

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
    }, [missionId, listId]);

    // Update URL when filters change
    const handleMissionChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set("missionId", value);
        } else {
            params.delete("missionId");
        }
        // Reset list filter when mission changes
        params.delete("listId");
        router.push(`/sdr/meetings?${params.toString()}`);
    };

    const handleListChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set("listId", value);
        } else {
            params.delete("listId");
        }
        router.push(`/sdr/meetings?${params.toString()}`);
    };

    const clearFilters = () => {
        router.push("/sdr/meetings");
    };

    // Filter lists by selected mission
    const filteredLists = useMemo(() => {
        if (!missionId) return lists;
        return lists.filter((list) => list.mission.id === missionId);
    }, [lists, missionId]);

    const hasActiveFilters = missionId || listId;
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [editNote, setEditNote] = useState("");
    const [editResult, setEditResult] = useState<MeetingResult>("MEETING_BOOKED");
    const [saving, setSaving] = useState(false);
    const [savingError, setSavingError] = useState<string | null>(null);
    const [remettreSubmitting, setRemettreSubmitting] = useState(false);

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

    const handleRemettreEnProspection = async () => {
        if (!selectedMeeting) return;
        setRemettreSubmitting(true);
        setSavingError(null);
        try {
            const note = editNote.trim() || "RDV annulé, contact remis en prospection";
            const res = await fetch(`/api/actions/${selectedMeeting.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ result: "MEETING_CANCELLED", note }),
            });
            const json = await res.json();
            if (!json.success) {
                setSavingError(json.error || "Erreur");
                return;
            }
            setMeetings((prev) =>
                prev.map((m) =>
                    m.id === selectedMeeting.id
                        ? { ...m, result: "MEETING_CANCELLED" as const, note }
                        : m
                )
            );
            setSelectedMeeting((prev) =>
                prev && prev.id === selectedMeeting.id
                    ? { ...prev, result: "MEETING_CANCELLED", note }
                    : prev
            );
            setEditResult("MEETING_CANCELLED");
            setEditNote(note);
        } catch (err) {
            setSavingError("Erreur réseau");
        } finally {
            setRemettreSubmitting(false);
        }
    };

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

    return (
        <div className="space-y-8 animate-fade-in p-2 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-900">
                        Mes Rendez-vous
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Planning et historique de vos opportunités qualifiées
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 flex flex-col items-center">
                        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Total</span>
                        <span className="text-xl font-bold text-indigo-700">{meetings.length}</span>
                    </div>
                </div>
            </div>

            {/* Filters - Glass Bar */}
            <div className="sticky top-4 z-30">
                <div className="bg-white/90 backdrop-blur-md border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-full p-2 pl-6 flex flex-col md:flex-row items-center gap-4 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 whitespace-nowrap">
                        <Filter className="w-4 h-4 text-indigo-500" />
                        <span>Filtrer par :</span>
                    </div>

                    <div className="flex-1 w-full flex flex-wrap md:flex-nowrap items-center gap-2 py-1">
                        <div className="min-w-[200px]">
                            <Select
                                placeholder="Toutes les missions"
                                options={[
                                    { value: "", label: "Toutes les missions" },
                                    ...missions.map((m) => ({
                                        value: m.id,
                                        label: `${m.name} (${m.client.name})`,
                                    })),
                                ]}
                                value={missionId}
                                onChange={handleMissionChange}
                                className="border-0 bg-transparent hover:bg-slate-100/50 rounded-full transition-colors focus:ring-0"
                            />
                        </div>
                        <div className="h-6 w-px bg-slate-200 mx-2" />
                        <div className="min-w-[200px]">
                            <Select
                                placeholder="Toutes les listes"
                                options={[
                                    { value: "", label: "Toutes les listes" },
                                    ...filteredLists.map((l) => ({
                                        value: l.id,
                                        label: l.name,
                                    })),
                                ]}
                                value={listId}
                                onChange={handleListChange}
                                disabled={!missionId && filteredLists.length === 0}
                                className="border-0 bg-transparent hover:bg-slate-100/50 rounded-full transition-colors focus:ring-0"
                            />
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="rounded-full hover:bg-red-50 hover:text-red-600 px-4 mr-1"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Effacer
                        </Button>
                    )}
                </div>
            </div>

            {/* List */}
            {meetings.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-100 ring-1 ring-slate-100">
                        <Calendar className="w-10 h-10 text-indigo-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Aucun rendez-vous</h3>
                    <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                        Vos rendez-vous validés apparaîtront ici. Continuez à prospecter pour remplir votre agenda !
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5">
                    {meetings.map((meeting) => (
                        <div
                            key={meeting.id}
                            className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                            onClick={() => setSelectedMeeting(meeting)}
                        >
                            <div className="flex flex-col md:flex-row">
                                {/* Date Ticket Stub */}
                                <div className="md:w-32 bg-indigo-600 p-6 flex flex-col items-center justify-center text-white relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 opacity-100" />
                                    <div className="relative z-10 text-center">
                                        <span className="text-xs font-bold uppercase tracking-widest opacity-80">
                                            {new Date(meeting.createdAt).toLocaleDateString('fr-FR', { month: 'short' })}
                                        </span>
                                        <span className="block text-4xl font-black my-1">
                                            {new Date(meeting.createdAt).getDate()}
                                        </span>
                                        <span className="text-xs font-medium opacity-80 bg-white/20 px-2 py-0.5 rounded-full">
                                            {new Date(meeting.createdAt).getFullYear()}
                                        </span>
                                    </div>
                                    {/* Perforation effect */}
                                    <div className="hidden md:block absolute right-0 top-0 bottom-0 w-4 translate-x-1/2">
                                        <div className="h-full w-full flex flex-col justify-between py-2">
                                            {[...Array(8)].map((_, i) => (
                                                <div key={i} className="w-3 h-3 rounded-full bg-white" />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-6 pl-8">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500 font-bold border border-slate-200">
                                                {meeting.contact.firstName?.charAt(0) || <User className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                                                    {meeting.contact.firstName} {meeting.contact.lastName}
                                                </h3>
                                                <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                                                    <Building2 className="w-3.5 h-3.5" />
                                                    <span className="font-medium">{meeting.contact.company.name}</span>
                                                    {meeting.contact.title && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                            <span>{meeting.contact.title}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {meeting.result === "MEETING_CANCELLED" ? (
                                                <Badge className="bg-red-50 text-red-700 border-red-200">Annulé</Badge>
                                            ) : (
                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Confirmé</Badge>
                                            )}
                                            {meeting.mission && (
                                                <Badge className="bg-gradient-to-r from-emerald-50 to-teal-50 text-teal-700 border-teal-100 hover:from-emerald-100 hover:to-teal-100">
                                                    Mission: {meeting.mission.name}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-50">
                                        <div className="flex items-center gap-6 text-sm">
                                            <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                                                <Video className="w-4 h-4 text-indigo-500" />
                                                <span className="font-medium">Visio Conférence</span>
                                            </div>

                                            {meeting.note && (
                                                <div className="flex items-center gap-2 text-slate-500 max-w-xs truncate">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                    <span className="italic">"{meeting.note}"</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 text-indigo-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                                            Voir les détails <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Meeting Detail Modal */}
            {selectedMeeting && (
                <Modal
                    isOpen={!!selectedMeeting}
                    onClose={() => setSelectedMeeting(null)}
                    title="Détails du rendez-vous"
                    size="lg"
                >
                    <div className="space-y-8">
                        {/* Top Card: Date & Context */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 text-white flex flex-col justify-between shadow-lg shadow-indigo-200">
                                <div>
                                    <p className="text-indigo-100 text-sm font-medium uppercase tracking-wide">Date & Heure</p>
                                    <p className="text-3xl font-bold mt-2">
                                        {new Date(selectedMeeting.createdAt).toLocaleTimeString('fr-FR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-lg font-semibold">
                                        {new Date(selectedMeeting.createdAt).toLocaleDateString('fr-FR', {
                                            weekday: 'long',
                                            day: 'numeric',
                                            month: 'long',
                                        })}
                                    </p>
                                    <p className="text-indigo-100 text-sm mt-1">{new Date(selectedMeeting.createdAt).getFullYear()}</p>
                                </div>
                            </div>

                            <div className="md:col-span-2 bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <p className="text-slate-500 text-sm font-bold uppercase tracking-wide">Statut du RDV</p>
                                        <Select
                                            value={editResult}
                                            onChange={(v) => setEditResult(v as MeetingResult)}
                                            options={[
                                                { value: "MEETING_BOOKED", label: "Confirmé" },
                                                { value: "MEETING_CANCELLED", label: "Annulé" },
                                            ]}
                                            className="min-w-[140px] border border-slate-200 rounded-xl bg-white"
                                        />
                                    </div>
                                    {editResult === "MEETING_CANCELLED" && (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                                            Le contact redevient disponible dans la file de prospection (Actions).
                                        </p>
                                    )}
                                    {editResult === "MEETING_BOOKED" && (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleRemettreEnProspection}
                                            disabled={saving || remettreSubmitting}
                                            className="mt-3 gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                                        >
                                            {remettreSubmitting ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <RotateCcw className="w-4 h-4" />
                                            )}
                                            Remettre en prospection
                                        </Button>
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
                                        <a href="#" className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                                <Linkedin className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                                            </div>
                                            <span className="text-sm text-slate-600 group-hover:text-blue-700">Voir le profil LinkedIn</span>
                                        </a>
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
                                            <a href="#" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                                                Voir la fiche entreprise <ArrowRight className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-6">
                                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                                            <p className="text-xs text-slate-500 uppercase">Secteur</p>
                                            <p className="font-medium text-slate-900 text-sm">Tech / SaaS</p>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-lg text-center">
                                            <p className="text-xs text-slate-500 uppercase">Effectif</p>
                                            <p className="font-medium text-slate-900 text-sm">50-200</p>
                                        </div>
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

                        {savingError && (
                            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl">{savingError}</p>
                        )}
                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                            <Button variant="ghost" onClick={() => setSelectedMeeting(null)}>
                                Fermer
                            </Button>
                            <Button onClick={handleSaveMeeting} disabled={saving} className="gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Enregistrer
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
