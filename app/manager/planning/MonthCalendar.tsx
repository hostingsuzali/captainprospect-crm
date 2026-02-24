'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Plus, X, Clock, UserCircle, Loader2,
    Check, Phone, Mail, Linkedin, CalendarDays, LayoutGrid, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlanningMonth } from './PlanningMonthContext';
import { getMissionColor, formatMonthLabel } from './planning-utils';
import { useToast } from '@/components/ui';

// ── Types ──────────────────────────────────────────────────────────────

interface CalBlock {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    suggestionStatus: string | null;
    notes: string | null;
    sdr: { id: string; name: string; email: string; role: string };
    mission: { id: string; name: string; channel: string; client: { id: string; name: string } };
    createdBy: { id: string; name: string };
}

interface CalTeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface CalMission {
    id: string;
    name: string;
    channel: string;
    client: { id: string; name: string };
    sdrAssignments: Array<{ sdr: { id: string; name: string } }>;
}

interface MonthlyData {
    month: string;
    daysInMonth: number;
    blocks: CalBlock[];
    blocksByDate: Record<string, CalBlock[]>;
    team: CalTeamMember[];
    missions: CalMission[];
}

const CHANNEL_ICONS: Record<string, typeof Phone> = { CALL: Phone, EMAIL: Mail, LINKEDIN: Linkedin };
const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_LABELS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

type CalendarView = 'month' | 'week';

// ── Main Component ─────────────────────────────────────────────────────

export function MonthCalendar() {
    const { month, setMonth } = usePlanningMonth();
    const { success, error: showError } = useToast();

    const [data, setData] = useState<MonthlyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [view, setView] = useState<CalendarView>('month');
    const [weekOffset, setWeekOffset] = useState(0);
    const [hoveredSdrId, setHoveredSdrId] = useState<string | null>(null);

    const fetchMonthly = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/planning/monthly?month=${month}`);
            const json = await res.json();
            if (json.success) setData(json.data);
            else showError('Erreur', json.error || 'Impossible de charger');
        } catch {
            showError('Erreur', 'Impossible de charger le calendrier');
        } finally {
            setLoading(false);
        }
    }, [month, showError]);

    useEffect(() => { fetchMonthly(); }, [fetchMonthly]);
    useEffect(() => { setWeekOffset(0); }, [month]);

    // ── Calendar grid cells for month view ──
    const calendarGrid = useMemo(() => {
        if (!data) return [];
        const [year, mon] = month.split('-').map(Number);
        const daysInMonth = data.daysInMonth;
        let startDow = new Date(year, mon - 1, 1).getDay() - 1;
        if (startDow < 0) startDow = 6;

        const cells: Array<{ date: string; day: number; isToday: boolean; isCurrentMonth: boolean }> = [];
        const prevMonthDays = new Date(year, mon - 1, 0).getDate();
        for (let i = startDow - 1; i >= 0; i--) {
            const d = prevMonthDays - i;
            const pm = mon - 1 <= 0 ? 12 : mon - 1;
            const py = mon - 1 <= 0 ? year - 1 : year;
            cells.push({ date: `${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isToday: false, isCurrentMonth: false });
        }
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push({ date: dateStr, day: d, isToday: dateStr === todayStr, isCurrentMonth: true });
        }
        const remaining = 7 - (cells.length % 7);
        if (remaining < 7) {
            for (let d = 1; d <= remaining; d++) {
                const nm = mon + 1 > 12 ? 1 : mon + 1;
                const ny = mon + 1 > 12 ? year + 1 : year;
                cells.push({ date: `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isToday: false, isCurrentMonth: false });
            }
        }
        return cells;
    }, [data, month]);

    const weeks = useMemo(() => {
        const result: typeof calendarGrid[] = [];
        for (let i = 0; i < calendarGrid.length; i += 7) {
            result.push(calendarGrid.slice(i, i + 7));
        }
        return result;
    }, [calendarGrid]);

    // ── Week view data ──
    const currentWeek = useMemo(() => {
        const [year, mon] = month.split('-').map(Number);
        const firstOfMonth = new Date(year, mon - 1, 1);
        let startDow = firstOfMonth.getDay() - 1;
        if (startDow < 0) startDow = 6;
        const firstMonday = new Date(firstOfMonth);
        firstMonday.setDate(firstMonday.getDate() - startDow + weekOffset * 7);

        const days: Array<{ date: Date; dateStr: string; isToday: boolean; isCurrentMonth: boolean }> = [];
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        for (let i = 0; i < 7; i++) {
            const d = new Date(firstMonday);
            d.setDate(d.getDate() + i);
            const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            days.push({ date: d, dateStr: ds, isToday: ds === todayStr, isCurrentMonth: d.getMonth() + 1 === mon && d.getFullYear() === year });
        }
        return days;
    }, [month, weekOffset]);

    const weekLabel = useMemo(() => {
        if (currentWeek.length === 0) return '';
        const s = currentWeek[0].date;
        const e = currentWeek[6].date;
        return `${s.getDate()} ${s.toLocaleDateString('fr-FR', { month: 'short' })} – ${e.getDate()} ${e.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
    }, [currentWeek]);

    const selectedBlocks = useMemo(() => {
        if (!selectedDate || !data) return [];
        return data.blocksByDate[selectedDate] ?? [];
    }, [selectedDate, data]);

    // ── Unique SDRs with blocks this week for week view rows ──
    const weekSdrs = useMemo(() => {
        if (!data) return [];
        const sdrMap = new Map<string, CalTeamMember>();
        for (const day of currentWeek) {
            const blocks = data.blocksByDate[day.dateStr] ?? [];
            for (const b of blocks) {
                if (!sdrMap.has(b.sdr.id)) sdrMap.set(b.sdr.id, b.sdr);
            }
        }
        for (const t of data.team) {
            if (!sdrMap.has(t.id)) sdrMap.set(t.id, t);
        }
        return [...sdrMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [data, currentWeek]);

    function prevNav() {
        if (view === 'week') {
            setWeekOffset(weekOffset - 1);
        } else {
            const [y, m] = month.split('-').map(Number);
            const d = new Date(y, m - 2, 1);
            setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
    }

    function nextNav() {
        if (view === 'week') {
            setWeekOffset(weekOffset + 1);
        } else {
            const [y, m] = month.split('-').map(Number);
            const d = new Date(y, m, 1);
            setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
    }

    function goToToday() {
        const now = new Date();
        setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
        setWeekOffset(0);
    }

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-white">
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
                <div className="flex items-center gap-2">
                    <button onClick={prevNav} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-sm font-bold text-slate-800 capitalize min-w-[200px] text-center">
                        {view === 'month' ? formatMonthLabel(month) : weekLabel}
                    </h2>
                    <button onClick={nextNav} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                    <button
                        onClick={goToToday}
                        className="ml-2 px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                        Aujourd&apos;hui
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{data?.blocks.length ?? 0}</span> créneaux
                        <span className="text-slate-300 mx-1">·</span>
                        <span className="font-semibold text-slate-700">{data?.team.length ?? 0}</span> SDRs
                    </div>
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setView('month')}
                            className={cn(
                                'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                                view === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                            )}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" /> Mois
                        </button>
                        <button
                            onClick={() => setView('week')}
                            className={cn(
                                'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                                view === 'week' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                            )}
                        >
                            <CalendarDays className="w-3.5 h-3.5" /> Semaine
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Calendar area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {view === 'month' ? (
                        <MonthView
                            weeks={weeks}
                            data={data}
                            selectedDate={selectedDate}
                            onSelectDate={(d) => setSelectedDate(selectedDate === d ? null : d)}
                        />
                    ) : (
                        <WeekView
                            days={currentWeek}
                            data={data}
                            sdrs={weekSdrs}
                            selectedDate={selectedDate}
                            onSelectDate={(d) => setSelectedDate(selectedDate === d ? null : d)}
                            hoveredSdrId={hoveredSdrId}
                            setHoveredSdrId={setHoveredSdrId}
                        />
                    )}
                </div>

                {/* Day detail sidebar */}
                <div className={cn(
                    'border-l border-slate-200 bg-white flex flex-col transition-all duration-300 overflow-hidden flex-shrink-0',
                    selectedDate ? 'w-[380px]' : 'w-0',
                )}>
                    {selectedDate && (
                        <DaySidebar
                            date={selectedDate}
                            blocks={selectedBlocks}
                            team={data?.team ?? []}
                            missions={data?.missions ?? []}
                            onClose={() => setSelectedDate(null)}
                            showAddForm={showAddForm}
                            setShowAddForm={setShowAddForm}
                            onReload={fetchMonthly}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Month View ────────────────────────────────────────────────────────

function MonthView({
    weeks, data, selectedDate, onSelectDate,
}: {
    weeks: Array<Array<{ date: string; day: number; isToday: boolean; isCurrentMonth: boolean }>>;
    data: MonthlyData | null;
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
}) {
    return (
        <>
            {/* Day labels */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 flex-shrink-0">
                {DAY_LABELS.map((label, i) => (
                    <div key={label} className={cn(
                        'text-center text-[11px] font-semibold uppercase tracking-wider py-2.5',
                        i >= 5 ? 'text-slate-400' : 'text-slate-600',
                    )}>
                        {label}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto">
                <div className="grid h-full" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(120px, 1fr))` }}>
                    {weeks.map((week, wi) => (
                        <div key={wi} className="grid grid-cols-7 border-b border-slate-100">
                            {week.map((cell, ci) => {
                                const dateBlocks = cell.date ? (data?.blocksByDate[cell.date] ?? []) : [];
                                const isSelected = selectedDate === cell.date;
                                const isWeekend = ci >= 5;

                                const sdrGroups = new Map<string, CalBlock[]>();
                                for (const b of dateBlocks) {
                                    if (!sdrGroups.has(b.sdr.id)) sdrGroups.set(b.sdr.id, []);
                                    sdrGroups.get(b.sdr.id)!.push(b);
                                }

                                return (
                                    <button
                                        key={ci}
                                        type="button"
                                        onClick={() => cell.isCurrentMonth && onSelectDate(cell.date)}
                                        className={cn(
                                            'relative text-left p-2 border-r border-slate-100 last:border-r-0 transition-colors group',
                                            cell.isCurrentMonth ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/30',
                                            isSelected && 'bg-indigo-50/80 ring-2 ring-inset ring-indigo-400',
                                            isWeekend && cell.isCurrentMonth && 'bg-slate-50/50',
                                        )}
                                    >
                                        {/* Day number */}
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className={cn(
                                                'text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors',
                                                cell.isToday && 'bg-indigo-600 text-white shadow-sm',
                                                !cell.isToday && cell.isCurrentMonth && 'text-slate-800',
                                                !cell.isToday && !cell.isCurrentMonth && 'text-slate-300',
                                            )}>
                                                {cell.day}
                                            </span>
                                            {cell.isCurrentMonth && dateBlocks.length === 0 && (
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-indigo-100">
                                                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                                                </span>
                                            )}
                                            {dateBlocks.length > 0 && (
                                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                                                    {dateBlocks.length}
                                                </span>
                                            )}
                                        </div>

                                        {/* Block chips — grouped by SDR */}
                                        <div className="space-y-0.5 overflow-hidden">
                                            {[...sdrGroups.entries()].slice(0, 3).map(([sdrId, blocks]) => {
                                                const first = blocks[0];
                                                const color = getMissionColor(first.mission.id);
                                                return (
                                                    <div
                                                        key={sdrId}
                                                        className="flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] truncate"
                                                        style={{ backgroundColor: color.hex + '15', borderLeft: `3px solid ${color.hex}` }}
                                                    >
                                                        <span className="font-bold truncate" style={{ color: color.hex }}>
                                                            {first.sdr.name.split(' ')[0]}
                                                        </span>
                                                        {blocks.length > 1 ? (
                                                            <span className="text-slate-400 truncate">{blocks.length} missions</span>
                                                        ) : (
                                                            <span className="text-slate-400 truncate">{first.mission.name}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {sdrGroups.size > 3 && (
                                                <p className="text-[9px] text-indigo-400 font-semibold pl-2">+{sdrGroups.size - 3} autres</p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

// ── Week View ─────────────────────────────────────────────────────────

function WeekView({
    days, data, sdrs, selectedDate, onSelectDate, hoveredSdrId, setHoveredSdrId,
}: {
    days: Array<{ date: Date; dateStr: string; isToday: boolean; isCurrentMonth: boolean }>;
    data: MonthlyData | null;
    sdrs: CalTeamMember[];
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
    hoveredSdrId: string | null;
    setHoveredSdrId: (id: string | null) => void;
}) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Day header row */}
            <div className="grid flex-shrink-0 border-b border-slate-200 bg-slate-50/80" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
                <div className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200 flex items-center">
                    SDR
                </div>
                {days.map((day, i) => (
                    <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => onSelectDate(day.dateStr)}
                        className={cn(
                            'px-2 py-3 text-center border-r border-slate-200 last:border-r-0 transition-colors',
                            selectedDate === day.dateStr && 'bg-indigo-50',
                            day.isToday && 'bg-indigo-50/60',
                            i >= 5 && 'bg-slate-100/40',
                        )}
                    >
                        <div className="text-[10px] font-semibold text-slate-500 uppercase">{DAY_LABELS_SHORT[i]}</div>
                        <div className={cn(
                            'text-lg font-bold mt-0.5 w-8 h-8 mx-auto flex items-center justify-center rounded-full',
                            day.isToday ? 'bg-indigo-600 text-white' : day.isCurrentMonth ? 'text-slate-800' : 'text-slate-300',
                        )}>
                            {day.date.getDate()}
                        </div>
                    </button>
                ))}
            </div>

            {/* SDR rows */}
            <div className="flex-1 overflow-y-auto">
                {sdrs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        Aucun SDR cette semaine
                    </div>
                ) : (
                    sdrs.map((sdr) => {
                        const isHighlighted = hoveredSdrId === sdr.id;
                        return (
                            <div
                                key={sdr.id}
                                className={cn(
                                    'grid border-b border-slate-100 transition-colors',
                                    isHighlighted && 'bg-indigo-50/30',
                                )}
                                style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
                                onMouseEnter={() => setHoveredSdrId(sdr.id)}
                                onMouseLeave={() => setHoveredSdrId(null)}
                            >
                                {/* SDR name cell */}
                                <div className="px-3 py-2 border-r border-slate-200 flex items-start gap-2 min-h-[72px]">
                                    <UserCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-slate-800 truncate">{sdr.name}</p>
                                        <p className="text-[10px] text-slate-400">{sdr.role === 'SDR' ? 'SDR' : 'BD'}</p>
                                    </div>
                                </div>

                                {/* Day cells */}
                                {days.map((day, di) => {
                                    const dayBlocks = (data?.blocksByDate[day.dateStr] ?? []).filter(b => b.sdr.id === sdr.id);
                                    const isWeekend = di >= 5;
                                    return (
                                        <button
                                            key={day.dateStr}
                                            type="button"
                                            onClick={() => onSelectDate(day.dateStr)}
                                            className={cn(
                                                'px-1.5 py-1.5 border-r border-slate-100 last:border-r-0 text-left transition-colors group min-h-[72px]',
                                                selectedDate === day.dateStr && 'bg-indigo-50/60',
                                                isWeekend && 'bg-slate-50/40',
                                                dayBlocks.length === 0 && 'hover:bg-slate-50',
                                            )}
                                        >
                                            {dayBlocks.length === 0 && (
                                                <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Plus className="w-4 h-4 text-slate-300" />
                                                </div>
                                            )}
                                            <div className="space-y-1">
                                                {dayBlocks.map((block) => {
                                                    const color = getMissionColor(block.mission.id);
                                                    const Icon = CHANNEL_ICONS[block.mission.channel] || Phone;
                                                    return (
                                                        <div
                                                            key={block.id}
                                                            className="rounded-lg px-2 py-1.5 text-[10px] leading-tight border shadow-sm"
                                                            style={{
                                                                backgroundColor: color.hex + '10',
                                                                borderColor: color.hex + '40',
                                                                borderLeftWidth: '3px',
                                                                borderLeftColor: color.hex,
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-1">
                                                                <Icon className="w-3 h-3 flex-shrink-0" style={{ color: color.hex }} />
                                                                <span className="font-bold truncate" style={{ color: color.hex }}>
                                                                    {block.mission.name}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1 text-slate-400 mt-0.5">
                                                                <Clock className="w-2.5 h-2.5" />
                                                                <span>{block.startTime}–{block.endTime}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ── Day Sidebar ────────────────────────────────────────────────────────

function DaySidebar({
    date, blocks, team, missions, onClose, showAddForm, setShowAddForm, onReload,
}: {
    date: string;
    blocks: CalBlock[];
    team: CalTeamMember[];
    missions: CalMission[];
    onClose: () => void;
    showAddForm: boolean;
    setShowAddForm: (v: boolean) => void;
    onReload: () => Promise<void>;
}) {
    const { success, error: showError } = useToast();
    const dateObj = new Date(date + 'T12:00:00');
    const dayLabel = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    const [cancelling, setCancelling] = useState<string | null>(null);

    async function handleCancel(blockId: string) {
        setCancelling(blockId);
        try {
            const res = await fetch(`/api/planning/${blockId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'CANCELLED' }),
            });
            const json = await res.json();
            if (json.success) {
                success('Créneau annulé', '');
                await onReload();
            } else {
                showError('Erreur', json.error || "Impossible d'annuler");
            }
        } catch {
            showError('Erreur', 'Une erreur est survenue');
        } finally {
            setCancelling(null);
        }
    }

    const sdrGroups = useMemo(() => {
        const map = new Map<string, { sdr: CalBlock['sdr']; blocks: CalBlock[] }>();
        for (const b of blocks) {
            if (!map.has(b.sdr.id)) map.set(b.sdr.id, { sdr: b.sdr, blocks: [] });
            map.get(b.sdr.id)!.blocks.push(b);
        }
        return [...map.values()];
    }, [blocks]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex-shrink-0">
                <div>
                    <h3 className="text-sm font-bold text-slate-800 capitalize">{dayLabel}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                        {blocks.length} créneau{blocks.length !== 1 ? 'x' : ''}
                        {sdrGroups.length > 0 && <> · {sdrGroups.length} SDR{sdrGroups.length > 1 ? 's' : ''}</>}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className={cn(
                            'p-2 rounded-lg transition-colors',
                            showAddForm ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-500'
                        )}
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Add form */}
            {showAddForm && (
                <AddBlockForm
                    date={date}
                    team={team}
                    missions={missions}
                    onCreated={async () => { setShowAddForm(false); await onReload(); }}
                    onCancel={() => setShowAddForm(false)}
                />
            )}

            {/* Block list grouped by SDR */}
            <div className="flex-1 overflow-y-auto">
                {blocks.length === 0 && !showAddForm && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <CalendarDays className="w-10 h-10 mb-3 text-slate-200" />
                        <p className="text-sm font-medium text-slate-500">Aucun créneau</p>
                        <p className="text-xs mt-1 text-slate-400">Cliquez + pour planifier un créneau.</p>
                    </div>
                )}

                {sdrGroups.map(({ sdr, blocks: sdrBlocks }) => (
                    <div key={sdr.id} className="border-b border-slate-100">
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50/60">
                            <UserCircle className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold text-slate-700">{sdr.name}</span>
                            <span className="text-[10px] text-slate-400">{sdrBlocks.length} créneau{sdrBlocks.length > 1 ? 'x' : ''}</span>
                        </div>
                        <div className="px-3 py-2 space-y-2">
                            {sdrBlocks.map((block) => {
                                const color = getMissionColor(block.mission.id);
                                const Icon = CHANNEL_ICONS[block.mission.channel] || Phone;
                                return (
                                    <div
                                        key={block.id}
                                        className="rounded-xl p-3 border transition-shadow hover:shadow-sm"
                                        style={{ borderColor: color.hex + '40', borderLeftWidth: '4px', borderLeftColor: color.hex }}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={cn('w-5 h-5 rounded-md flex items-center justify-center', color.bg)}>
                                                        <Icon className={cn('w-3 h-3', color.text)} />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-800 truncate">{block.mission.name}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-0.5 ml-6">{block.mission.client.name}</p>
                                            </div>
                                            <button
                                                onClick={() => handleCancel(block.id)}
                                                disabled={cancelling === block.id}
                                                className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50 flex-shrink-0"
                                                title="Annuler"
                                            >
                                                {cancelling === block.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 ml-6 text-[11px]">
                                            <div className="flex items-center gap-1 text-slate-500">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                <span className="font-medium">{block.startTime} – {block.endTime}</span>
                                            </div>
                                            {block.suggestionStatus && (
                                                <span className={cn(
                                                    'inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                                                    block.suggestionStatus === 'CONFIRMED' && 'bg-emerald-50 text-emerald-700',
                                                    block.suggestionStatus === 'SUGGESTED' && 'bg-amber-50 text-amber-700',
                                                )}>
                                                    {block.suggestionStatus === 'CONFIRMED' && <><Check className="w-2.5 h-2.5" /> Confirmé</>}
                                                    {block.suggestionStatus === 'SUGGESTED' && 'Suggestion'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Add Block Form ─────────────────────────────────────────────────────

function AddBlockForm({
    date, team, missions, onCreated, onCancel,
}: {
    date: string;
    team: CalTeamMember[];
    missions: CalMission[];
    onCreated: () => Promise<void>;
    onCancel: () => void;
}) {
    const { success, error: showError } = useToast();
    const [sdrId, setSdrId] = useState('');
    const [missionId, setMissionId] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('12:00');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!sdrId || !missionId) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/planning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sdrId, missionId, date, startTime, endTime }),
            });
            const json = await res.json();
            if (json.success) {
                success('Créneau créé', `${startTime}–${endTime}`);
                await onCreated();
            } else {
                showError('Erreur', json.error || 'Impossible de créer le créneau');
            }
        } catch {
            showError('Erreur', 'Une erreur est survenue');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="border-b border-slate-200 px-4 py-3 space-y-3 bg-indigo-50/30 flex-shrink-0">
            <p className="text-xs font-bold text-slate-700">Nouveau créneau</p>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">SDR</label>
                    <select
                        value={sdrId}
                        onChange={(e) => setSdrId(e.target.value)}
                        className="mt-0.5 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                        required
                    >
                        <option value="">Sélectionner...</option>
                        {team.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Mission</label>
                    <select
                        value={missionId}
                        onChange={(e) => setMissionId(e.target.value)}
                        className="mt-0.5 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                        required
                    >
                        <option value="">Sélectionner...</option>
                        {missions.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Début</label>
                    <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="mt-0.5 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                        required
                    />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fin</label>
                    <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="mt-0.5 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                        required
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
                <button
                    type="submit"
                    disabled={submitting || !sdrId || !missionId}
                    className="flex-1 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Créer le créneau
                </button>
                <button type="button" onClick={onCancel} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 font-medium">
                    Annuler
                </button>
            </div>
        </form>
    );
}
