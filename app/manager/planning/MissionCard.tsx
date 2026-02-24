'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Plus, Minus, Loader2, Phone, Mail, Linkedin, AlertTriangle, CheckCircle2, Pencil, Save, Crown, Calendar, Clock, Info } from 'lucide-react';
import { useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { usePlanningMonth, type SnapshotMission, type MonthAllocation } from './PlanningMonthContext';
import { getMissionColor, formatMonthShort, formatMonth } from './planning-utils';

const CHANNEL_ICONS: Record<string, typeof Phone> = { CALL: Phone, EMAIL: Mail, LINKEDIN: Linkedin };

interface MissionCardProps {
    mission: SnapshotMission;
}

export function MissionCard({ mission }: MissionCardProps) {
    const {
        month, hoveredSdrId, setHoveredMissionId, focusedMissionId, setFocusedMissionId,
        setAssignModalMissionId, updateAllocation, snapshot, setDrawerOpen,
        createMonthPlan, updateMonthPlan, updateMonthPlanWorkingDays, setMonth, reload,
    } = usePlanningMonth();

    const missionConflicts = useMemo(() => {
        const list = snapshot?.conflicts?.filter((c) => c.missionId === mission.id && c.month === month) ?? [];
        return { P0: list.filter((c) => c.severity === 'P0'), P1: list.filter((c) => c.severity === 'P1'), P2: list.filter((c) => c.severity === 'P2') };
    }, [snapshot?.conflicts, mission.id, month]);
    const { error: showError } = useToast();

    const [expanded, setExpanded] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const color = getMissionColor(mission.id);
    const [savingTeamLead, setSavingTeamLead] = useState(false);

    const currentPlan = mission.missionMonthPlans.find((p) => p.month === month);
    const targetDays = currentPlan?.targetDays ?? 0;
    const allocatedDays = currentPlan?.allocations.reduce((s, a) => s + a.allocatedDays, 0) ?? 0;
    const scheduledDays = currentPlan?.allocations.reduce((s, a) => s + a.scheduledDays, 0) ?? 0;
    const gap = targetDays - allocatedDays;
    const hasPlan = !!currentPlan;

    const blocksBySdrMission = snapshot?.blocksBySdrMission ?? {};

    const assignedSdrIds = new Set(currentPlan?.allocations.map((a) => a.sdrId) ?? []);
    const isHighlightedBySdr = hoveredSdrId !== null && assignedSdrIds.has(hoveredSdrId);

    // Create plan state
    const [creatingPlan, setCreatingPlan] = useState(false);
    const [newTargetDays, setNewTargetDays] = useState(18);
    const [savingPlan, setSavingPlan] = useState(false);

    // Edit target days state
    const [editingTarget, setEditingTarget] = useState(false);
    const [editTargetVal, setEditTargetVal] = useState(targetDays);

    // Working days derived state
    const currentWorkingDays = useMemo(() => {
        const wd = currentPlan?.workingDays;
        if (!wd) return new Set<number>();
        return new Set(wd.split(',').map(Number).filter(Boolean));
    }, [currentPlan?.workingDays]);
    const currentStartTime = currentPlan?.defaultStartTime || '09:00';
    const currentEndTime = currentPlan?.defaultEndTime || '17:00';

    const workingDayCount = useMemo(() => {
        if (currentWorkingDays.size === 0) return 0;
        const [yr, mo] = month.split('-').map(Number);
        const daysInMonth = new Date(yr, mo, 0).getDate();
        let count = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(yr, mo - 1, d);
            const dow = date.getDay() === 0 ? 7 : date.getDay();
            if (currentWorkingDays.has(dow)) count++;
        }
        return count;
    }, [currentWorkingDays, month]);

    useEffect(() => {
        if (focusedMissionId === mission.id) {
            setExpanded(true);
            cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            const timer = setTimeout(() => setFocusedMissionId(null), 2000);
            return () => clearTimeout(timer);
        }
    }, [focusedMissionId, mission.id, setFocusedMissionId]);

    const isFocused = focusedMissionId === mission.id;
    const pctAllocated = targetDays > 0 ? Math.min(1, allocatedDays / targetDays) : 0;
    const pctOverflow = targetDays > 0 && allocatedDays > targetDays ? (allocatedDays - targetDays) / targetDays : 0;

    const Icon = CHANNEL_ICONS[mission.channel] || Phone;
    const dateRange = `${new Date(mission.startDate).toLocaleDateString('fr-FR', { month: 'short' })} → ${new Date(mission.endDate).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}`;

    async function handleCreatePlan() {
        setSavingPlan(true);
        setCreatingPlan(false);
        setExpanded(true);
        const ok = await createMonthPlan(mission.id, newTargetDays);
        setSavingPlan(false);
        if (!ok) setCreatingPlan(true);
    }

    async function handleSaveTarget() {
        if (!currentPlan || editTargetVal === targetDays) {
            setEditingTarget(false);
            return;
        }
        setEditingTarget(false);
        await updateMonthPlan(currentPlan.id, editTargetVal);
    }

    function handleToggleWorkingDay(day: number) {
        if (!currentPlan) return;
        const newSet = new Set(currentWorkingDays);
        if (newSet.has(day)) newSet.delete(day);
        else newSet.add(day);
        const wdStr = newSet.size > 0 ? [...newSet].sort((a, b) => a - b).join(',') : null;
        updateMonthPlanWorkingDays(currentPlan.id, wdStr);
    }

    function handleUpdateTimes(startTime: string, endTime: string) {
        if (!currentPlan) return;
        updateMonthPlanWorkingDays(currentPlan.id, currentPlan.workingDays, startTime, endTime);
    }

    async function handleTeamLeadChange(sdrId: string) {
        setSavingTeamLead(true);
        try {
            const res = await fetch(`/api/missions/${mission.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamLeadSdrId: sdrId || null }),
            });
            const json = await res.json();
            if (!json.success) {
                showError('Erreur', json.error || 'Impossible de modifier');
            }
        } catch {
            showError('Erreur', 'Une erreur est survenue');
        } finally {
            setSavingTeamLead(false);
        }
    }

    return (
        <div
            ref={cardRef}
            onMouseEnter={() => setHoveredMissionId(mission.id)}
            onMouseLeave={() => setHoveredMissionId(null)}
            className={cn(
                'border rounded-xl transition-all duration-200 bg-white',
                isHighlightedBySdr && 'ring-2 ring-indigo-300 border-indigo-200',
                isFocused && 'ring-2 ring-amber-400 border-amber-300',
                !isHighlightedBySdr && !isFocused && 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
                !hasPlan && 'border-l-4 border-l-red-400',
                hasPlan && gap > 0 && allocatedDays > 0 && 'border-l-4 border-l-amber-400',
                hasPlan && allocatedDays === 0 && targetDays > 0 && 'border-l-4 border-l-red-400',
                hasPlan && allocatedDays === targetDays && targetDays > 0 && 'border-l-4 border-l-emerald-400',
                hasPlan && allocatedDays > targetDays && targetDays > 0 && 'border-l-4 border-l-red-400',
            )}
        >
            {/* Header — always visible */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full text-left p-4"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', color.bg)}>
                                <Icon className={cn('w-3.5 h-3.5', color.text)} />
                            </div>
                            <p className="font-semibold text-slate-900 text-sm truncate">{mission.name}</p>
                            {!hasPlan && (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Non planifié
                                </span>
                            )}
                            {hasPlan && gap > 0 && targetDays > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                    <AlertTriangle className="w-2.5 h-2.5" /> {gap}j manquants
                                </span>
                            )}
                            {hasPlan && allocatedDays === targetDays && targetDays > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Complet
                                </span>
                            )}
                            {hasPlan && allocatedDays > targetDays && targetDays > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Suroccupé
                                </span>
                            )}
                            {missionConflicts.P0.length > 0 && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setDrawerOpen(true); }}
                                    className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-red-200 hover:bg-red-100 transition-colors"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    {missionConflicts.P0.length} conflit{missionConflicts.P0.length > 1 ? 's' : ''}
                                </button>
                            )}
                            {missionConflicts.P1.length > 0 && missionConflicts.P0.length === 0 && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setDrawerOpen(true); }}
                                    className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-amber-200 hover:bg-amber-100 transition-colors"
                                >
                                    {missionConflicts.P1.length} alerte{missionConflicts.P1.length > 1 ? 's' : ''}
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {mission.client.name} · {dateRange}
                        </p>
                    </div>
                    <ChevronDown className={cn(
                        'w-4 h-4 text-slate-400 transition-transform flex-shrink-0 mt-1',
                        expanded && 'rotate-180'
                    )} />
                </div>

                {/* 3-zone progress bar */}
                {hasPlan && targetDays > 0 && (
                    <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-500">{allocatedDays}/{targetDays}j alloués</span>
                            {scheduledDays > 0 && (
                                <span className="text-[10px] text-slate-400">{scheduledDays} blocs posés</span>
                            )}
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex relative">
                            <div
                                className="h-full transition-all duration-500"
                                style={{ width: `${pctAllocated * 100}%`, backgroundColor: color.hex }}
                            />
                            {pctOverflow > 0 && (
                                <div
                                    className="h-full bg-red-400"
                                    style={{
                                        width: `${Math.min(pctOverflow, 0.3) * 100}%`,
                                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.4) 2px, rgba(255,255,255,0.4) 4px)',
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Working days indicator */}
                {currentPlan && currentWorkingDays.size > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                        <Calendar className="w-3 h-3 text-indigo-400" />
                        <div className="flex gap-0.5">
                            {['L', 'M', 'Me', 'J', 'V', 'S', 'D'].map((label, i) => (
                                <span
                                    key={i}
                                    className={cn(
                                        'w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center',
                                        currentWorkingDays.has(i + 1)
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-300',
                                    )}
                                >
                                    {label}
                                </span>
                            ))}
                        </div>
                        <span className="text-[10px] text-indigo-500 font-medium">{workingDayCount}j/mois</span>
                        <span className="text-slate-300 mx-0.5">·</span>
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] text-slate-500">{currentStartTime.replace(':', 'h')}–{currentEndTime.replace(':', 'h')}</span>
                    </div>
                )}

                {/* SDR allocation pills */}
                {currentPlan && currentPlan.allocations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {currentPlan.allocations.map((alloc) => (
                            <span key={alloc.id} className={cn(
                                'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                                alloc.scheduledDays >= alloc.allocatedDays && alloc.allocatedDays > 0
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                            )}>
                                {alloc.sdr.name.split(' ').map(n => n[0]).join('')} {alloc.allocatedDays}j
                            </span>
                        ))}
                    </div>
                )}
            </button>

            {/* Expanded state */}
            {expanded && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                    {/* No plan yet — create one */}
                    {!hasPlan && !creatingPlan && (
                        <div className="bg-red-50/50 border border-red-100 rounded-lg p-4 text-center">
                            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                            <p className="text-sm font-medium text-slate-800">Aucun plan pour ce mois</p>
                            <p className="text-xs text-slate-500 mt-1 mb-3">Créez un plan mensuel pour définir l&apos;objectif et affecter des SDRs.</p>
                            <button
                                onClick={(e) => { e.stopPropagation(); setCreatingPlan(true); }}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                <Plus className="w-4 h-4 inline mr-1" />
                                Créer le plan mensuel
                            </button>
                        </div>
                    )}

                    {/* Create plan form */}
                    {!hasPlan && creatingPlan && (
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4">
                            <p className="text-xs font-semibold text-slate-700 mb-2">Nouveau plan mensuel</p>
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-slate-600">Objectif :</label>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setNewTargetDays(Math.max(1, newTargetDays - 1))} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-white text-slate-500">
                                        <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                        type="number"
                                        value={newTargetDays}
                                        onChange={(e) => setNewTargetDays(Math.max(1, Number(e.target.value)))}
                                        className="w-14 text-center text-sm font-bold border border-slate-200 rounded-lg py-1 bg-white"
                                    />
                                    <button onClick={() => setNewTargetDays(newTargetDays + 1)} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-white text-slate-500">
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs text-slate-500">jours</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                                <button
                                    onClick={handleCreatePlan}
                                    disabled={savingPlan}
                                    className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                    {savingPlan ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    Créer
                                </button>
                                <button
                                    onClick={() => setCreatingPlan(false)}
                                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Plan exists — show stats and allocations */}
                    {hasPlan && (
                        <>
                            {/* Summary stats with editable target */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-slate-50 rounded-lg px-2 py-2 relative group">
                                    <p className="text-[10px] text-slate-500">Objectif</p>
                                    {editingTarget ? (
                                        <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                            <input
                                                type="number"
                                                value={editTargetVal}
                                                onChange={(e) => setEditTargetVal(Math.max(0, Number(e.target.value)))}
                                                className="w-10 text-center text-sm font-bold border border-indigo-300 rounded bg-white py-0.5"
                                                autoFocus
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTarget(); if (e.key === 'Escape') setEditingTarget(false); }}
                                            />
                                            <button onClick={handleSaveTarget} className="text-indigo-600 hover:text-indigo-800">
                                                <Save className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-1">
                                            <p className="text-sm font-bold text-slate-800">{targetDays}j</p>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditTargetVal(targetDays); setEditingTarget(true); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600"
                                            >
                                                <Pencil className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-50 rounded-lg px-2 py-2">
                                    <p className="text-[10px] text-slate-500">Alloués</p>
                                    <p className={cn('text-sm font-bold', allocatedDays === targetDays && targetDays > 0 ? 'text-emerald-600' : allocatedDays > targetDays ? 'text-red-600' : 'text-amber-600')}>
                                        {allocatedDays}j
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-lg px-2 py-2">
                                    <p className="text-[10px] text-slate-500">Blocs posés</p>
                                    <p className={cn('text-sm font-bold', scheduledDays >= allocatedDays && allocatedDays > 0 ? 'text-emerald-600' : 'text-slate-800')}>
                                        {scheduledDays}j
                                    </p>
                                </div>
                            </div>

                            {/* Warning: working days not set → blocks won't be generated */}
                            {scheduledDays === 0 && currentWorkingDays.size === 0 && allocatedDays > 0 && (
                                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-medium text-amber-800">Jours de travail non définis — blocs non générés</p>
                                        <p className="text-[11px] text-amber-600 mt-0.5">Configurez les jours ci-dessous pour activer la génération automatique de blocs.</p>
                                    </div>
                                </div>
                            )}

                            {/* Working days configuration */}
                            <div className="bg-gradient-to-r from-indigo-50/50 to-violet-50/50 border border-indigo-100 rounded-xl p-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                        <span className="text-[11px] font-semibold text-slate-700">Jours de travail</span>
                                    </div>
                                    {currentWorkingDays.size > 0 && (
                                        <span className="text-[10px] text-indigo-600 font-medium bg-indigo-100 px-2 py-0.5 rounded-full">
                                            {workingDayCount} jours ce mois
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    {[
                                        { day: 1, label: 'Lun' },
                                        { day: 2, label: 'Mar' },
                                        { day: 3, label: 'Mer' },
                                        { day: 4, label: 'Jeu' },
                                        { day: 5, label: 'Ven' },
                                        { day: 6, label: 'Sam' },
                                        { day: 7, label: 'Dim' },
                                    ].map(({ day, label }) => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleToggleWorkingDay(day); }}
                                            className={cn(
                                                'flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all',
                                                currentWorkingDays.has(day)
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                    : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-500',
                                                day >= 6 && !currentWorkingDays.has(day) && 'opacity-50',
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {currentWorkingDays.size > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <div className="flex items-center gap-1 text-[11px]">
                                            <input
                                                type="time"
                                                value={currentStartTime}
                                                onChange={(e) => handleUpdateTimes(e.target.value, currentEndTime)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="px-1.5 py-0.5 border border-slate-200 rounded-md text-[11px] bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none w-20"
                                            />
                                            <span className="text-slate-400">→</span>
                                            <input
                                                type="time"
                                                value={currentEndTime}
                                                onChange={(e) => handleUpdateTimes(currentStartTime, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="px-1.5 py-0.5 border border-slate-200 rounded-md text-[11px] bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none w-20"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SDR allocation table */}
                            {currentPlan.allocations.length > 0 && (
                                <div className="border border-slate-100 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="text-left px-3 py-2 font-medium text-slate-500">SDR</th>
                                                <th className="text-center px-3 py-2 font-medium text-slate-500">Alloués</th>
                                                <th className="text-center px-3 py-2 font-medium text-slate-500">Blocs</th>
                                                <th className="text-center px-3 py-2 font-medium text-slate-500">Charge SDR</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentPlan.allocations.map((alloc) => (
                                                <AllocationRow
                                                    key={alloc.id}
                                                    alloc={alloc}
                                                    missionId={mission.id}
                                                    blocksBySdrMission={blocksBySdrMission}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Assign CTA */}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setAssignModalMissionId(mission.id); }}
                                className="w-full border border-dashed border-slate-300 rounded-lg py-2.5 text-xs font-medium text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <Plus className="w-3.5 h-3.5" /> Affecter un SDR
                            </button>

                            {/* Team lead selector */}
                            {mission.sdrAssignments.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                    <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Team Lead</span>
                                    <select
                                        value={mission.teamLeadSdrId ?? ''}
                                        onChange={(e) => handleTeamLeadChange(e.target.value)}
                                        disabled={savingTeamLead}
                                        className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none disabled:opacity-50"
                                    >
                                        <option value="">Aucun</option>
                                        {mission.sdrAssignments.map((a) => (
                                            <option key={a.sdr.id} value={a.sdr.id}>{a.sdr.name}</option>
                                        ))}
                                    </select>
                                    {savingTeamLead && <Loader2 className="w-3 h-3 animate-spin text-slate-400 flex-shrink-0" />}
                                </div>
                            )}
                        </>
                    )}

                    {/* Mission lifetime month strip — full duration */}
                    <MissionLifetimeStrip mission={mission} month={month} setMonth={setMonth} createMonthPlan={createMonthPlan} />

                    {/* P2 conflict info notes */}
                    {missionConflicts.P2.length > 0 && (
                        <div className="pt-2 space-y-1">
                            {missionConflicts.P2.map((c) => (
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

// ── Inline allocation row with day spinner ─────────────────────────────

function AllocationRow({
    alloc, missionId, blocksBySdrMission,
}: {
    alloc: MonthAllocation;
    missionId: string;
    blocksBySdrMission: Record<string, number>;
}) {
    const { updateAllocation, snapshot } = usePlanningMonth();

    const blocksKey = `${alloc.sdrId}::${missionId}`;
    const blocksPlaced = blocksBySdrMission[blocksKey] ?? 0;

    const sdr = snapshot?.sdrs.find((s) => s.id === alloc.sdrId);
    const totalAllocated = sdr?.sdrDayAllocations.reduce((s, a) => s + a.allocatedDays, 0) ?? 0;
    const capacity = sdr?.sdrMonthCapacities[0]?.effectiveAvailableDays ?? 0;
    const loadPct = capacity > 0 ? Math.round((totalAllocated / capacity) * 100) : 0;

    function handleChange(delta: number) {
        const newVal = Math.max(0, alloc.allocatedDays + delta);
        updateAllocation(alloc.id, newVal);
    }

    const isInvisible = alloc.scheduledDays === 0 && alloc.allocatedDays > 0;

    return (
        <>
            <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-3 py-2 font-medium text-slate-700">{alloc.sdr.name}</td>
                <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-0.5">
                        <button
                            onClick={() => handleChange(-1)}
                            disabled={alloc.allocatedDays <= 0}
                            className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500 disabled:opacity-30 transition-colors"
                        >
                            <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-mono text-xs font-bold tabular-nums">
                            {alloc.allocatedDays}
                        </span>
                        <button
                            onClick={() => handleChange(1)}
                            className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500 disabled:opacity-30 transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>
                </td>
                <td className="px-3 py-2 text-center">
                    <span className={cn(
                        'font-medium',
                        blocksPlaced >= alloc.allocatedDays && alloc.allocatedDays > 0 ? 'text-emerald-600' : 'text-slate-500'
                    )}>
                        {blocksPlaced}/{alloc.allocatedDays}
                    </span>
                </td>
                <td className="px-3 py-2 text-center">
                    <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                        loadPct > 100 ? 'text-red-700 bg-red-50' : loadPct >= 85 ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-50'
                    )}>
                        {loadPct}%
                    </span>
                </td>
            </tr>
            {isInvisible && (
                <tr className="border-b border-slate-50">
                    <td colSpan={4} className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5" title="Aucun bloc posé — cet SDR ne verra pas cette mission dans son espace action">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span className="font-medium">⚠ Mission invisible pour l&apos;SDR</span>
                            <span className="text-amber-500 mx-1">·</span>
                            <span className="text-amber-600">Aucun bloc posé</span>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ── Mission lifetime strip ─────────────────────────────────────────────

function getMonthRange(startDate: string, endDate: string): string[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months: string[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= endMonth) {
        months.push(formatMonth(cursor));
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
}

function MissionLifetimeStrip({
    mission, month, setMonth, createMonthPlan,
}: {
    mission: SnapshotMission;
    month: string;
    setMonth: (m: string) => void;
    createMonthPlan: (missionId: string, targetDays: number) => Promise<boolean>;
}) {
    const allMonths = useMemo(() => getMonthRange(mission.startDate, mission.endDate), [mission.startDate, mission.endDate]);
    const plansByMonth = useMemo(() => {
        const map = new Map<string, (typeof mission.missionMonthPlans)[0]>();
        mission.missionMonthPlans.forEach((p) => map.set(p.month, p));
        return map;
    }, [mission.missionMonthPlans]);

    const totalPlanned = mission.missionMonthPlans.reduce((s, p) => s + p.targetDays, 0);
    const [creatingMonth, setCreatingMonth] = useState<string | null>(null);

    async function handleCreateForMonth(m: string) {
        setCreatingMonth(m);
        await createMonthPlan(mission.id, 18);
        setCreatingMonth(null);
    }

    if (allMonths.length === 0) return null;

    return (
        <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1.5">
                {mission.totalContractDays ? (
                    <>
                        <span className="font-medium">Contrat {mission.totalContractDays}j</span>
                        <span className="text-slate-300">·</span>
                        <span>{totalPlanned}/{mission.totalContractDays}j planifiés</span>
                    </>
                ) : (
                    <span className="font-medium">Durée mission</span>
                )}
            </div>
            <div className="flex flex-wrap gap-1">
                {allMonths.map((m) => {
                    const plan = plansByMonth.get(m);
                    const isCurrent = m === month;
                    const isCreating = creatingMonth === m;

                    if (!plan) {
                        return (
                            <button
                                key={m}
                                type="button"
                                disabled={isCreating}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMonth(m);
                                    handleCreateForMonth(m);
                                }}
                                className={cn(
                                    'px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer hover:shadow-sm transition-all',
                                    'bg-slate-50 text-slate-400 border-dashed border-slate-300 hover:border-indigo-300 hover:text-indigo-500',
                                    isCurrent && 'ring-2 ring-indigo-400 ring-offset-1',
                                )}
                                title="Aucun plan — cliquer pour créer"
                            >
                                {isCreating ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <>{formatMonthShort(m)} ○</>}
                            </button>
                        );
                    }

                    const pAlloc = plan.allocations.reduce((s, a) => s + a.allocatedDays, 0);
                    const isComplete = pAlloc === plan.targetDays && plan.targetDays > 0;
                    const isOff = pAlloc > plan.targetDays && plan.targetDays > 0;
                    const isUnderstaffed = pAlloc > 0 && pAlloc < plan.targetDays;
                    const isEmpty = pAlloc === 0 && plan.targetDays > 0;

                    return (
                        <button
                            key={plan.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setMonth(m); }}
                            className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer hover:shadow-sm transition-all',
                                isComplete && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                isOff && 'bg-red-50 text-red-600 border-red-200',
                                isUnderstaffed && 'bg-amber-50 text-amber-700 border-amber-200',
                                isEmpty && 'bg-red-50 text-red-600 border-red-200',
                                !isComplete && !isOff && !isUnderstaffed && !isEmpty && 'bg-slate-50 text-slate-400 border-slate-200',
                                isCurrent && 'ring-2 ring-indigo-400 ring-offset-1',
                            )}
                        >
                            {formatMonthShort(m)} {isComplete ? '✓' : (isUnderstaffed || isOff) ? '⚠' : ''} {plan.targetDays}j
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
