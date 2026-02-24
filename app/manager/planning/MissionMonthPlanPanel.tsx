'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, AlertTriangle, CheckCircle2, Circle, Loader2, Minus } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────
interface SdrAllocation {
    id: string;
    sdrId: string;
    allocatedDays: number;
    scheduledDays: number;
    status: string;
    sdr: { id: string; name: string };
}

interface MonthPlan {
    id: string;
    month: string;
    targetDays: number;
    status: string;
    allocations: SdrAllocation[];
}

interface MissionMonthPlanPanelProps {
    missionId: string;
    totalContractDays?: number | null;
    onMonthClick?: (month: string) => void;
}

function formatMonthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

function monthPillStatus(plan: MonthPlan | undefined, month: string): 'complete' | 'understaffed' | 'unplanned' {
    if (!plan) return 'unplanned';
    const total = plan.allocations.reduce((s, a) => s + a.allocatedDays, 0);
    if (total >= plan.targetDays) return 'complete';
    return 'understaffed';
}

// ── Component ──────────────────────────────────────────────────────────
export default function MissionMonthPlanPanel({
    missionId,
    totalContractDays,
    onMonthClick,
}: MissionMonthPlanPanelProps) {
    const { success: showSuccess, error: showError } = useToast();
    const [plans, setPlans] = useState<MonthPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newMonth, setNewMonth] = useState('');
    const [newTargetDays, setNewTargetDays] = useState(18);
    const [showCreate, setShowCreate] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/mission-month-plans?missionId=${missionId}`);
            const json = await res.json();
            if (json.success) setPlans(json.data);
        } finally {
            setLoading(false);
        }
    }, [missionId]);

    useEffect(() => { load(); }, [load]);

    const totalPlanned = plans.reduce((s, p) => s + p.targetDays, 0);
    const contractGap = totalContractDays ? totalContractDays - totalPlanned : null;
    const contractPct = totalContractDays ? Math.round((totalPlanned / totalContractDays) * 100) : null;

    async function createPlan() {
        if (!newMonth) return;
        setCreating(true);
        try {
            const res = await fetch('/api/mission-month-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ missionId, month: newMonth, targetDays: newTargetDays }),
            });
            const json = await res.json();
            if (json.success) {
                setPlans((prev) => [...prev, json.data].sort((a, b) => a.month.localeCompare(b.month)));
                setShowCreate(false);
                setNewMonth('');
                showSuccess('Plan créé', `Plan ${formatMonthLabel(newMonth)} créé`);
            } else {
                showError('Erreur', json.error);
            }
        } finally {
            setCreating(false);
        }
    }

    async function updateTargetDays(planId: string, targetDays: number) {
        setSavingId(planId);
        try {
            const res = await fetch(`/api/mission-month-plans/${planId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetDays }),
            });
            const json = await res.json();
            if (json.success) {
                setPlans((prev) => prev.map((p) => p.id === planId ? { ...p, targetDays } : p));
            }
        } finally {
            setSavingId(null);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Contract progress bar */}
            {totalContractDays && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Contrat total</span>
                        <span className={cn(
                            'text-sm font-semibold',
                            contractGap && contractGap > 0 ? 'text-amber-600' : 'text-green-600'
                        )}>
                            {totalPlanned}/{totalContractDays}j
                        </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                'h-full rounded-full transition-all',
                                totalPlanned >= totalContractDays ? 'bg-green-500' : 'bg-blue-500'
                            )}
                            style={{ width: `${Math.min(100, contractPct ?? 0)}%` }}
                        />
                    </div>
                    {contractGap && contractGap > 0 ? (
                        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {contractGap}j non planifiés sur la durée totale
                        </p>
                    ) : (
                        <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Contrat entièrement planifié
                        </p>
                    )}
                </div>
            )}

            {/* Month pills strip */}
            {plans.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {plans.map((plan) => {
                        const status = monthPillStatus(plan, plan.month);
                        return (
                            <button
                                key={plan.id}
                                onClick={() => onMonthClick?.(plan.month)}
                                className={cn(
                                    'px-3 py-1 rounded-full text-xs font-medium border transition-all hover:shadow-sm',
                                    status === 'complete' && 'bg-green-50 text-green-700 border-green-200',
                                    status === 'understaffed' && 'bg-amber-50 text-amber-700 border-amber-200',
                                    status === 'unplanned' && 'bg-gray-100 text-gray-500 border-gray-200',
                                )}
                            >
                                {formatMonthLabel(plan.month)} — {plan.targetDays}j
                                {status === 'complete' && ' ✓'}
                                {status === 'understaffed' && ' ⚠'}
                                {status === 'unplanned' && ' ○'}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Plan list */}
            {plans.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Mois</th>
                                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Objectif</th>
                                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Alloués</th>
                                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {plans.map((plan) => {
                                const totalAlloc = plan.allocations.reduce((s, a) => s + a.allocatedDays, 0);
                                const gap = plan.targetDays - totalAlloc;
                                const isSaving = savingId === plan.id;
                                return (
                                    <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-800 capitalize">
                                            {formatMonthLabel(plan.month)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => updateTargetDays(plan.id, Math.max(0, plan.targetDays - 1))}
                                                    className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-500"
                                                    disabled={isSaving}
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="w-8 text-center font-mono text-sm">
                                                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : `${plan.targetDays}j`}
                                                </span>
                                                <button
                                                    onClick={() => updateTargetDays(plan.id, plan.targetDays + 1)}
                                                    className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-500"
                                                    disabled={isSaving}
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <span className={cn(
                                                totalAlloc < plan.targetDays && 'text-amber-600 font-medium',
                                                totalAlloc >= plan.targetDays && 'text-green-600 font-medium',
                                            )}>
                                                {totalAlloc}/{plan.targetDays}j
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {totalAlloc === 0 ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                                    <Circle className="w-3 h-3" /> Non staffé
                                                </span>
                                            ) : gap > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                                    <AlertTriangle className="w-3 h-3" /> {gap}j manquants
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                                    <CheckCircle2 className="w-3 h-3" /> Complet
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create new plan */}
            {showCreate ? (
                <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-medium text-gray-800">Nouveau plan mensuel</h3>
                    <div className="flex items-center gap-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Mois</label>
                            <input
                                type="month"
                                value={newMonth}
                                onChange={(e) => setNewMonth(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Objectif (jours)</label>
                            <input
                                type="number"
                                min={0}
                                value={newTargetDays}
                                onChange={(e) => setNewTargetDays(parseInt(e.target.value) || 0)}
                                className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={createPlan} disabled={creating || !newMonth}>
                            {creating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                            Créer le plan
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
                            Annuler
                        </Button>
                    </div>
                </div>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={() => setShowCreate(true)}
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter un plan mensuel
                </Button>
            )}
        </div>
    );
}
