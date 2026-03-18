'use client';

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { useToast } from '@/components/ui';

// ── Types mirroring /api/planning/month response ───────────────────────

export interface MonthAllocation {
    id: string;
    sdrId: string;
    allocatedDays: number;
    scheduledDays: number;
    status: string;
    sdr: { id: string; name: string };
}

export interface MonthPlan {
    id: string;
    month: string;
    targetDays: number;
    status: string;
    workingDays: string | null;
    defaultStartTime: string | null;
    defaultEndTime: string | null;
    allocations: MonthAllocation[];
}

export interface SnapshotMission {
    id: string;
    name: string;
    channel: string;
    channels: string[];
    startDate: string;
    endDate: string;
    totalContractDays: number | null;
    teamLeadSdrId: string | null;
    client: { id: string; name: string };
    sdrAssignments: Array<{ sdr: { id: string; name: string } }>;
    missionMonthPlans: MonthPlan[];
}

export interface SdrAllocationSnapshot {
    id: string;
    allocatedDays: number;
    scheduledDays: number;
    status: string;
    missionMonthPlan: {
        id: string;
        month: string;
        missionId?: string;
        mission: { id: string; name: string };
    };
}

export interface SdrAbsenceSnapshot {
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    impactsPlanning: boolean;
    note: string | null;
}

export interface SdrCapacitySnapshot {
    id: string;
    month: string;
    baseWorkingDays: number;
    effectiveAvailableDays: number;
}

export interface SnapshotSdr {
    id: string;
    name: string;
    email: string;
    role: string;
    sdrMonthCapacities: SdrCapacitySnapshot[];
    sdrAbsences: SdrAbsenceSnapshot[];
    sdrDayAllocations: SdrAllocationSnapshot[];
}

export interface PlanningConflict {
    id: string;
    type: string;
    severity: 'P0' | 'P1' | 'P2';
    sdrId: string | null;
    missionId: string | null;
    month: string;
    message: string;
    suggestedAction: string | null;
    resolvedAt: string | null;
    createdAt: string;
}

export interface ConflictSummary {
    P0: number;
    P1: number;
    P2: number;
    total: number;
}

export interface HealthSummary {
    missions: { active: number; understaffed: number; noSdr: number; complete: number };
    sdrs: { optimal: number; overloaded: number; underutilized: number };
}

export interface MonthSnapshot {
    month: string;
    missions: SnapshotMission[];
    sdrs: SnapshotSdr[];
    blocksBySdrMission: Record<string, number>;
    conflicts: PlanningConflict[];
    conflictSummary: ConflictSummary;
    healthSummary: HealthSummary;
}

// ── Context value ──────────────────────────────────────────────────────

interface PlanningMonthContextValue {
    month: string;
    setMonth: (m: string) => void;
    snapshot: MonthSnapshot | null;
    loading: boolean;
    reload: () => Promise<void>;
    backgroundSync: () => void;
    getSnapshot: () => MonthSnapshot | null;

    hoveredMissionId: string | null;
    setHoveredMissionId: (id: string | null) => void;
    hoveredSdrId: string | null;
    setHoveredSdrId: (id: string | null) => void;

    focusedMissionId: string | null;
    setFocusedMissionId: (id: string | null) => void;
    focusedSdrId: string | null;
    setFocusedSdrId: (id: string | null) => void;

    updateAllocation: (allocationId: string, newDays: number) => Promise<void>;
    createMonthPlan: (missionId: string, targetDays: number, monthOverride?: string) => Promise<boolean>;
    updateMonthPlan: (planId: string, targetDays: number) => Promise<boolean>;
    updateMonthPlanWorkingDays: (planId: string, workingDays: string | null, startTime?: string, endTime?: string) => Promise<boolean>;
    assignSdrToMission: (missionId: string, sdrId: string) => Promise<boolean>;
    createAllocation: (missionMonthPlanId: string, sdrId: string, days: number) => Promise<boolean>;
    createAllocationWithBlocks: (missionMonthPlanId: string, sdrId: string, days: number, missionId: string) => Promise<boolean>;
}

const PlanningMonthCtx = createContext<PlanningMonthContextValue | null>(null);

export function usePlanningMonth() {
    const ctx = useContext(PlanningMonthCtx);
    if (!ctx) throw new Error('usePlanningMonth must be used within PlanningMonthProvider');
    return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────

function formatCurrentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function PlanningMonthProvider({ children }: { children: ReactNode }) {
    const { success, error: showError } = useToast();
    const [month, setMonth] = useState(formatCurrentMonth);
    const [snapshot, setSnapshot] = useState<MonthSnapshot | null>(null);
    const [loading, setLoading] = useState(true);

    const [hoveredMissionId, setHoveredMissionId] = useState<string | null>(null);
    const [hoveredSdrId, setHoveredSdrId] = useState<string | null>(null);
    const [focusedMissionId, setFocusedMissionId] = useState<string | null>(null);
    const [focusedSdrId, setFocusedSdrId] = useState<string | null>(null);

    const monthRef = useRef(month);
    monthRef.current = month;
    const snapshotRef = useRef(snapshot);
    snapshotRef.current = snapshot;

    // Silent background sync — fetches fresh data without loading spinner
    const bgSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backgroundSync = useCallback(() => {
        if (bgSyncTimer.current) clearTimeout(bgSyncTimer.current);
        bgSyncTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/planning/month?month=${monthRef.current}`);
                const json = await res.json();
                if (json.success) setSnapshot(json.data);
            } catch { /* silent */ }
        }, 300);
    }, []);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/planning/month?month=${monthRef.current}`);
            const json = await res.json();
            if (json.success) {
                setSnapshot(json.data);
            }
        } catch {
            // non-fatal
        } finally {
            setLoading(false);
        }
    }, []);

    const prevMonth = useRef(month);
    if (prevMonth.current !== month) {
        prevMonth.current = month;
        reload();
    }

    const didMount = useRef(false);
    if (!didMount.current) {
        didMount.current = true;
        reload();
    }

    // ── updateAllocation: optimistic day change ────────────────────────
    const updateAllocation = useCallback(async (allocationId: string, newDays: number) => {
        const snap = snapshotRef.current;
        if (!snap) return;
        const prev = snap;
        setSnapshot(patchAllocationDays(snap, allocationId, newDays));

        try {
            const res = await fetch(`/api/sdr-allocations/${allocationId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allocatedDays: newDays }),
            });
            const json = await res.json();
            if (!json.success) {
                setSnapshot(prev);
                showError('Erreur', json.error || 'Impossible de modifier');
                return;
            }
            backgroundSync();
        } catch {
            setSnapshot(prev);
            showError('Erreur', 'Une erreur est survenue');
        }
    }, [showError, backgroundSync]);

    // ── createMonthPlan: optimistic plan insertion ─────────────────────
    const createMonthPlan = useCallback(async (missionId: string, targetDays: number, monthOverride?: string): Promise<boolean> => {
        const snap = snapshotRef.current;
        const tempId = `temp-plan-${Date.now()}`;
        const targetMonth = monthOverride ?? monthRef.current;
        if (snap) {
            setSnapshot(patchAddMonthPlan(snap, missionId, targetMonth, tempId, targetDays));
        }

        try {
            const res = await fetch('/api/mission-month-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ missionId, month: targetMonth, targetDays }),
            });
            const json = await res.json();
            if (json.success) {
                success('Plan créé', `Plan mensuel créé avec ${targetDays}j`);
                backgroundSync();
                return true;
            }
            if (snap) setSnapshot(snap);
            showError('Erreur', json.error || 'Impossible de créer le plan');
            return false;
        } catch {
            if (snap) setSnapshot(snap);
            showError('Erreur', 'Une erreur est survenue');
            return false;
        }
    }, [success, showError, backgroundSync]);

    // ── updateMonthPlan: optimistic target days change ─────────────────
    const updateMonthPlan = useCallback(async (planId: string, targetDays: number): Promise<boolean> => {
        const snap = snapshotRef.current;
        if (snap) setSnapshot(patchMonthPlanTarget(snap, planId, targetDays));

        try {
            const res = await fetch(`/api/mission-month-plans/${planId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetDays }),
            });
            const json = await res.json();
            if (json.success) {
                backgroundSync();
                return true;
            }
            if (snap) setSnapshot(snap);
            showError('Erreur', json.error || 'Impossible de modifier le plan');
            return false;
        } catch {
            if (snap) setSnapshot(snap);
            showError('Erreur', 'Une erreur est survenue');
            return false;
        }
    }, [showError, backgroundSync]);

    // ── updateMonthPlanWorkingDays: optimistic working days / times ────
    const updateMonthPlanWorkingDays = useCallback(async (planId: string, workingDays: string | null, startTime?: string, endTime?: string): Promise<boolean> => {
        const snap = snapshotRef.current;
        if (snap) setSnapshot(patchMonthPlanWorkingDays(snap, planId, workingDays, startTime, endTime));

        try {
            const body: Record<string, unknown> = { workingDays };
            if (startTime !== undefined) body.defaultStartTime = startTime;
            if (endTime !== undefined) body.defaultEndTime = endTime;
            const res = await fetch(`/api/mission-month-plans/${planId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (json.success) {
                backgroundSync();
                return true;
            }
            if (snap) setSnapshot(snap);
            showError('Erreur', json.error || 'Impossible de modifier');
            return false;
        } catch {
            if (snap) setSnapshot(snap);
            showError('Erreur', 'Une erreur est survenue');
            return false;
        }
    }, [showError, backgroundSync]);

    // ── assignSdrToMission: fire-and-forget with bg sync ──────────────
    const assignSdrToMission = useCallback(async (missionId: string, sdrId: string): Promise<boolean> => {
        try {
            const res = await fetch(`/api/missions/${missionId}/assign`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sdrId }),
            });
            const json = await res.json();
            if (json.success) {
                backgroundSync();
                return true;
            }
            if (json.error?.includes('déjà assigné')) return true;
            showError('Erreur', json.error || "Impossible d'assigner");
            return false;
        } catch {
            showError('Erreur', 'Une erreur est survenue');
            return false;
        }
    }, [showError, backgroundSync]);

    // ── createAllocation: optimistic allocation add ───────────────────
    const createAllocation = useCallback(async (missionMonthPlanId: string, sdrId: string, days: number): Promise<boolean> => {
        const snap = snapshotRef.current;
        const tempId = `temp-alloc-${Date.now()}`;
        if (snap) {
            const sdr = snap.sdrs.find((s) => s.id === sdrId);
            const sdrName = sdr?.name ?? 'SDR';
            const mission = snap.missions.find((m) => m.missionMonthPlans.some((p) => p.id === missionMonthPlanId));
            const missionName = mission?.name ?? 'Mission';
            const missionId = mission?.id ?? '';
            setSnapshot(patchAddAllocation(snap, missionMonthPlanId, tempId, sdrId, sdrName, days, missionId, missionName));
        }

        try {
            const res = await fetch('/api/sdr-allocations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sdrId, missionMonthPlanId, allocatedDays: days }),
            });
            const json = await res.json();
            if (json.success) {
                success('Affectation créée', `${days}j alloués`);
                backgroundSync();
                return true;
            }
            if (snap) setSnapshot(snap);
            showError('Erreur', json.error || "Impossible de créer l'affectation");
            return false;
        } catch {
            if (snap) setSnapshot(snap);
            showError('Erreur', 'Une erreur est survenue');
            return false;
        }
    }, [success, showError, backgroundSync]);

    // ── createAllocationWithBlocks: optimistic alloc + auto-blocks ─────
    // Creates an allocation AND asks the backend to auto-generate ScheduleBlocks
    // across the plan's configured working days (missionMonthPlan.workingDays,
    // defaultStartTime, defaultEndTime) for this month.
    const createAllocationWithBlocks = useCallback(async (missionMonthPlanId: string, sdrId: string, days: number, missionId: string): Promise<boolean> => {
        const snap = snapshotRef.current;
        const tempId = `temp-alloc-${Date.now()}`;
        if (snap) {
            const sdr = snap.sdrs.find((s) => s.id === sdrId);
            const sdrName = sdr?.name ?? 'SDR';
            const mission = snap.missions.find((m) => m.id === missionId);
            const missionName = mission?.name ?? 'Mission';
            setSnapshot(patchAddAllocation(snap, missionMonthPlanId, tempId, sdrId, sdrName, days, missionId, missionName));
        }

        try {
            const res = await fetch('/api/sdr-allocations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sdrId, missionMonthPlanId, allocatedDays: days, autoCreateBlocks: true, missionId }),
            });
            const json = await res.json();
            if (json.success) {
                const blocksMsg = json.data?.blocksCreated ? ` · ${json.data.blocksCreated} blocs créés` : '';
                success('Affectation créée', `${days}j alloués${blocksMsg}`);
                backgroundSync();
                return true;
            }
            if (snap) setSnapshot(snap);
            showError('Erreur', json.error || "Impossible de créer l'affectation");
            return false;
        } catch {
            if (snap) setSnapshot(snap);
            showError('Erreur', 'Une erreur est survenue');
            return false;
        }
    }, [success, showError, backgroundSync]);

    const getSnapshot = useCallback(() => snapshotRef.current, []);

    return (
        <PlanningMonthCtx.Provider value={{
            month, setMonth,
            snapshot, loading, reload,
            backgroundSync,
            getSnapshot,
            hoveredMissionId, setHoveredMissionId,
            hoveredSdrId, setHoveredSdrId,
            focusedMissionId, setFocusedMissionId,
            focusedSdrId, setFocusedSdrId,
            updateAllocation,
            createMonthPlan,
            updateMonthPlan,
            updateMonthPlanWorkingDays,
            assignSdrToMission,
            createAllocation,
            createAllocationWithBlocks,
        }}>
            {children}
        </PlanningMonthCtx.Provider>
    );
}

// ── Optimistic patch helpers ───────────────────────────────────────────

function patchAllocationDays(snap: MonthSnapshot, allocId: string, newDays: number): MonthSnapshot {
    return {
        ...snap,
        missions: snap.missions.map((m) => ({
            ...m,
            missionMonthPlans: m.missionMonthPlans.map((p) => ({
                ...p,
                allocations: p.allocations.map((a) =>
                    a.id === allocId ? { ...a, allocatedDays: newDays } : a
                ),
            })),
        })),
        sdrs: snap.sdrs.map((s) => ({
            ...s,
            sdrDayAllocations: s.sdrDayAllocations.map((a) =>
                a.id === allocId ? { ...a, allocatedDays: newDays } : a
            ),
        })),
    };
}

function patchAddMonthPlan(snap: MonthSnapshot, missionId: string, month: string, tempId: string, targetDays: number): MonthSnapshot {
    return {
        ...snap,
        missions: snap.missions.map((m) =>
            m.id === missionId
                ? {
                    ...m,
                    missionMonthPlans: [
                        ...m.missionMonthPlans,
                        {
                            id: tempId,
                            month,
                            targetDays,
                            status: 'DRAFT',
                            workingDays: null,
                            defaultStartTime: null,
                            defaultEndTime: null,
                            allocations: [],
                        },
                    ],
                }
                : m
        ),
    };
}

function patchMonthPlanTarget(snap: MonthSnapshot, planId: string, targetDays: number): MonthSnapshot {
    return {
        ...snap,
        missions: snap.missions.map((m) => ({
            ...m,
            missionMonthPlans: m.missionMonthPlans.map((p) =>
                p.id === planId ? { ...p, targetDays } : p
            ),
        })),
    };
}

function patchMonthPlanWorkingDays(snap: MonthSnapshot, planId: string, workingDays: string | null, startTime?: string, endTime?: string): MonthSnapshot {
    return {
        ...snap,
        missions: snap.missions.map((m) => ({
            ...m,
            missionMonthPlans: m.missionMonthPlans.map((p) => {
                if (p.id !== planId) return p;
                return {
                    ...p,
                    workingDays,
                    ...(startTime !== undefined && { defaultStartTime: startTime }),
                    ...(endTime !== undefined && { defaultEndTime: endTime }),
                };
            }),
        })),
    };
}

function patchAddAllocation(
    snap: MonthSnapshot,
    missionMonthPlanId: string,
    tempId: string,
    sdrId: string,
    sdrName: string,
    days: number,
    missionId: string,
    missionName: string,
): MonthSnapshot {
    const newMissionAlloc: MonthAllocation = {
        id: tempId,
        sdrId,
        allocatedDays: days,
        scheduledDays: 0,
        status: 'ACTIVE',
        sdr: { id: sdrId, name: sdrName },
    };
    const newSdrAlloc: SdrAllocationSnapshot = {
        id: tempId,
        allocatedDays: days,
        scheduledDays: 0,
        status: 'ACTIVE',
        missionMonthPlan: {
            id: missionMonthPlanId,
            month: snap.month,
            missionId,
            mission: { id: missionId, name: missionName },
        },
    };
    return {
        ...snap,
        missions: snap.missions.map((m) => ({
            ...m,
            missionMonthPlans: m.missionMonthPlans.map((p) =>
                p.id === missionMonthPlanId
                    ? { ...p, allocations: [...p.allocations, newMissionAlloc] }
                    : p
            ),
        })),
        sdrs: snap.sdrs.map((s) =>
            s.id === sdrId
                ? { ...s, sdrDayAllocations: [...s.sdrDayAllocations, newSdrAlloc] }
                : s
        ),
    };
}

