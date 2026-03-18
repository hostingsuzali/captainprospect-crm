'use client';

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from 'react';
import type { DragEvent, MutableRefObject } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Clock,
    UserCircle,
    Loader2,
    Check,
    Phone,
    Mail,
    Linkedin,
    CalendarDays,
    LayoutGrid,
    Trash2,
    Users,
    Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    usePlanningMonth,
    type SnapshotMission,
    type SnapshotSdr,
} from './PlanningMonthContext';
import {
    calcHours,
    getMissionColor,
    formatMonthLabel,
    getSdrStatus,
    SDR_STATUS_CONFIG,
} from './planning-utils';
import { useToast, Tooltip } from '@/components/ui';

interface CalBlock {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    suggestionStatus: string | null;
    notes: string | null;
    sdrId: string;
    missionId: string;
    allocationId: string | null;
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

interface MonthlyData {
    month: string;
    daysInMonth: number;
    blocks: CalBlock[];
    blocksByDate: Record<string, CalBlock[]>;
    team: CalTeamMember[];
    missions: SnapshotMission[];
    sdrs: SnapshotSdr[];
}

interface QuickAddCell {
    sdrId: string;
    date: string;
}

interface DragState {
    blockId: string;
    sourceSdrId: string;
    sourceDate: string;
    block: CalBlock;
}

interface CellPosition {
    top: number;
    left: number;
}

interface WeekDay {
    date: Date;
    dateStr: string;
    isToday: boolean;
    isCurrentMonth: boolean;
}

interface MonthCell {
    date: string;
    day: number;
    isToday: boolean;
    isCurrentMonth: boolean;
}

interface MissionOption {
    mission: SnapshotMission;
    allocationId: string | null;
}

type CalendarView = 'month' | 'week';

const CHANNEL_ICONS: Record<string, typeof Phone> = { CALL: Phone, EMAIL: Mail, LINKEDIN: Linkedin };
const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_LABELS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY_CELL_CAPACITY = 1;
const HOURS_PER_DAY = 8;

export function MonthCalendar() {
    const { month, setMonth, snapshot, assignSdrToMission } = usePlanningMonth();
    const { success, error: showError } = useToast();

    const [data, setData] = useState<MonthlyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [view, setView] = useState<CalendarView>('month');
    const [weekOffset, setWeekOffset] = useState(0);
    const [hoveredSdrId, setHoveredSdrId] = useState<string | null>(null);
    const [highlightedSdrId, setHighlightedSdrId] = useState<string | null>(null);
    const [loadDrawerOpen, setLoadDrawerOpen] = useState(false);
    const [quickAddCell, setQuickAddCell] = useState<QuickAddCell | null>(null);
    const [quickAddPosition, setQuickAddPosition] = useState<CellPosition | null>(null);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [dragOverCell, setDragOverCell] = useState<QuickAddCell | null>(null);
    const [dragOverTrash, setDragOverTrash] = useState(false);
    const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);

    const quickAddRef = useRef<HTMLDivElement | null>(null);
    const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const fetchMonthly = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/planning/month?month=${month}`);
            const json = await res.json();
            if (json.success) {
                setData(normalizeMonthlyData(json.data as MonthlyData));
            }
            else showError('Erreur', json.error || 'Impossible de charger');
        } catch {
            showError('Erreur', 'Impossible de charger le calendrier');
        } finally {
            setLoading(false);
        }
    }, [month, showError]);

    useEffect(() => {
        void fetchMonthly();
    }, [fetchMonthly]);

    useEffect(() => {
        setWeekOffset(0);
        setSelectedDate(null);
        setShowAddForm(false);
        setQuickAddCell(null);
        setQuickAddPosition(null);
    }, [month]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!quickAddRef.current) return;
            if (quickAddRef.current.contains(event.target as Node)) return;
            setQuickAddCell(null);
            setQuickAddPosition(null);
        };

        if (quickAddCell) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [quickAddCell]);

    const weekScrollKey = useMemo(() => currentWeekKey(view, weekOffset, month), [view, weekOffset, month]);

    useEffect(() => {
        if (view !== 'week' || !highlightedSdrId) return;
        const timeout = window.setTimeout(() => {
            rowRefs.current[highlightedSdrId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        return () => window.clearTimeout(timeout);
    }, [highlightedSdrId, view, weekScrollKey]);

    const calendarGrid = useMemo(() => {
        if (!data) return [];
        const [year, mon] = month.split('-').map(Number);
        let startDow = new Date(year, mon - 1, 1).getDay() - 1;
        if (startDow < 0) startDow = 6;

        const cells: MonthCell[] = [];
        const prevMonthDays = new Date(year, mon - 1, 0).getDate();
        for (let i = startDow - 1; i >= 0; i--) {
            const d = prevMonthDays - i;
            const pm = mon - 1 <= 0 ? 12 : mon - 1;
            const py = mon - 1 <= 0 ? year - 1 : year;
            cells.push({
                date: `${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                day: d,
                isToday: false,
                isCurrentMonth: false,
            });
        }

        const today = new Date();
        const todayStr = toDateString(today);
        for (let d = 1; d <= data.daysInMonth; d++) {
            const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push({ date: dateStr, day: d, isToday: dateStr === todayStr, isCurrentMonth: true });
        }

        const remaining = 7 - (cells.length % 7);
        if (remaining < 7) {
            for (let d = 1; d <= remaining; d++) {
                const nm = mon + 1 > 12 ? 1 : mon + 1;
                const ny = mon + 1 > 12 ? year + 1 : year;
                cells.push({
                    date: `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                    day: d,
                    isToday: false,
                    isCurrentMonth: false,
                });
            }
        }

        return cells;
    }, [data, month]);

    const weeks = useMemo(() => {
        const result: MonthCell[][] = [];
        for (let i = 0; i < calendarGrid.length; i += 7) {
            result.push(calendarGrid.slice(i, i + 7));
        }
        return result;
    }, [calendarGrid]);

    const currentWeek = useMemo(() => {
        const [year, mon] = month.split('-').map(Number);
        const firstOfMonth = new Date(year, mon - 1, 1);
        let startDow = firstOfMonth.getDay() - 1;
        if (startDow < 0) startDow = 6;
        const firstMonday = new Date(firstOfMonth);
        firstMonday.setDate(firstMonday.getDate() - startDow + weekOffset * 7);

        const days: WeekDay[] = [];
        const todayStr = toDateString(new Date());

        for (let i = 0; i < 7; i++) {
            const date = new Date(firstMonday);
            date.setDate(date.getDate() + i);
            const dateStr = toDateString(date);
            days.push({
                date,
                dateStr,
                isToday: dateStr === todayStr,
                isCurrentMonth: date.getMonth() + 1 === mon && date.getFullYear() === year,
            });
        }

        return days;
    }, [month, weekOffset]);

    const weekLabel = useMemo(() => {
        if (currentWeek.length === 0) return '';
        const start = currentWeek[0].date;
        const end = currentWeek[6].date;
        return `${start.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'short' })} – ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
    }, [currentWeek]);

    const selectedBlocks = useMemo(() => {
        if (!selectedDate || !data) return [];
        return data.blocksByDate[selectedDate] ?? [];
    }, [selectedDate, data]);

    const weekSdrs = useMemo(() => {
        if (!data) return [];
        return [...data.team].sort((a, b) => a.name.localeCompare(b.name));
    }, [data]);

    const capacitySdrs = useMemo(() => snapshot?.sdrs ?? data?.sdrs ?? [], [snapshot?.sdrs, data?.sdrs]);

    const teamLoadByDate = useMemo(() => {
        const entries: Record<string, number> = {};
        const sdrCountWithCapacity = capacitySdrs.filter((sdr) => getMonthlyCapacity(sdr) > 0).length;
        for (const day of currentWeek) {
            const blocks = data?.blocksByDate[day.dateStr] ?? [];
            const totalUnits = blocks.reduce((sum, block) => sum + getBlockDayUnits(block), 0);
            entries[day.dateStr] = sdrCountWithCapacity > 0 ? Math.round((totalUnits / sdrCountWithCapacity) * 100) : 0;
        }
        return entries;
    }, [capacitySdrs, currentWeek, data]);

    const openQuickAdd = useCallback((cell: QuickAddCell, target: HTMLElement) => {
        const rect = target.getBoundingClientRect();
        const popoverWidth = 320;
        const popoverHeight = 260;
        const margin = 12;
        let left = rect.left;
        let top = rect.bottom + 8;

        if (left + popoverWidth > window.innerWidth - margin) {
            left = window.innerWidth - popoverWidth - margin;
        }
        if (top + popoverHeight > window.innerHeight - margin) {
            top = Math.max(margin, rect.top - popoverHeight - 8);
        }

        setQuickAddCell(cell);
        setQuickAddPosition({ top, left: Math.max(margin, left) });
    }, []);

    const closeQuickAdd = useCallback(() => {
        setQuickAddCell(null);
        setQuickAddPosition(null);
    }, []);

    const handleBlockMove = useCallback(async (blockId: string, newDate: string, newSdrId: string) => {
        if (!dragState || !data) return;
        const sourceBlock = dragState.block;
        if (sourceBlock.sdr.id === newSdrId && sourceBlock.date === newDate) {
            setDragState(null);
            setDragOverCell(null);
            return;
        }

        const previousData = data;
        setData((prev) => {
            if (!prev) return prev;
            const blocks = prev.blocks.map((block) =>
                block.id === blockId
                    ? {
                        ...block,
                        date: newDate,
                        sdrId: newSdrId,
                        sdr: {
                            ...block.sdr,
                            id: newSdrId,
                            name: prev.team.find((member) => member.id === newSdrId)?.name ?? block.sdr.name,
                            email: prev.team.find((member) => member.id === newSdrId)?.email ?? block.sdr.email,
                            role: prev.team.find((member) => member.id === newSdrId)?.role ?? block.sdr.role,
                        },
                    }
                    : block,
            );
            return { ...prev, blocks, blocksByDate: groupBlocksByDate(blocks) };
        });
        setDragState(null);
        setDragOverCell(null);

        try {
            if (sourceBlock.sdr.id === newSdrId) {
                const res = await fetch(`/api/planning/${blockId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: newDate }),
                });
                const json = await res.json();
                if (!json.success) {
                    showError('Erreur', json.error || 'Déplacement échoué');
                    setData(previousData);
                    await fetchMonthly();
                }
                return;
            }

            const targetMission = data.missions.find((mission) => mission.id === sourceBlock.mission.id);
            const isAssigned = targetMission?.sdrAssignments.some((assignment) => assignment.sdr.id === newSdrId) ?? false;
            if (!isAssigned) {
                const ok = await assignSdrToMission(sourceBlock.mission.id, newSdrId);
                if (!ok) {
                    setData(previousData);
                    await fetchMonthly();
                    return;
                }
            }

            const allocationId = findAllocationIdForMission(data.missions, month, sourceBlock.mission.id, newSdrId);
            const createRes = await fetch('/api/planning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sdrId: newSdrId,
                    missionId: sourceBlock.mission.id,
                    date: newDate,
                    startTime: sourceBlock.startTime,
                    endTime: sourceBlock.endTime,
                    ...(allocationId ? { allocationId } : {}),
                }),
            });
            const createJson = await createRes.json();
            if (!createJson.success) {
                showError('Erreur', createJson.error || 'Déplacement échoué');
                setData(previousData);
                await fetchMonthly();
                return;
            }

            const cancelRes = await fetch(`/api/planning/${blockId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'CANCELLED' }),
            });
            const cancelJson = await cancelRes.json();
            if (!cancelJson.success) {
                showError('Erreur', cancelJson.error || 'Déplacement échoué');
            }

            await fetchMonthly();
        } catch {
            showError('Erreur', 'Déplacement échoué');
            setData(previousData);
            await fetchMonthly();
        }
    }, [assignSdrToMission, data, dragState, fetchMonthly, month, showError]);

    const handleDeleteBlock = useCallback(async (blockId: string) => {
        if (deletingBlockId) return;
        setDragState(null);
        setDragOverCell(null);
        setDragOverTrash(false);
        setDeletingBlockId(blockId);

        try {
            const res = await fetch(`/api/planning/${blockId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'CANCELLED' }),
            });
            const json = await res.json();
            if (!json.success) {
                showError('Erreur', json.error || 'Suppression échouée');
                return;
            }
            success('Créneau supprimé', '');
        } catch {
            showError('Erreur', 'Suppression échouée');
        } finally {
            await fetchMonthly();
            setDeletingBlockId(null);
        }
    }, [deletingBlockId, fetchMonthly, showError, success]);

    function prevNav() {
        if (view === 'week') {
            setWeekOffset((current) => current - 1);
            return;
        }
        const [year, mon] = month.split('-').map(Number);
        const date = new Date(year, mon - 2, 1);
        setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }

    function nextNav() {
        if (view === 'week') {
            setWeekOffset((current) => current + 1);
            return;
        }
        const [year, mon] = month.split('-').map(Number);
        const date = new Date(year, mon, 1);
        setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }

    function goToToday() {
        const now = new Date();
        setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
        setWeekOffset(0);
    }

    function handleDrawerRowClick(sdrId: string) {
        setView('week');
        setHighlightedSdrId(sdrId);
    }

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex overflow-hidden bg-white">
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
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

                        <button
                            onClick={() => setLoadDrawerOpen((open) => !open)}
                            className={cn(
                                'inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                                loadDrawerOpen
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                            )}
                        >
                            <Users className="w-4 h-4" />
                            Charge équipe
                        </button>

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

                <div className="flex-1 min-h-0 flex overflow-hidden">
                    <div className="flex-1 min-w-0 flex overflow-hidden">
                        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                            {view === 'month' ? (
                                <MonthView
                                    weeks={weeks}
                                    data={data}
                                    onOpenQuickAdd={openQuickAdd}
                                    onOpenDayDetails={(date) => {
                                        setSelectedDate(date);
                                        setShowAddForm(false);
                                        setView('week');
                                    }}
                                />
                            ) : (
                                <WeekView
                                    days={currentWeek}
                                    data={data}
                                    sdrs={weekSdrs}
                                    selectedDate={selectedDate}
                                    onSelectDate={(date) => setSelectedDate((current) => current === date ? null : date)}
                                    hoveredSdrId={hoveredSdrId}
                                    highlightedSdrId={highlightedSdrId}
                                    dragState={dragState}
                                    dragOverCell={dragOverCell}
                                    teamLoadByDate={teamLoadByDate}
                                    onSetHoveredSdrId={setHoveredSdrId}
                                    onSetDragState={setDragState}
                                    onSetDragOverCell={setDragOverCell}
                                    onOpenQuickAdd={openQuickAdd}
                                    onMoveBlock={handleBlockMove}
                                    rowRefs={rowRefs}
                                    onSetDragOverTrash={setDragOverTrash}
                                    deletingBlockId={deletingBlockId}
                                />
                            )}
                        </div>

                        {view === 'week' && (
                            <div
                                className={cn(
                                    'border-l border-slate-200 bg-white flex flex-col transition-all duration-300 overflow-hidden flex-shrink-0',
                                    selectedDate ? 'w-[380px]' : 'w-0',
                                )}
                            >
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
                        )}
                    </div>
                </div>
            </div>

            {loadDrawerOpen && (
                <LoadDrawer
                    month={month}
                    sdrs={capacitySdrs}
                    highlightedSdrId={highlightedSdrId}
                    onSelectSdr={handleDrawerRowClick}
                />
            )}

            {quickAddCell && quickAddPosition && data && (
                <QuickAddPopover
                    ref={quickAddRef}
                    cell={quickAddCell}
                    position={quickAddPosition}
                    team={data.team}
                    missions={data.missions}
                    month={month}
                    onClose={closeQuickAdd}
                    onCreated={async () => {
                        closeQuickAdd();
                        await fetchMonthly();
                    }}
                    assignSdrToMission={assignSdrToMission}
                />
            )}

            {view === 'week' && dragState && (
                <TrashDropZone
                    isOver={dragOverTrash}
                    isDeleting={!!deletingBlockId}
                    onDragOver={(event) => {
                        if (deletingBlockId) return;
                        event.preventDefault();
                        setDragOverTrash(true);
                    }}
                    onDragLeave={() => setDragOverTrash(false)}
                    onDrop={(event) => {
                        event.preventDefault();
                        if (!dragState || deletingBlockId) return;
                        void handleDeleteBlock(dragState.blockId);
                    }}
                />
            )}
        </div>
    );
}

function MonthView({
    weeks,
    data,
    onOpenQuickAdd,
    onOpenDayDetails,
}: {
    weeks: MonthCell[][];
    data: MonthlyData | null;
    onOpenQuickAdd: (cell: QuickAddCell, target: HTMLElement) => void;
    onOpenDayDetails: (date: string) => void;
}) {
    return (
        <>
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 flex-shrink-0">
                {DAY_LABELS.map((label, index) => (
                    <div
                        key={label}
                        className={cn(
                            'text-center text-[11px] font-semibold uppercase tracking-wider py-2.5',
                            index >= 5 ? 'text-slate-400' : 'text-slate-600',
                        )}
                    >
                        {label}
                    </div>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="grid h-full" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(120px, 1fr))` }}>
                    {weeks.map((week, weekIndex) => (
                        <div key={weekIndex} className="grid grid-cols-7 border-b border-slate-100">
                            {week.map((cell, cellIndex) => {
                                const cellDateKey = normalizeDateKey(cell.date);
                                const dateBlocks = data?.blocksByDate[cellDateKey]
                                    ?? data?.blocks.filter((block) => {
                                        const blockDateKey = normalizeDateKey(String(block.date).slice(0, 10));
                                        return blockDateKey === cellDateKey;
                                    })
                                    ?? [];
                                const segments = buildMonthSegments(dateBlocks);
                                const isWeekend = cellIndex >= 5;

                                return (
                                    <button
                                        key={cell.date}
                                        type="button"
                                        onClick={(event) => {
                                            if (!cell.isCurrentMonth) return;
                                            if (dateBlocks.length > 0) {
                                                onOpenDayDetails(cellDateKey);
                                                return;
                                            }
                                            onOpenQuickAdd({ sdrId: '', date: cellDateKey }, event.currentTarget);
                                        }}
                                        className={cn(
                                            'relative text-left px-3 py-2 border-r border-slate-100 last:border-r-0 transition-colors group',
                                            cell.isCurrentMonth ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/30',
                                            isWeekend && cell.isCurrentMonth && 'bg-slate-50/40',
                                        )}
                                        title={cell.isCurrentMonth ? `Planifier le ${cellDateKey}` : undefined}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span
                                                className={cn(
                                                    'text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors',
                                                    cell.isToday && 'bg-indigo-600 text-white shadow-sm',
                                                    !cell.isToday && cell.isCurrentMonth && 'text-slate-800',
                                                    !cell.isToday && !cell.isCurrentMonth && 'text-slate-300',
                                                )}
                                            >
                                                {cell.day}
                                            </span>

                                            {dateBlocks.length > 0 ? (
                                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                                                    {dateBlocks.length}
                                                </span>
                                            ) : (
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-indigo-400">
                                                    <Plus className="w-3.5 h-3.5" />
                                                </span>
                                            )}
                                        </div>

                                        <div className="border-t border-slate-100 pt-3">
                                            <div className="bg-slate-100 rounded-full overflow-hidden flex" style={{ height: '6px', width: '100%' }}>
                                                {segments.length === 0 ? (
                                                    <div style={{ width: '100%', height: '100%' }} />
                                                ) : (
                                                    segments.map((segment) => (
                                                        <Tooltip
                                                            key={segment.block.id}
                                                            content={
                                                                <div className="text-xs">
                                                                    <p className="font-semibold text-white">{segment.block.sdr.name}</p>
                                                                    <p>{segment.block.mission.name}</p>
                                                                    <p className="text-slate-200">{segment.block.startTime}–{segment.block.endTime}</p>
                                                                </div>
                                                            }
                                                            position="top"
                                                        >
                                                            <div
                                                                className="transition-opacity hover:opacity-80"
                                                                style={{
                                                                    width: `${segment.width}%`,
                                                                    height: '100%',
                                                                    display: 'inline-block',
                                                                    backgroundColor: segment.color.hex,
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    ))
                                                )}
                                            </div>
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

function WeekView({
    days,
    data,
    sdrs,
    selectedDate,
    onSelectDate,
    hoveredSdrId,
    highlightedSdrId,
    dragState,
    dragOverCell,
    teamLoadByDate,
    onSetHoveredSdrId,
    onSetDragState,
    onSetDragOverCell,
    onOpenQuickAdd,
    onMoveBlock,
    rowRefs,
    onSetDragOverTrash,
    deletingBlockId,
}: {
    days: WeekDay[];
    data: MonthlyData | null;
    sdrs: CalTeamMember[];
    selectedDate: string | null;
    hoveredSdrId: string | null;
    highlightedSdrId: string | null;
    dragState: DragState | null;
    dragOverCell: QuickAddCell | null;
    teamLoadByDate: Record<string, number>;
    onSelectDate: (date: string) => void;
    onSetHoveredSdrId: (id: string | null) => void;
    onSetDragState: (state: DragState | null) => void;
    onSetDragOverCell: (cell: QuickAddCell | null) => void;
    onOpenQuickAdd: (cell: QuickAddCell, target: HTMLElement) => void;
    onMoveBlock: (blockId: string, newDate: string, newSdrId: string) => Promise<void>;
    rowRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
    onSetDragOverTrash: (active: boolean) => void;
    deletingBlockId: string | null;
}) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="grid flex-shrink-0 border-b border-slate-200 bg-slate-50/80" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
                <div className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200 flex items-center">
                    SDR
                </div>
                {days.map((day, index) => (
                    <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => onSelectDate(day.dateStr)}
                        className={cn(
                            'px-2 py-3 text-center border-r border-slate-200 last:border-r-0 transition-colors',
                            selectedDate === day.dateStr && 'bg-indigo-50',
                            day.isToday && 'bg-indigo-50/60',
                            index >= 5 && 'bg-slate-100/40',
                        )}
                    >
                        <div className="text-[10px] font-semibold text-slate-500 uppercase">{DAY_LABELS_SHORT[index]}</div>
                        <div
                            className={cn(
                                'text-lg font-bold mt-0.5 w-8 h-8 mx-auto flex items-center justify-center rounded-full',
                                day.isToday ? 'bg-indigo-600 text-white' : day.isCurrentMonth ? 'text-slate-800' : 'text-slate-300',
                            )}
                        >
                            {day.date.getDate()}
                        </div>
                    </button>
                ))}
            </div>

            <div className="grid flex-shrink-0 border-b border-slate-200 bg-white" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
                <div className="px-3 py-3 border-r border-slate-200 flex items-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Team load
                </div>
                {days.map((day) => {
                    const pct = teamLoadByDate[day.dateStr] ?? 0;
                    const barClass = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500';
                    return (
                        <div key={day.dateStr} className="px-2 py-3 border-r border-slate-100 last:border-r-0">
                            <div className="h-6 rounded-full bg-slate-100 overflow-hidden relative">
                                <div className={cn('h-full transition-all', barClass)} style={{ width: `${Math.min(pct, 100)}%` }} />
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-slate-700">
                                    {pct}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex-1 overflow-y-auto">
                {sdrs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        Aucun SDR cette semaine
                    </div>
                ) : (
                    sdrs.map((sdr) => {
                        const isHovered = hoveredSdrId === sdr.id;
                        const isHighlighted = highlightedSdrId === sdr.id;

                        return (
                            <div
                                key={sdr.id}
                                ref={(node) => {
                                    rowRefs.current[sdr.id] = node;
                                }}
                                className={cn(
                                    'grid border-b border-slate-100 transition-colors',
                                    isHighlighted && 'bg-indigo-50/50',
                                    isHovered && !isHighlighted && 'bg-slate-50/70',
                                )}
                                style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
                                onMouseEnter={() => onSetHoveredSdrId(sdr.id)}
                                onMouseLeave={() => onSetHoveredSdrId(null)}
                            >
                                <div className="px-3 py-2 border-r border-slate-200 flex items-start gap-2 min-h-[92px]">
                                    <UserCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-slate-800 truncate">{sdr.name}</p>
                                        <p className="text-[10px] text-slate-400">{sdr.role === 'SDR' ? 'SDR' : 'BD'}</p>
                                    </div>
                                </div>

                                {days.map((day, index) => {
                                    const dayBlocks = (data?.blocksByDate[day.dateStr] ?? [])
                                        .filter((block) => block.sdr.id === sdr.id)
                                        .sort((a, b) => a.startTime.localeCompare(b.startTime));
                                    const usedCapacity = dayBlocks.reduce((sum, block) => sum + getBlockDayUnits(block), 0);
                                    const remainingCapacity = Math.max(0, DAY_CELL_CAPACITY - usedCapacity);
                                    const isWeekend = index >= 5;
                                    const isDropTarget = dragOverCell?.sdrId === sdr.id && dragOverCell.date === day.dateStr;

                                    return (
                                        <button
                                            key={day.dateStr}
                                            type="button"
                                            onClick={(event) => {
                                                if (dayBlocks.length > 0) return;
                                                onOpenQuickAdd({ sdrId: sdr.id, date: day.dateStr }, event.currentTarget);
                                            }}
                                            onDragOver={(event) => {
                                                if (deletingBlockId) return;
                                                event.preventDefault();
                                                if (!dragState) return;
                                                onSetDragOverCell({ sdrId: sdr.id, date: day.dateStr });
                                            }}
                                            onDragLeave={() => {
                                                onSetDragOverCell(null);
                                            }}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                if (!dragState || deletingBlockId) return;
                                                void onMoveBlock(dragState.blockId, day.dateStr, sdr.id);
                                            }}
                                            className={cn(
                                                'px-2 py-2 border-r border-slate-100 last:border-r-0 text-left transition-colors min-h-[92px] flex flex-col justify-between',
                                                isWeekend && 'bg-slate-50/40',
                                                dayBlocks.length === 0 && 'hover:bg-slate-50',
                                                isDropTarget && 'bg-indigo-50 ring-1 ring-inset ring-indigo-300',
                                            )}
                                        >
                                            <div className="space-y-1">
                                                {dayBlocks.length === 0 && (
                                                    <div className="h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 text-slate-300" />
                                                )}

                                                {dayBlocks.map((block) => {
                                                    const color = getMissionColor(block.mission.id);
                                                    const Icon = CHANNEL_ICONS[block.mission.channel] || Phone;
                                                    const isDeleting = deletingBlockId === block.id;
                                                    return (
                                                        <div
                                                            key={block.id}
                                                            draggable={!isDeleting && !deletingBlockId}
                                                            onDragStart={(event: DragEvent<HTMLDivElement>) => {
                                                                if (isDeleting || deletingBlockId) {
                                                                    event.preventDefault();
                                                                    return;
                                                                }
                                                                event.dataTransfer.effectAllowed = 'move';
                                                                onSetDragState({
                                                                    blockId: block.id,
                                                                    sourceSdrId: block.sdr.id,
                                                                    sourceDate: block.date,
                                                                    block,
                                                                });
                                                            }}
                                                            onDragEnd={() => {
                                                                onSetDragState(null);
                                                                onSetDragOverCell(null);
                                                                onSetDragOverTrash(false);
                                                            }}
                                                            className={cn(
                                                                'rounded-lg px-2 py-1.5 text-[10px] leading-tight border shadow-sm cursor-move',
                                                                dragState?.blockId === block.id && 'opacity-60',
                                                                isDeleting && 'opacity-50 cursor-not-allowed',
                                                            )}
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
                                                            {isDeleting && (
                                                                <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-red-600">
                                                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                                                    Suppression...
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="pt-2 text-[10px] text-slate-500 flex items-center justify-between">
                                                {remainingCapacity > 0 ? (
                                                    <span>{formatDayValue(remainingCapacity)} libre</span>
                                                ) : usedCapacity > 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-slate-400">
                                                        <Lock className="w-3 h-3" />
                                                    </span>
                                                ) : (
                                                    <span />
                                                )}

                                                {dayBlocks.length === 0 && (
                                                    <Plus className="w-3.5 h-3.5 text-slate-300" />
                                                )}
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

function TrashDropZone({
    isOver,
    isDeleting,
    onDragOver,
    onDragLeave,
    onDrop,
}: {
    isOver: boolean;
    isDeleting: boolean;
    onDragOver: (event: DragEvent<HTMLDivElement>) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
    return (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center pointer-events-none">
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                    'pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 shadow-lg transition-all',
                    isDeleting && 'opacity-90',
                    isOver
                        ? 'bg-red-600 border-red-600 text-white scale-105'
                        : 'bg-white border-red-200 text-red-600',
                )}
            >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span className="text-xs font-semibold">
                    {isDeleting ? 'Suppression en cours...' : isOver ? 'Relâchez pour supprimer' : 'Glissez ici pour supprimer'}
                </span>
            </div>
        </div>
    );
}

interface QuickAddPopoverProps {
    cell: QuickAddCell;
    position: CellPosition;
    team: CalTeamMember[];
    missions: SnapshotMission[];
    month: string;
    onClose: () => void;
    onCreated: () => Promise<void>;
    assignSdrToMission: (missionId: string, sdrId: string) => Promise<boolean>;
}

const QuickAddPopover = forwardRef<HTMLDivElement, QuickAddPopoverProps>(function QuickAddPopover(
    {
        cell,
        position,
        team,
        missions,
        month,
        onClose,
        onCreated,
        assignSdrToMission,
    },
    ref,
) {
    const { success, error: showError } = useToast();
    const [sdrId, setSdrId] = useState(cell.sdrId);
    const [missionId, setMissionId] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('12:00');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setSdrId(cell.sdrId);
        setMissionId('');
    }, [cell]);

    const missionOptions = useMemo(() => {
        if (!sdrId) {
            return {
                allocated: [] as MissionOption[],
                others: missions.map((mission) => ({ mission, allocationId: null })),
            };
        }

        const allocated: MissionOption[] = [];
        const others: MissionOption[] = [];

        for (const mission of missions) {
            const allocationId = findAllocationIdForMission([mission], month, mission.id, sdrId);
            if (allocationId) {
                allocated.push({ mission, allocationId });
            } else {
                others.push({ mission, allocationId: null });
            }
        }

        return { allocated, others };
    }, [missions, month, sdrId]);

    useEffect(() => {
        if (!missionId) return;
        const exists = [...missionOptions.allocated, ...missionOptions.others].some((entry) => entry.mission.id === missionId);
        if (!exists) setMissionId('');
    }, [missionId, missionOptions]);

    const selectedSdr = team.find((member) => member.id === sdrId);
    const selectedMission = [...missionOptions.allocated, ...missionOptions.others].find((entry) => entry.mission.id === missionId);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!sdrId || !missionId) return;

        setSubmitting(true);
        try {
            const isAssigned = selectedMission?.mission.sdrAssignments.some((assignment) => assignment.sdr.id === sdrId) ?? false;
            if (!isAssigned) {
                const ok = await assignSdrToMission(missionId, sdrId);
                if (!ok) {
                    setSubmitting(false);
                    return;
                }
            }

            const res = await fetch('/api/planning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sdrId,
                    missionId,
                    date: cell.date,
                    startTime,
                    endTime,
                    ...(selectedMission?.allocationId ? { allocationId: selectedMission.allocationId } : {}),
                }),
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
        <div
            ref={ref}
            className="fixed z-40 w-[320px] rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ top: position.top, left: position.left }}
        >
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Nouveau créneau</p>
                        <p className="text-xs text-slate-500 mt-1">
                            {formatFullDate(cell.date)}
                            {selectedSdr && <> · {selectedSdr.name}</>}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {!cell.sdrId && (
                    <div>
                        <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">SDR</label>
                        <select
                            value={sdrId}
                            onChange={(event) => setSdrId(event.target.value)}
                            className="mt-1 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                            required
                        >
                            <option value="">Sélectionner...</option>
                            {team.map((member) => (
                                <option key={member.id} value={member.id}>{member.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Mission</label>
                    <select
                        value={missionId}
                        onChange={(event) => setMissionId(event.target.value)}
                        className="mt-1 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                        required
                        disabled={!sdrId}
                    >
                        <option value="">Sélectionner...</option>
                        {missionOptions.allocated.length > 0 && (
                            <optgroup label="Missions allouées">
                                {missionOptions.allocated.map((entry) => (
                                    <option key={entry.mission.id} value={entry.mission.id}>
                                        {entry.mission.name}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                        {missionOptions.others.length > 0 && (
                            <optgroup label="Autres missions">
                                {missionOptions.others.map((entry) => (
                                    <option key={entry.mission.id} value={entry.mission.id}>
                                        {entry.mission.name}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Début</label>
                        <input
                            type="time"
                            value={startTime}
                            onChange={(event) => setStartTime(event.target.value)}
                            className="mt-1 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fin</label>
                        <input
                            type="time"
                            value={endTime}
                            onChange={(event) => setEndTime(event.target.value)}
                            className="mt-1 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                            required
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 font-medium">
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || !sdrId || !missionId}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Créer
                    </button>
                </div>
            </form>
        </div>
    );
});

function LoadDrawer({
    month,
    sdrs,
    highlightedSdrId,
    onSelectSdr,
}: {
    month: string;
    sdrs: SnapshotSdr[];
    highlightedSdrId: string | null;
    onSelectSdr: (sdrId: string) => void;
}) {
    return (
        <div className="w-[280px] flex-shrink-0 border-l border-slate-200 bg-white">
            <div className="px-4 py-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">Charge équipe — {formatMonthLabel(month)}</h3>
            </div>

            <div className="overflow-y-auto h-full px-3 py-3 space-y-2">
                {sdrs.map((sdr) => {
                    const capacity = getMonthlyCapacity(sdr);
                    const allocated = sdr.sdrDayAllocations.reduce((sum, allocation) => sum + allocation.allocatedDays, 0);
                    const pct = capacity > 0 ? Math.round((allocated / capacity) * 100) : 0;
                    const status = getSdrStatus(allocated, capacity);
                    const barClass =
                        status === 'overloaded'
                            ? 'bg-red-500'
                            : status === 'near'
                                ? 'bg-amber-500'
                                : status === 'optimal'
                                    ? 'bg-emerald-500'
                                    : 'bg-blue-500';

                    return (
                        <button
                            key={sdr.id}
                            type="button"
                            onClick={() => onSelectSdr(sdr.id)}
                            className={cn(
                                'w-full text-left p-3 rounded-xl border transition-colors',
                                highlightedSdrId === sdr.id
                                    ? 'border-indigo-300 bg-indigo-50'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                            )}
                        >
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-sm font-medium text-slate-800 truncate">{sdr.name}</span>
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', SDR_STATUS_CONFIG[status].className)}>
                                    {pct}%
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div className={cn('h-full transition-all', barClass)} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                                <span>{allocated}/{capacity}j</span>
                                {pct >= 100 && <span className="text-amber-600 font-semibold">⚠</span>}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}


function DaySidebar({
    date,
    blocks,
    team,
    missions,
    onClose,
    showAddForm,
    setShowAddForm,
    onReload,
}: {
    date: string;
    blocks: CalBlock[];
    team: CalTeamMember[];
    missions: SnapshotMission[];
    onClose: () => void;
    showAddForm: boolean;
    setShowAddForm: (value: boolean) => void;
    onReload: () => Promise<void>;
}) {
    const { success, error: showError } = useToast();
    const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

    const [cancelling, setCancelling] = useState<string | null>(null);
    const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);

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
            setPendingCancelId(null);
        }
    }

    const sdrGroups = useMemo(() => {
        const groups = new Map<string, { sdr: CalBlock['sdr']; blocks: CalBlock[] }>();
        for (const block of blocks) {
            if (!groups.has(block.sdr.id)) groups.set(block.sdr.id, { sdr: block.sdr, blocks: [] });
            groups.get(block.sdr.id)?.blocks.push(block);
        }
        return [...groups.values()];
    }, [blocks]);

    return (
        <div className="flex flex-col h-full">
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
                            showAddForm ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-500',
                        )}
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {showAddForm && (
                <AddBlockForm
                    date={date}
                    team={team}
                    missions={missions}
                    onCreated={async () => {
                        setShowAddForm(false);
                        await onReload();
                    }}
                    onCancel={() => setShowAddForm(false)}
                />
            )}

            <div className="flex-1 overflow-y-auto">
                {blocks.length === 0 && !showAddForm && (
                    <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className="flex flex-col items-center justify-center py-16 text-slate-400 w-full hover:bg-slate-50 transition-colors"
                    >
                        <CalendarDays className="w-10 h-10 mb-3 text-slate-200" />
                        <p className="text-sm font-medium text-slate-500">Aucun créneau</p>
                        <p className="text-xs mt-1 text-slate-400 underline">
                            Cliquez ici pour planifier un créneau.
                        </p>
                    </button>
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
                                                onClick={() => {
                                                    if (pendingCancelId === block.id) {
                                                        void handleCancel(block.id);
                                                    } else {
                                                        setPendingCancelId(block.id);
                                                    }
                                                }}
                                                disabled={cancelling === block.id}
                                                className={cn(
                                                    'p-1 rounded-lg flex-shrink-0 transition-colors',
                                                    pendingCancelId === block.id
                                                        ? 'bg-red-50 text-red-600'
                                                        : 'text-slate-300 hover:text-red-500 hover:bg-red-50',
                                                )}
                                                title={pendingCancelId === block.id ? 'Confirmer ?' : 'Annuler'}
                                            >
                                                {cancelling === block.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 ml-6 text-[11px]">
                                            <div className="flex items-center gap-1 text-slate-500">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                <span className="font-medium">{block.startTime} – {block.endTime}</span>
                                            </div>
                                            {block.suggestionStatus && (
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                                                        block.suggestionStatus === 'CONFIRMED' && 'bg-emerald-50 text-emerald-700',
                                                        block.suggestionStatus === 'SUGGESTED' && 'bg-amber-50 text-amber-700',
                                                    )}
                                                >
                                                    {block.suggestionStatus === 'CONFIRMED' && (
                                                        <>
                                                            <Check className="w-2.5 h-2.5" /> Confirmé
                                                        </>
                                                    )}
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

                {blocks.length > 0 && !showAddForm && (
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 text-[11px] text-slate-600">
                        Pour planifier automatiquement plusieurs jours sur une mission, utilisez l&apos;affectation dans la carte mission.
                    </div>
                )}
            </div>
        </div>
    );
}

function AddBlockForm({
    date,
    team,
    missions,
    onCreated,
    onCancel,
}: {
    date: string;
    team: CalTeamMember[];
    missions: SnapshotMission[];
    onCreated: () => Promise<void>;
    onCancel: () => void;
}) {
    const { success, error: showError } = useToast();
    const [sdrId, setSdrId] = useState('');
    const [missionId, setMissionId] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('12:00');
    const [submitting, setSubmitting] = useState(false);

    const filteredMissions = missions;

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
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
                        onChange={(event) => setSdrId(event.target.value)}
                        className="mt-0.5 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                        required
                    >
                        <option value="">Sélectionner...</option>
                        {team.map((member) => (
                            <option key={member.id} value={member.id}>{member.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Mission</label>
                    <select
                        value={missionId}
                        onChange={(event) => setMissionId(event.target.value)}
                        className="mt-0.5 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                        required
                    >
                        <option value="">Sélectionner...</option>
                        {filteredMissions.map((mission) => (
                            <option key={mission.id} value={mission.id}>{mission.name}</option>
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
                        onChange={(event) => setStartTime(event.target.value)}
                        className="mt-0.5 w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none"
                        required
                    />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fin</label>
                    <input
                        type="time"
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
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

function groupBlocksByDate(blocks: CalBlock[]): Record<string, CalBlock[]> {
    const grouped: Record<string, CalBlock[]> = {};
    for (const block of blocks) {
        const key = block.date;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(block);
    }
    return grouped;
}

function getBlockDayUnits(block: Pick<CalBlock, 'startTime' | 'endTime'>): number {
    const hours = calcHours(block.startTime, block.endTime);
    if (hours <= 0) return 0;
    return hours / HOURS_PER_DAY;
}

function buildMonthSegments(blocks: CalBlock[]) {
    if (blocks.length === 0) return [];
    const total = blocks.length;
    return blocks.map((block) => {
        const color = getMissionColor(block.mission.id);
        const width = total > 0 ? (1 / total) * 100 : 0;
        return { block, color, width };
    });
}

function getMonthlyCapacity(sdr: SnapshotSdr): number {
    return sdr.sdrMonthCapacities[0]?.effectiveAvailableDays ?? 0;
}

function findAllocationIdForMission(
    missions: SnapshotMission[],
    month: string,
    missionId: string,
    sdrId: string,
): string | null {
    const mission = missions.find((entry) => entry.id === missionId);
    const plan = mission?.missionMonthPlans.find((entry) => entry.month === month);
    return plan?.allocations.find((allocation) => allocation.sdrId === sdrId)?.id ?? null;
}

function formatDayValue(value: number): string {
    if (Number.isInteger(value)) return `${value}j`;
    return `${value.toFixed(1).replace('.', ',')}j`;
}

function formatFullDate(date: string): string {
    return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
}

function normalizeDateKey(dateKey: string): string {
    const [year, month, day] = dateKey.split('-');
    if (!year || !month || !day) return dateKey;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normalizeMonthlyData(payload: MonthlyData): MonthlyData {
    const normalizedByDate: Record<string, CalBlock[]> = {};
    for (const [rawKey, blocks] of Object.entries(payload.blocksByDate ?? {})) {
        const normalizedKey = normalizeDateKey(rawKey).slice(0, 10);
        normalizedByDate[normalizedKey] = blocks;
    }
    return {
        ...payload,
        blocksByDate: normalizedByDate,
    };
}

function toDateString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currentWeekKey(view: CalendarView, weekOffset: number, month: string): string {
    return `${view}:${month}:${weekOffset}`;
}
