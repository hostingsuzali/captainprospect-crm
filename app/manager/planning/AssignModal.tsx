'use client';

import { useState, useMemo } from 'react';
import { X, Plus, Minus, UserCircle, AlertTriangle, Loader2, CheckCircle2, AlertCircle, Calendar, Clock, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlanningMonth, type SnapshotSdr } from './PlanningMonthContext';
import { getMissionColor, getSdrStatus, SDR_STATUS_CONFIG } from './planning-utils';
import { useToast } from '@/components/ui';

const DAY_LABELS_SHORT = ['L', 'M', 'Me', 'J', 'V', 'S', 'D'];

export function AssignModal() {
    const {
        assignModalMissionId, setAssignModalMissionId,
        snapshot, month, reload, backgroundSync, getSnapshot,
        createMonthPlan, assignSdrToMission, createAllocation, createAllocationWithBlocks,
    } = usePlanningMonth();
    const { success, error: showError } = useToast();

    const [selectedSdrId, setSelectedSdrId] = useState<string | null>(null);
    const [days, setDays] = useState(5);
    const [submitting, setSubmitting] = useState(false);

    const mission = snapshot?.missions.find((m) => m.id === assignModalMissionId);
    const currentPlan = mission?.missionMonthPlans.find((p) => p.month === month);

    const hasWorkingDays = !!currentPlan?.workingDays;
    const workingDaySet = useMemo(() => {
        if (!currentPlan?.workingDays) return new Set<number>();
        return new Set(currentPlan.workingDays.split(',').map(Number).filter(Boolean));
    }, [currentPlan?.workingDays]);

    const availableWorkingDates = useMemo(() => {
        if (workingDaySet.size === 0) return [];
        const [yr, mo] = month.split('-').map(Number);
        const daysInMonth = new Date(yr, mo, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dates: Date[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(yr, mo - 1, d);
            if (date < today) continue;
            const dow = date.getDay() === 0 ? 7 : date.getDay();
            if (workingDaySet.has(dow)) dates.push(date);
        }
        return dates;
    }, [workingDaySet, month]);

    const sortedSdrs = useMemo(() => {
        if (!snapshot) return [];
        const withAvail = snapshot.sdrs.map((s) => ({ sdr: s, avail: sdrAvailability(s) }));
        const available = withAvail.filter((x) => x.avail > 0).sort((a, b) => b.avail - a.avail);
        const full = withAvail.filter((x) => x.avail <= 0).sort((a, b) => a.sdr.name.localeCompare(b.sdr.name));
        return [...available, ...full].map((x) => x.sdr);
    }, [snapshot]);

    function sdrAvailability(sdr: SnapshotSdr): number {
        const cap = sdr.sdrMonthCapacities[0]?.effectiveAvailableDays ?? 0;
        const allocated = sdr.sdrDayAllocations.reduce((s, a) => s + a.allocatedDays, 0);
        return cap - allocated;
    }

    const selectedSdr = sortedSdrs.find((s) => s.id === selectedSdrId);
    const selectedAvail = selectedSdr ? sdrAvailability(selectedSdr) : 0;
    const selectedTotalAllocated = selectedSdr?.sdrDayAllocations.reduce((s, a) => s + a.allocatedDays, 0) ?? 0;
    const selectedCap = selectedSdr?.sdrMonthCapacities[0]?.effectiveAvailableDays ?? 0;
    const afterAlloc = selectedTotalAllocated + days;
    const afterPct = selectedCap > 0 ? Math.round((afterAlloc / selectedCap) * 100) : 0;

    const alreadyAllocated = new Set(currentPlan?.allocations.map((a) => a.sdrId) ?? []);
    const missionSdrAssignmentIds = new Set(mission?.sdrAssignments.map((a) => a.sdr.id) ?? []);

    // Remaining days to cover
    const targetDays = currentPlan?.targetDays ?? 0;
    const totalAllocatedDays = currentPlan?.allocations.reduce((s, a) => s + a.allocatedDays, 0) ?? 0;
    const remaining = Math.max(0, targetDays - totalAllocatedDays);

    function handleClose() {
        setAssignModalMissionId(null);
        setSelectedSdrId(null);
        setDays(5);
    }

    async function handleConfirm() {
        if (!selectedSdrId || !mission) return;
        setSubmitting(true);
        try {
            let planId = currentPlan?.id;
            if (!planId) {
                const ok = await createMonthPlan(mission.id, days, month);
                if (!ok) { setSubmitting(false); return; }
                await reload();
                const latest = getSnapshot();
                const freshMission = (latest?.missions ?? []).find((m) => m.id === mission.id);
                const freshPlan = freshMission?.missionMonthPlans.find((p) => p.month === month);
                planId = freshPlan?.id;
                if (!planId) {
                    showError('Erreur', 'Plan mensuel introuvable après création');
                    setSubmitting(false);
                    return;
                }
            }

            if (!missionSdrAssignmentIds.has(selectedSdrId)) {
                const ok = await assignSdrToMission(mission.id, selectedSdrId);
                if (!ok) { setSubmitting(false); return; }
            }

            const ok = hasWorkingDays
                ? await createAllocationWithBlocks(planId, selectedSdrId, days, mission.id)
                : await createAllocation(planId, selectedSdrId, days);
            if (ok) {
                handleClose();
                backgroundSync();
            }
        } catch {
            showError('Erreur', 'Une erreur est survenue');
        } finally {
            setSubmitting(false);
        }
    }

    if (!assignModalMissionId || !mission) return null;

    const color = getMissionColor(mission.id);
    const noPlan = !currentPlan;

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={handleClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <div>
                        <h2 className="font-semibold text-slate-900 text-sm">Affecter un SDR</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className={cn('w-2 h-2 rounded-full', color.dot)} />
                            <span className="text-xs text-slate-500">{mission.name} · {mission.client.name}</span>
                        </div>
                        {currentPlan && (
                            <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                                <span className="text-slate-500">Objectif: <strong>{targetDays}j</strong></span>
                                <span className="text-slate-500">Alloués: <strong className={totalAllocatedDays >= targetDays ? 'text-emerald-600' : 'text-amber-600'}>{totalAllocatedDays}j</strong></span>
                                {remaining > 0 && (
                                    <span className="text-amber-600 font-medium">À couvrir: {remaining}j</span>
                                )}
                            </div>
                        )}
                    </div>
                    <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* No plan warning — will auto-create */}
                {noPlan && (
                    <div className="mx-5 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-amber-800">
                            <p className="font-medium">Aucun plan mensuel</p>
                            <p className="mt-0.5">Un plan sera automatiquement créé avec les jours sélectionnés.</p>
                        </div>
                    </div>
                )}

                {/* SDR picker */}
                <div className="flex-1 overflow-y-auto px-5 py-3">
                    <p className="text-xs text-slate-500 mb-2 font-medium">Sélectionner un SDR</p>
                    <div className="space-y-1.5">
                        {sortedSdrs.map((sdr) => {
                            const avail = sdrAvailability(sdr);
                            const totalAlloc = sdr.sdrDayAllocations.reduce((s, a) => s + a.allocatedDays, 0);
                            const cap = sdr.sdrMonthCapacities[0]?.effectiveAvailableDays ?? 0;
                            const status = getSdrStatus(totalAlloc, cap);
                            const statusCfg = SDR_STATUS_CONFIG[status];
                            const isAllocated = alreadyAllocated.has(sdr.id);
                            const isAssigned = missionSdrAssignmentIds.has(sdr.id);
                            const atCapacity = avail <= 0;
                            const isSelected = selectedSdrId === sdr.id;

                            // Risk indicator
                            let riskIcon = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
                            let riskLabel = 'OK';
                            if (atCapacity) {
                                riskIcon = <AlertTriangle className="w-4 h-4 text-red-500" />;
                                riskLabel = 'Plein';
                            } else if (status === 'near' || status === 'overloaded') {
                                riskIcon = <AlertCircle className="w-4 h-4 text-amber-500" />;
                                riskLabel = 'Attention';
                            }

                            return (
                                <button
                                    key={sdr.id}
                                    type="button"
                                    disabled={isAllocated}
                                    onClick={() => {
                                        setSelectedSdrId(isSelected ? null : sdr.id);
                                        if (remaining > 0) setDays(Math.min(remaining, avail > 0 ? avail : 5));
                                    }}
                                    className={cn(
                                        'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                                        isSelected && 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200',
                                        !isSelected && !isAllocated && 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50',
                                        isAllocated && 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed',
                                        atCapacity && !isAllocated && 'opacity-50',
                                    )}
                                >
                                    <UserCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-800 truncate">{sdr.name}</span>
                                            {isAllocated && (
                                                <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">Déjà affecté</span>
                                            )}
                                            {!isAssigned && !isAllocated && (
                                                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Nouveau</span>
                                            )}
                                        </div>
                                    <div className="mt-1 space-y-0.5">
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                            <span>{totalAlloc}/{cap}j</span>
                                            {avail > 0 && <span className="text-emerald-600 font-medium">{avail}j dispo</span>}
                                            {avail <= 0 && cap > 0 && (
                                                <span className="flex items-center gap-1 text-red-500 font-medium">
                                                    <Lock className="w-3 h-3" /> Plein
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300 bg-indigo-500"
                                                style={{ width: `${cap > 0 ? Math.min(100, Math.round((totalAlloc / cap) * 100)) : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                                        {riskIcon}
                                        <span className="text-[9px] text-slate-500">{riskLabel}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Day picker + preview + confirm */}
                {selectedSdrId && (
                    <div className="border-t border-slate-200 px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-600">Jours à allouer</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setDays(Math.max(1, days - 1))}
                                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500"
                                >
                                    <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                    type="number"
                                    value={days}
                                    onChange={(e) => setDays(Math.max(1, Number(e.target.value)))}
                                    className="w-12 text-center font-mono text-sm font-bold border border-slate-200 rounded-lg py-1"
                                />
                                <button
                                    onClick={() => setDays(days + 1)}
                                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 text-[11px]">
                            <button
                                type="button"
                                onClick={() => setDays(5)}
                                className="px-2 py-1 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                            >
                                5j
                            </button>
                            <button
                                type="button"
                                onClick={() => setDays(10)}
                                className="px-2 py-1 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                            >
                                10j
                            </button>
                            {remaining > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setDays(remaining)}
                                    className="px-2 py-1 rounded-full border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors"
                                >
                                    Tout couvrir ({remaining}j)
                                </button>
                            )}
                        </div>

                        {/* Live preview */}
                        <div className={cn(
                            'rounded-lg px-3 py-2.5 text-xs space-y-2',
                            afterPct > 100 ? 'bg-red-50 text-red-700 border border-red-200' : afterPct >= 85 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        )}>
                            <p>
                                Après affectation : <strong>{selectedSdr?.name}</strong> sera à <strong>{afterAlloc}/{selectedCap}j</strong> ({afterPct}%)
                            </p>
                            <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all duration-300',
                                        afterPct > 100 ? 'bg-red-500' : afterPct >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
                                    )}
                                    style={{ width: `${Math.min(afterPct, 100)}%` }}
                                />
                            </div>
                            {afterPct > 100 && (
                                <p className="flex items-center gap-1 font-medium text-red-600">
                                    <AlertTriangle className="w-3 h-3" /> Dépassement de capacité de {afterAlloc - selectedCap}j — confirmer quand même ?
                                </p>
                            )}
                            {!missionSdrAssignmentIds.has(selectedSdrId) && (
                                <p className="text-blue-600">
                                    Ce SDR sera aussi assigné à la mission automatiquement.
                                </p>
                            )}
                        </div>

                        {/* Auto-schedule preview */}
                        {hasWorkingDays && (
                            <div className="rounded-lg px-3 py-2.5 bg-violet-50 border border-violet-200 text-xs text-violet-700">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span className="font-semibold">Planification automatique</span>
                                </div>
                                <p className="text-[11px] text-violet-600">
                                    {Math.min(days, availableWorkingDates.length)} blocs seront automatiquement créés sur les jours configurés
                                    {currentPlan?.defaultStartTime && currentPlan?.defaultEndTime && (
                                        <> ({currentPlan.defaultStartTime}–{currentPlan.defaultEndTime})</>
                                    )}
                                </p>
                                <div className="flex gap-0.5 mt-1.5">
                                    {DAY_LABELS_SHORT.map((label, i) => (
                                        <span
                                            key={i}
                                            className={cn(
                                                'w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center',
                                                workingDaySet.has(i + 1) ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-300',
                                            )}
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                                {days > availableWorkingDates.length && availableWorkingDates.length > 0 && (
                                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Seulement {availableWorkingDates.length} jours disponibles restants ce mois
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Warning: no working days set */}
                        {!hasWorkingDays && currentPlan && (
                            <div className="rounded-lg px-3 py-2.5 bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-start gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium">Jours de travail non définis</p>
                                    <p className="text-[11px] text-amber-600 mt-0.5">Les blocs ne seront pas générés automatiquement. Configurez les jours de travail dans la carte mission.</p>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleConfirm}
                            disabled={submitting}
                            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {hasWorkingDays ? 'Confirmer et planifier' : "Confirmer l'affectation"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
