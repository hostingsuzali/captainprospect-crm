'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Calendar, UserCircle, ArrowRight, Plus, Pencil, Save, Trash2, Loader2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlanningMonth, type SnapshotSdr } from './PlanningMonthContext';
import { getMissionColor, getSdrStatus, SDR_STATUS_CONFIG } from './planning-utils';
import { useToast } from '@/components/ui';

const ABSENCE_TYPE_LABELS: Record<string, string> = {
    VACATION: 'Congés', SICK: 'Maladie', TRAINING: 'Formation', PUBLIC_HOLIDAY: 'Jour férié', PARTIAL: 'Partiel',
};
const ABSENCE_TYPE_COLORS: Record<string, string> = {
    VACATION: 'bg-blue-100 text-blue-700', SICK: 'bg-red-100 text-red-700', TRAINING: 'bg-purple-100 text-purple-700',
    PUBLIC_HOLIDAY: 'bg-slate-100 text-slate-700', PARTIAL: 'bg-orange-100 text-orange-700',
};

interface SdrRowProps {
    sdr: SnapshotSdr;
}

export function SdrRow({ sdr }: SdrRowProps) {
    const {
        hoveredMissionId, setHoveredSdrId, focusedSdrId, setFocusedSdrId, snapshot, month, reload, setDrawerOpen,
    } = usePlanningMonth();
    const { success, error: showError } = useToast();

    const sdrConflicts = useMemo(() => {
        const list = snapshot?.conflicts?.filter((c) => c.sdrId === sdr.id && c.month === month) ?? [];
        return { P0: list.filter((c) => c.severity === 'P0'), P1: list.filter((c) => c.severity === 'P1'), P2: list.filter((c) => c.severity === 'P2') };
    }, [snapshot?.conflicts, sdr.id, month]);

    const [expanded, setExpanded] = useState(false);
    const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
    const rowRef = useRef<HTMLDivElement>(null);

    // Capacity editing
    const [editingCapacity, setEditingCapacity] = useState(false);
    const [capBaseVal, setCapBaseVal] = useState(0);
    const [savingCapacity, setSavingCapacity] = useState(false);

    // Absence management
    const [showAddAbsence, setShowAddAbsence] = useState(false);
    const [newAbsence, setNewAbsence] = useState({ startDate: '', endDate: '', type: 'VACATION', impactsPlanning: true });
    const [addingAbsence, setAddingAbsence] = useState(false);
    const [deletingAbsId, setDeletingAbsId] = useState<string | null>(null);

    const capacity = sdr.sdrMonthCapacities[0];
    const effectiveAvail = capacity?.effectiveAvailableDays ?? 0;
    const baseWorking = capacity?.baseWorkingDays ?? 0;
    const hasCapacity = !!capacity;

    const allocations = sdr.sdrDayAllocations;
    const totalAllocated = allocations.reduce((s, a) => s + a.allocatedDays, 0);
    const status = getSdrStatus(totalAllocated, effectiveAvail);
    const statusCfg = SDR_STATUS_CONFIG[status];
    const loadPct = effectiveAvail > 0 ? Math.round((totalAllocated / effectiveAvail) * 100) : 0;
    const blocksBySdrMission = snapshot?.blocksBySdrMission ?? {};

    const allocatedMissionIds = new Set(allocations.map((a) => a.missionMonthPlan.mission.id));
    const isHighlightedByMission = hoveredMissionId !== null && allocatedMissionIds.has(hoveredMissionId);

    useEffect(() => {
        if (focusedSdrId === sdr.id) {
            setExpanded(true);
            rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            const timer = setTimeout(() => setFocusedSdrId(null), 2000);
            return () => clearTimeout(timer);
        }
    }, [focusedSdrId, sdr.id, setFocusedSdrId]);

    const isFocused = focusedSdrId === sdr.id;

    const segments = allocations.map((alloc) => {
        const missionId = alloc.missionMonthPlan.mission.id;
        const missionName = alloc.missionMonthPlan.mission.name;
        const color = getMissionColor(missionId);
        const pct = effectiveAvail > 0 ? (alloc.allocatedDays / effectiveAvail) * 100 : 0;
        const blocksKey = `${sdr.id}::${missionId}`;
        const blocksPlaced = blocksBySdrMission[blocksKey] ?? 0;
        return { id: alloc.id, missionId, missionName, days: alloc.allocatedDays, pct, color, blocksPlaced, scheduledDays: alloc.scheduledDays };
    });

    const totalPct = segments.reduce((s, seg) => s + seg.pct, 0);

    const absences = sdr.sdrAbsences;
    const absenceDays = absences.reduce((s, a) => {
        const start = new Date(a.startDate);
        const end = new Date(a.endDate);
        return s + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }, 0);

    // Suggestions
    const suggestions: Array<{ text: string; type: 'reduce' | 'reassign' }> = [];
    if (status === 'overloaded' && allocations.length > 0) {
        const overflow = totalAllocated - effectiveAvail;
        const sorted = [...allocations].sort((a, b) => b.allocatedDays - a.allocatedDays);
        if (sorted.length > 0) {
            const largest = sorted[0];
            const reduceTo = Math.max(0, largest.allocatedDays - overflow);
            suggestions.push({
                text: `Réduire ${largest.missionMonthPlan.mission.name} de ${largest.allocatedDays}j à ${reduceTo}j (libère ${overflow}j)`,
                type: 'reduce',
            });
        }
        if (snapshot) {
            const otherSdrs = snapshot.sdrs
                .filter((s) => s.id !== sdr.id)
                .map((s) => {
                    const cap = s.sdrMonthCapacities[0]?.effectiveAvailableDays ?? 0;
                    const alloc = s.sdrDayAllocations.reduce((sum, a) => sum + a.allocatedDays, 0);
                    return { ...s, available: cap - alloc };
                })
                .filter((s) => s.available > 0)
                .sort((a, b) => b.available - a.available);

            if (otherSdrs.length > 0 && sorted.length > 0) {
                const best = otherSdrs[0];
                const missionToReassign = sorted[sorted.length > 1 ? 1 : 0].missionMonthPlan.mission.name;
                suggestions.push({
                    text: `Réaffecter ${missionToReassign} à ${best.name} (${best.available}j dispo)`,
                    type: 'reassign',
                });
            }
        }
    }
    if (status === 'underutilized' && effectiveAvail > 0) {
        suggestions.push({
            text: `${effectiveAvail - totalAllocated}j disponibles — peut prendre plus de missions`,
            type: 'reassign',
        });
    }

    // ── Capacity actions ─────────────────────────────────────────────
    async function handleSaveCapacity() {
        setSavingCapacity(true);
        setEditingCapacity(false);
        try {
            const res = await fetch('/api/sdr-capacity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sdrId: sdr.id, month, baseWorkingDays: capBaseVal }),
            });
            const json = await res.json();
            if (json.success) {
                reload();
            } else {
                showError('Erreur', json.error || 'Impossible de sauvegarder');
                setEditingCapacity(true);
            }
        } catch {
            showError('Erreur', 'Une erreur est survenue');
            setEditingCapacity(true);
        } finally {
            setSavingCapacity(false);
        }
    }

    async function handleAddAbsence() {
        if (!newAbsence.startDate || !newAbsence.endDate) return;
        setAddingAbsence(true);
        setShowAddAbsence(false);
        setNewAbsence({ startDate: '', endDate: '', type: 'VACATION', impactsPlanning: true });
        try {
            const res = await fetch('/api/sdr-absences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sdrId: sdr.id, ...newAbsence }),
            });
            const json = await res.json();
            if (json.success) {
                success('Absence ajoutée', '');
                reload();
            } else {
                showError('Erreur', json.error || "Impossible d'ajouter");
            }
        } catch {
            showError('Erreur', 'Une erreur est survenue');
        } finally {
            setAddingAbsence(false);
        }
    }

    async function handleDeleteAbsence(id: string) {
        setDeletingAbsId(id);
        try {
            await fetch(`/api/sdr-absences/${id}`, { method: 'DELETE' });
            reload();
        } finally {
            setDeletingAbsId(null);
        }
    }

    return (
        <div
            ref={rowRef}
            onMouseEnter={() => setHoveredSdrId(sdr.id)}
            onMouseLeave={() => setHoveredSdrId(null)}
            className={cn(
                'border rounded-xl transition-all duration-200 bg-white',
                isHighlightedByMission && 'ring-2 ring-indigo-300 border-indigo-200',
                isFocused && 'ring-2 ring-amber-400 border-amber-300',
                !isHighlightedByMission && !isFocused && 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
                status === 'overloaded' && 'border-l-4 border-l-red-400',
                status === 'underutilized' && 'border-l-4 border-l-blue-300',
            )}
        >
            <button type="button" onClick={() => setExpanded(!expanded)} className="w-full text-left p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                            {sdr.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">{sdr.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', statusCfg.className)}>
                                    {statusCfg.label}
                                </span>
                                {absenceDays > 0 && (
                                    <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full font-medium">
                                        {absenceDays}j abs.
                                    </span>
                                )}
                                {!hasCapacity && (
                                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                        <AlertTriangle className="w-2.5 h-2.5" /> Pas de capacité
                                    </span>
                                )}
                                {sdrConflicts.P0.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setDrawerOpen(true); }}
                                        className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200 hover:bg-red-100 transition-colors"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        {sdrConflicts.P0.length}
                                    </button>
                                )}
                                {sdrConflicts.P1.length > 0 && sdrConflicts.P0.length === 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setDrawerOpen(true); }}
                                        className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 hover:bg-amber-100 transition-colors"
                                    >
                                        <AlertCircle className="w-2.5 h-2.5" /> {sdrConflicts.P1.length}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={cn(
                            'text-sm font-bold tabular-nums',
                            loadPct > 100 ? 'text-red-600' : loadPct >= 85 ? 'text-amber-600' : 'text-slate-700'
                        )}>
                            {totalAllocated}/{effectiveAvail}j
                        </span>
                        <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', expanded && 'rotate-180')} />
                    </div>
                </div>

                {/* Stacked colored bar */}
                {effectiveAvail > 0 && (
                    <div className="mt-3 relative">
                        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex relative">
                            {segments.map((seg) => (
                                <div
                                    key={seg.id}
                                    onMouseEnter={(e) => { e.stopPropagation(); setHoveredSegment(seg.id); }}
                                    onMouseLeave={() => setHoveredSegment(null)}
                                    className={cn(
                                        'h-full transition-all cursor-pointer relative',
                                        hoveredMissionId === seg.missionId && 'brightness-110',
                                    )}
                                    style={{
                                        width: `${Math.min(seg.pct, 100)}%`,
                                        backgroundColor: seg.color.hex,
                                        opacity: hoveredSegment && hoveredSegment !== seg.id ? 0.4 : 1,
                                    }}
                                >
                                    {hoveredSegment === seg.id && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none">
                                            <p className="font-medium">{seg.missionName}</p>
                                            <p className="text-slate-300">{seg.days}j ({Math.round(seg.pct)}%) · {seg.blocksPlaced} blocs</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {totalPct > 100 && (
                                <div
                                    className="h-full absolute right-0 top-0"
                                    style={{
                                        width: `${Math.min(totalPct - 100, 30)}%`,
                                        background: 'repeating-linear-gradient(45deg, #f87171, #f87171 2px, #fca5a5 2px, #fca5a5 4px)',
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}
            </button>

            {/* Expanded state */}
            {expanded && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                    {/* Capacity / absence summary — editable */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-slate-50 rounded-lg px-2 py-1.5 relative group">
                            <p className="text-[10px] text-slate-500">Base</p>
                            {editingCapacity ? (
                                <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                    <input
                                        type="number"
                                        min={0}
                                        max={31}
                                        value={capBaseVal}
                                        onChange={(e) => setCapBaseVal(Math.max(0, Math.min(31, Number(e.target.value))))}
                                        className="w-10 text-center text-sm font-bold border border-indigo-300 rounded bg-white py-0.5"
                                        autoFocus
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCapacity(); if (e.key === 'Escape') setEditingCapacity(false); }}
                                    />
                                    <button onClick={handleSaveCapacity} disabled={savingCapacity} className="text-indigo-600 hover:text-indigo-800">
                                        {savingCapacity ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-1">
                                    <p className="text-sm font-bold text-slate-800">{hasCapacity ? `${baseWorking}j` : '—'}</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setCapBaseVal(baseWorking || 20); setEditingCapacity(true); }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600"
                                    >
                                        <Pencil className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 rounded-lg px-2 py-1.5">
                            <p className="text-[10px] text-slate-500">Absences</p>
                            <p className={cn('text-sm font-bold', absenceDays > 0 ? 'text-orange-600' : 'text-slate-400')}>{absenceDays}j</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg px-2 py-1.5">
                            <p className="text-[10px] text-slate-500">Dispo</p>
                            <p className="text-sm font-bold text-emerald-600">{effectiveAvail}j</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg px-2 py-1.5">
                            <p className="text-[10px] text-slate-500">Alloués</p>
                            <p className={cn('text-sm font-bold', totalAllocated > effectiveAvail ? 'text-red-600' : 'text-slate-800')}>{totalAllocated}j</p>
                        </div>
                    </div>

                    {/* No capacity CTA */}
                    {!hasCapacity && !editingCapacity && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                            <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                            <p className="text-xs font-medium text-slate-700">Capacité non définie</p>
                            <p className="text-[11px] text-slate-500 mb-2">Définissez les jours ouvrés de ce SDR pour ce mois.</p>
                            <button
                                onClick={() => { setCapBaseVal(20); setEditingCapacity(true); }}
                                className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                            >
                                Définir la capacité
                            </button>
                        </div>
                    )}

                    {/* Absence list with management */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Absences
                            </span>
                            <button
                                onClick={() => setShowAddAbsence(!showAddAbsence)}
                                className={cn(
                                    'text-[11px] font-medium flex items-center gap-0.5 px-2 py-0.5 rounded-lg transition-colors',
                                    showAddAbsence ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'
                                )}
                            >
                                <Plus className="w-3 h-3" /> Ajouter
                            </button>
                        </div>
                        {absences.length > 0 && (
                            <div className="space-y-1 mb-2">
                                {absences.map((abs) => (
                                    <div key={abs.id} className="flex items-center justify-between bg-orange-50/50 border border-orange-100 rounded-lg px-3 py-1.5">
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className={cn('px-1.5 py-0.5 rounded-full font-medium text-[10px]', ABSENCE_TYPE_COLORS[abs.type] || 'bg-slate-100 text-slate-600')}>
                                                {ABSENCE_TYPE_LABELS[abs.type] || abs.type}
                                            </span>
                                            <span className="text-slate-500">
                                                {new Date(abs.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                {abs.startDate !== abs.endDate && ` → ${new Date(abs.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteAbsence(abs.id)}
                                            disabled={deletingAbsId === abs.id}
                                            className="text-slate-300 hover:text-red-400 transition-colors"
                                        >
                                            {deletingAbsId === abs.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {absences.length === 0 && !showAddAbsence && (
                            <p className="text-[11px] text-slate-400 italic mb-2">Aucune absence</p>
                        )}

                        {/* Add absence inline form */}
                        {showAddAbsence && (
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 space-y-2 mb-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium">Début</label>
                                        <input
                                            type="date"
                                            value={newAbsence.startDate}
                                            onChange={(e) => setNewAbsence((p) => ({ ...p, startDate: e.target.value }))}
                                            className="mt-0.5 w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium">Fin</label>
                                        <input
                                            type="date"
                                            value={newAbsence.endDate}
                                            onChange={(e) => setNewAbsence((p) => ({ ...p, endDate: e.target.value }))}
                                            className="mt-0.5 w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium">Type</label>
                                        <select
                                            value={newAbsence.type}
                                            onChange={(e) => setNewAbsence((p) => ({ ...p, type: e.target.value }))}
                                            className="mt-0.5 w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                                        >
                                            {Object.entries(ABSENCE_TYPE_LABELS).map(([k, v]) => (
                                                <option key={k} value={k}>{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newAbsence.impactsPlanning}
                                                onChange={(e) => setNewAbsence((p) => ({ ...p, impactsPlanning: e.target.checked }))}
                                                className="rounded"
                                            />
                                            <span className="text-[11px] text-slate-600">Impacte planning</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleAddAbsence}
                                        disabled={addingAbsence || !newAbsence.startDate || !newAbsence.endDate}
                                        className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {addingAbsence ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                        Ajouter
                                    </button>
                                    <button onClick={() => setShowAddAbsence(false)} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700">
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mission breakdown */}
                    {allocations.length > 0 && (
                        <div className="border border-slate-100 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="text-left px-3 py-2 font-medium text-slate-500">Mission</th>
                                        <th className="text-center px-3 py-2 font-medium text-slate-500">Alloués</th>
                                        <th className="text-center px-3 py-2 font-medium text-slate-500">Blocs</th>
                                        <th className="text-center px-3 py-2 font-medium text-slate-500">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {segments.map((seg) => {
                                        const blocksOk = seg.blocksPlaced >= seg.days && seg.days > 0;
                                        const isInvisible = seg.scheduledDays === 0 && seg.days > 0;
                                        return (
                                            <React.Fragment key={seg.id}>
                                                <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                                                    <td className="px-3 py-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color.hex }} />
                                                            <span className="font-medium text-slate-700 truncate">{seg.missionName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-bold text-slate-700">{seg.days}j</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={cn('font-medium', blocksOk ? 'text-emerald-600' : seg.blocksPlaced === 0 ? 'text-red-500' : 'text-amber-600')}>
                                                            {seg.blocksPlaced}/{seg.days}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-slate-500">{Math.round(seg.pct)}%</td>
                                                </tr>
                                                {isInvisible && (
                                                    <tr className="border-b border-slate-50">
                                                        <td colSpan={4} className="px-3 py-1">
                                                            <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1" title="Aucun bloc posé — cet SDR ne verra pas cette mission dans son espace action">
                                                                <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                                                                <span className="font-medium">Mission invisible pour l&apos;SDR</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {allocations.length === 0 && (
                        <div className="text-center py-4 text-xs text-slate-400">
                            <UserCircle className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                            Aucune affectation ce mois
                        </div>
                    )}

                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                        <div className="space-y-1.5">
                            {suggestions.map((s, i) => (
                                <div key={i} className={cn(
                                    'rounded-lg px-3 py-2 text-xs flex items-start gap-2',
                                    s.type === 'reduce' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                                )}>
                                    <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    <span>{s.text}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* P2 conflict info notes */}
                    {sdrConflicts.P2.length > 0 && (
                        <div className="space-y-1">
                            {sdrConflicts.P2.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setDrawerOpen(true); }}
                                    className="w-full text-left flex items-start gap-2 rounded-lg px-3 py-2 bg-blue-50 border border-blue-200 text-[11px] text-blue-700 hover:bg-blue-100 transition-colors"
                                >
                                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                    <span>{c.message}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
