"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useToast } from "@/components/ui";
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Users,
    Clock,
    Phone,
    Mail,
    Linkedin,
    Plus,
    X,
    Copy,
    AlertTriangle,
} from "lucide-react";
import { Card, Button, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface Mission {
    id: string;
    name: string;
    channel: string;
    clientName: string;
}

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: "SDR" | "BUSINESS_DEVELOPER";
    missions: Mission[];
}

interface ScheduleBlock {
    id: string;
    sdrId: string;
    missionId: string;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string;
    status: string;
    mission: {
        id: string;
        name: string;
        channel?: string;
        client?: { name: string };
    };
}

// ============================================
// CONSTANTS
// ============================================

const CHANNEL_ICONS: Record<string, React.ElementType> = {
    CALL: Phone,
    EMAIL: Mail,
    LINKEDIN: Linkedin,
};

const MISSION_COLORS = [
    { bg: "bg-violet-100", border: "border-violet-300", text: "text-violet-700", dot: "bg-violet-500" },
    { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500" },
    { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-700", dot: "bg-amber-500" },
    { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-700", dot: "bg-rose-500" },
    { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-700", dot: "bg-cyan-500" },
    { bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-700", dot: "bg-indigo-500" },
];

const TIME_SLOTS = [
    { label: "08:00 - 09:00", start: "08:00", end: "09:00" },
    { label: "09:00 - 10:00", start: "09:00", end: "10:00" },
    { label: "10:00 - 11:00", start: "10:00", end: "11:00" },
    { label: "11:00 - 12:00", start: "11:00", end: "12:00" },
    { label: "12:00 - 13:00", start: "12:00", end: "13:00" },
    { label: "13:00 - 14:00", start: "13:00", end: "14:00" },
    { label: "14:00 - 15:00", start: "14:00", end: "15:00" },
    { label: "15:00 - 16:00", start: "15:00", end: "16:00" },
    { label: "16:00 - 17:00", start: "16:00", end: "17:00" },
    { label: "17:00 - 18:00", start: "17:00", end: "18:00" },
];

const QUICK_DURATIONS = [
    { label: "1h", hours: 1 },
    { label: "2h", hours: 2 },
    { label: "3h", hours: 3 },
    { label: "4h", hours: 4 },
    { label: "Matin (4h)", hours: 4, start: "08:00", end: "12:00" },
    { label: "Après-midi (5h)", hours: 5, start: "13:00", end: "18:00" },
];

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const WEEKLY_CAPACITY = 40;

function getColor(id: string) {
    const hash = id.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
    return MISSION_COLORS[Math.abs(hash) % MISSION_COLORS.length];
}

// Use local date (not UTC) so planning "Friday" stays Friday in all timezones
function normalizeDate(d: string | Date): string {
    if (typeof d === 'string') return d.split("T")[0];
    const date = new Date(d);
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function calcHours(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10;
}

function addHoursToTime(time: string, hours: number): string {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m + hours * 60;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${Math.min(18, newH).toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}

// ============================================
// BLOCK COMPONENT
// ============================================

function BlockItem({
    block,
    onDelete,
    isDeleting
}: {
    block: ScheduleBlock;
    onDelete: () => void;
    isDeleting: boolean;
}) {
    const color = getColor(block.missionId);
    const Icon = CHANNEL_ICONS[block.mission.channel || "CALL"] || Phone;
    const hours = calcHours(block.startTime, block.endTime);

    return (
        <div className={cn(
            "group relative p-2.5 rounded-lg border transition-all",
            color.bg, color.border,
            isDeleting && "opacity-50"
        )}>
            <button
                onClick={onDelete}
                disabled={isDeleting}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-red-600 shadow-md"
            >
                <X className="w-3 h-3" />
            </button>

            <div className="flex items-start gap-2">
                <div className={cn("w-6 h-6 rounded flex items-center justify-center flex-shrink-0", color.bg)}>
                    <Icon className={cn("w-3.5 h-3.5", color.text)} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold truncate", color.text)}>{block.mission.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-600">{block.startTime} - {block.endTime}</span>
                        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", color.bg, color.text)}>{hours}h</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================
// TEAM MEMBER ROW
// ============================================

function MemberRow({
    member,
    weekDates,
    blocks,
    weeklyHours,
    onAddClick,
    onDeleteBlock,
    deletingBlockId,
}: {
    member: TeamMember;
    weekDates: Date[];
    blocks: ScheduleBlock[];
    weeklyHours: number;
    onAddClick: (memberId: string, date: Date) => void;
    onDeleteBlock: (id: string) => void;
    deletingBlockId: string | null;
}) {
    const isSDR = member.role === "SDR";
    const capacityPct = Math.min(100, Math.round((weeklyHours / WEEKLY_CAPACITY) * 100));
    const isOver = weeklyHours > WEEKLY_CAPACITY;

    return (
        <div className="grid grid-cols-[200px_repeat(5,1fr)] gap-2 py-3 border-b border-slate-100 last:border-0">
            {/* Member Info */}
            <div className="flex items-start gap-3 pr-3">
                <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0",
                    isSDR ? "bg-indigo-500" : "bg-emerald-500"
                )}>
                    {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{member.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                            isSDR ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                            {isSDR ? "SDR" : "BD"}
                        </span>
                        <span className={cn(
                            "text-[10px] font-medium",
                            isOver ? "text-red-600" : "text-slate-500"
                        )}>
                            {weeklyHours}h/{WEEKLY_CAPACITY}h
                        </span>
                    </div>
                    {/* Capacity bar */}
                    <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all",
                                isOver ? "bg-red-500" : capacityPct > 80 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${capacityPct}%` }}
                        />
                    </div>
                    {isOver && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-red-600">
                            <AlertTriangle className="w-3 h-3" />
                            Surcharge
                        </div>
                    )}
                </div>
            </div>

            {/* Day Cells */}
            {weekDates.map((date, i) => {
                const dateStr = normalizeDate(date);
                const dayBlocks = blocks.filter(b =>
                    b.sdrId === member.id &&
                    normalizeDate(b.date) === dateStr &&
                    b.status !== "CANCELLED"
                );
                const isToday = date.toDateString() === new Date().toDateString();
                const dayHours = dayBlocks.reduce((sum, b) => sum + calcHours(b.startTime, b.endTime), 0);

                return (
                    <div
                        key={i}
                        className={cn(
                            "min-h-[100px] rounded-lg border p-2 transition-all",
                            isToday ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-white",
                            "hover:border-indigo-400 hover:shadow-sm"
                        )}
                    >
                        {/* Day hours badge */}
                        {dayHours > 0 && (
                            <div className="flex justify-end mb-1">
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                                    {dayHours}h
                                </span>
                            </div>
                        )}

                        {/* Blocks */}
                        <div className="space-y-2">
                            {dayBlocks.map(block => (
                                <BlockItem
                                    key={block.id}
                                    block={block}
                                    onDelete={() => onDeleteBlock(block.id)}
                                    isDeleting={deletingBlockId === block.id}
                                />
                            ))}
                        </div>

                        {/* Add button */}
                        <button
                            onClick={() => onAddClick(member.id, date)}
                            className={cn(
                                "w-full mt-2 py-1.5 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg transition-all",
                                "hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50",
                                dayBlocks.length === 0 && "py-6"
                            )}
                        >
                            <Plus className="w-4 h-4 mx-auto" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

// ============================================
// ADD BLOCK MODAL
// ============================================

function AddBlockModal({
    isOpen,
    onClose,
    member,
    date,
    missions,
    onSubmit,
    isSubmitting,
}: {
    isOpen: boolean;
    onClose: () => void;
    member: TeamMember | null;
    date: Date | null;
    missions: Mission[];
    onSubmit: (data: { missionId: string; startTime: string; endTime: string }) => void;
    isSubmitting: boolean;
}) {
    const [selectedMission, setSelectedMission] = useState<string>("");
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("12:00");
    const [selectedDuration, setSelectedDuration] = useState<number | null>(3);

    // Filter to missions the member is assigned to
    const assignedMissions = useMemo(() => {
        if (!member) return missions;
        return missions.filter(m => member.missions.some(mm => mm.id === m.id));
    }, [member, missions]);

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setSelectedMission("");
            setStartTime("09:00");
            setEndTime("12:00");
            setSelectedDuration(3);
        }
    }, [isOpen]);

    const handleDurationClick = (dur: typeof QUICK_DURATIONS[0]) => {
        if (dur.start && dur.end) {
            setStartTime(dur.start);
            setEndTime(dur.end);
        } else {
            setEndTime(addHoursToTime(startTime, dur.hours));
        }
        setSelectedDuration(dur.hours);
    };

    const handleStartTimeChange = (time: string) => {
        setStartTime(time);
        if (selectedDuration) {
            setEndTime(addHoursToTime(time, selectedDuration));
        }
    };

    const handleSubmit = () => {
        if (!selectedMission) return;
        onSubmit({ missionId: selectedMission, startTime, endTime });
    };

    const hours = calcHours(startTime, endTime);

    if (!member || !date) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nouveau créneau">
            <div className="space-y-5">
                {/* Context */}
                <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold",
                            member.role === "SDR" ? "bg-indigo-500" : "bg-emerald-500"
                        )}>
                            {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900">{member.name}</p>
                            <p className="text-sm text-slate-500">
                                {date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Mission Selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Mission</label>
                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                        {assignedMissions.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">
                                Aucune mission assignée à ce membre
                            </p>
                        ) : (
                            assignedMissions.map(m => {
                                const color = getColor(m.id);
                                const Icon = CHANNEL_ICONS[m.channel] || Phone;
                                const isSelected = selectedMission === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedMission(m.id)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                                            isSelected
                                                ? `${color.bg} ${color.border}`
                                                : "border-slate-200 hover:border-slate-300"
                                        )}
                                    >
                                        <div className={cn("w-2.5 h-2.5 rounded-full", color.dot)} />
                                        <Icon className={cn("w-4 h-4", isSelected ? color.text : "text-slate-400")} />
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("font-medium truncate", isSelected ? color.text : "text-slate-900")}>
                                                {m.name}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">{m.clientName}</p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Quick Durations */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Durée</label>
                    <div className="flex flex-wrap gap-2">
                        {QUICK_DURATIONS.map(dur => (
                            <button
                                key={dur.label}
                                onClick={() => handleDurationClick(dur)}
                                className={cn(
                                    "px-3 py-1.5 text-sm font-medium rounded-lg border transition-all",
                                    selectedDuration === dur.hours
                                        ? "bg-indigo-500 text-white border-indigo-500"
                                        : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
                                )}
                            >
                                {dur.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Time Selection */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Début</label>
                        <select
                            value={startTime}
                            onChange={(e) => handleStartTimeChange(e.target.value)}
                            className="w-full h-10 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {TIME_SLOTS.map(slot => (
                                <option key={slot.start} value={slot.start}>{slot.start}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Fin</label>
                        <select
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full h-10 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {TIME_SLOTS.map(slot => (
                                <option key={slot.end} value={slot.end}>{slot.end}</option>
                            ))}
                            <option value="18:00">18:00</option>
                        </select>
                    </div>
                </div>

                {/* Summary */}
                <div className="p-3 bg-indigo-50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-700">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">{hours}h planifiées</span>
                    </div>
                    <span className="text-sm text-indigo-600">{startTime} → {endTime}</span>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose}>Annuler</Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!selectedMission || isSubmitting}
                        isLoading={isSubmitting}
                    >
                        Créer le créneau
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// ============================================
// MAIN PAGE
// ============================================

export default function PlanningPage() {
    const { success, error: showError } = useToast();

    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [allMissions, setAllMissions] = useState<Mission[]>([]);
    const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMember, setModalMember] = useState<TeamMember | null>(null);
    const [modalDate, setModalDate] = useState<Date | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Current week
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        return monday;
    });

    // ============================================
    // FETCH DATA
    // ============================================

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const startDate = normalizeDate(currentWeekStart);
            const endDate = new Date(currentWeekStart);
            endDate.setDate(endDate.getDate() + 6);

            const [teamRes, blocksRes, missionsRes] = await Promise.all([
                fetch("/api/planning/sdrs"),
                fetch(`/api/planning?startDate=${startDate}&endDate=${normalizeDate(endDate)}`),
                fetch("/api/missions?isActive=true"),
            ]);

            const [teamJson, blocksJson, missionsJson] = await Promise.all([
                teamRes.json(), blocksRes.json(), missionsRes.json(),
            ]);

            if (teamJson.success) setTeamMembers(teamJson.data);
            if (blocksJson.success) setBlocks(blocksJson.data || []);
            if (missionsJson.success && missionsJson.data) {
                const data = Array.isArray(missionsJson.data) ? missionsJson.data : [];
                setAllMissions(data.map((m: Record<string, unknown>) => ({
                    id: m.id as string,
                    name: m.name as string,
                    channel: m.channel as string,
                    clientName: ((m.client as Record<string, unknown>)?.name as string) || "—"
                })));
            }
        } catch {
            showError("Erreur", "Impossible de charger les données");
        } finally {
            setIsLoading(false);
        }
    }, [currentWeekStart, showError]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ============================================
    // COMPUTED
    // ============================================

    const weekDates = useMemo(() => Array.from({ length: 5 }, (_, i) => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        return d;
    }), [currentWeekStart]);

    const weeklyHoursByMember = useMemo(() => {
        const hours: Record<string, number> = {};
        teamMembers.forEach(m => { hours[m.id] = 0; });
        blocks
            .filter(b => b.status !== "CANCELLED")
            .forEach(b => {
                if (hours[b.sdrId] !== undefined) {
                    hours[b.sdrId] += calcHours(b.startTime, b.endTime);
                }
            });
        return hours;
    }, [blocks, teamMembers]);

    const formatWeekRange = () => {
        const end = new Date(currentWeekStart);
        end.setDate(end.getDate() + 4);
        return `${currentWeekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
    };

    // ============================================
    // ACTIONS
    // ============================================

    const navigateWeek = (dir: "prev" | "next") => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + (dir === "prev" ? -7 : 7));
        setCurrentWeekStart(d);
    };

    const goToToday = () => {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        setCurrentWeekStart(monday);
    };

    const handleAddClick = (memberId: string, date: Date) => {
        const member = teamMembers.find(m => m.id === memberId);
        if (member) {
            setModalMember(member);
            setModalDate(date);
            setModalOpen(true);
        }
    };

    const handleCreateBlock = async (data: { missionId: string; startTime: string; endTime: string }) => {
        if (!modalMember || !modalDate) return;
        setIsSubmitting(true);

        try {
            const res = await fetch("/api/planning", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sdrId: modalMember.id,
                    missionId: data.missionId,
                    date: normalizeDate(modalDate),
                    startTime: data.startTime,
                    endTime: data.endTime,
                }),
            });
            const json = await res.json();

            if (json.success) {
                success("Créneau créé", `${data.startTime} - ${data.endTime}`);
                setModalOpen(false);
                fetchData();
            } else {
                showError("Erreur", json.error || "Impossible de créer le créneau");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteBlock = async (blockId: string) => {
        setDeletingBlockId(blockId);
        try {
            const res = await fetch(`/api/planning/${blockId}`, { method: "DELETE" });
            const json = await res.json();

            if (json.success) {
                success("Supprimé", "Le créneau a été supprimé");
                setBlocks(prev => prev.filter(b => b.id !== blockId));
            } else {
                showError("Erreur", json.error || "Impossible de supprimer");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setDeletingBlockId(null);
        }
    };

    const handleCopyWeek = async () => {
        setIsSubmitting(true);
        const next = new Date(currentWeekStart);
        next.setDate(next.getDate() + 7);

        try {
            const res = await fetch("/api/planning/copy-week", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceStartDate: normalizeDate(currentWeekStart),
                    targetStartDate: normalizeDate(next),
                }),
            });
            const json = await res.json();

            if (json.success) {
                success("Copié", `${json.data.created} créneaux copiés`);
                navigateWeek("next");
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============================================
    // RENDER
    // ============================================

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Planning équipe</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Cliquez sur + pour ajouter un créneau</p>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyWeek}
                    disabled={isSubmitting}
                    className="gap-2"
                >
                    <Copy className="w-4 h-4" />
                    Copier → semaine suivante
                </Button>
            </div>

            {/* Navigation */}
            <Card className="!p-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                            <button onClick={() => navigateWeek("prev")} className="p-2 hover:bg-slate-50 border-r border-slate-200">
                                <ChevronLeft className="w-5 h-5 text-slate-600" />
                            </button>
                            <button onClick={() => navigateWeek("next")} className="p-2 hover:bg-slate-50">
                                <ChevronRight className="w-5 h-5 text-slate-600" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-indigo-500" />
                            <span className="font-semibold text-slate-900">{formatWeekRange()}</span>
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={goToToday}>Aujourd'hui</Button>
                </div>
            </Card>

            {/* Grid */}
            <Card className="overflow-hidden">
                {/* Header Row */}
                <div className="grid grid-cols-[200px_repeat(5,1fr)] gap-2 p-3 bg-slate-50 border-b border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Équipe ({teamMembers.length})
                    </div>
                    {weekDates.map((d, i) => {
                        const isToday = d.toDateString() === new Date().toDateString();
                        return (
                            <div key={i} className={cn(
                                "text-center py-1 rounded-lg",
                                isToday && "bg-indigo-100"
                            )}>
                                <div className={cn(
                                    "text-xs font-medium uppercase",
                                    isToday ? "text-indigo-600" : "text-slate-500"
                                )}>
                                    {DAYS[i]}
                                </div>
                                <div className={cn(
                                    "text-lg font-bold",
                                    isToday ? "text-indigo-600" : "text-slate-900"
                                )}>
                                    {d.getDate()}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Team Rows */}
                <div className="p-3">
                    {teamMembers.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Aucun membre d'équipe</p>
                        </div>
                    ) : (
                        teamMembers.map(member => (
                            <MemberRow
                                key={member.id}
                                member={member}
                                weekDates={weekDates}
                                blocks={blocks}
                                weeklyHours={weeklyHoursByMember[member.id] || 0}
                                onAddClick={handleAddClick}
                                onDeleteBlock={handleDeleteBlock}
                                deletingBlockId={deletingBlockId}
                            />
                        ))
                    )}
                </div>
            </Card>

            {/* Add Modal */}
            <AddBlockModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                member={modalMember}
                date={modalDate}
                missions={allMissions}
                onSubmit={handleCreateBlock}
                isSubmitting={isSubmitting}
            />
        </div>
    );
}
