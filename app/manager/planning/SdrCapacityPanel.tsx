'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────
interface SdrAbsence {
    id: string;
    startDate: string;
    endDate: string;
    type: 'VACATION' | 'SICK' | 'TRAINING' | 'PUBLIC_HOLIDAY' | 'PARTIAL';
    impactsPlanning: boolean;
    note: string | null;
}

interface SdrCapacity {
    id: string;
    month: string;
    baseWorkingDays: number;
    effectiveAvailableDays: number;
}

interface SdrCapacityPanelProps {
    sdrId: string;
    sdrName: string;
    month: string;
    onCapacityChange?: () => void;
}

const ABSENCE_TYPE_LABELS = {
    VACATION: 'Congés',
    SICK: 'Maladie',
    TRAINING: 'Formation',
    PUBLIC_HOLIDAY: 'Jour férié',
    PARTIAL: 'Partiel',
};

const ABSENCE_TYPE_COLORS = {
    VACATION: 'bg-blue-100 text-blue-700',
    SICK: 'bg-red-100 text-red-700',
    TRAINING: 'bg-purple-100 text-purple-700',
    PUBLIC_HOLIDAY: 'bg-gray-100 text-gray-700',
    PARTIAL: 'bg-orange-100 text-orange-700',
};

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ── Component ──────────────────────────────────────────────────────────
export default function SdrCapacityPanel({
    sdrId,
    sdrName,
    month,
    onCapacityChange,
}: SdrCapacityPanelProps) {
    const { success: showSuccess, error: showError } = useToast();
    const [capacity, setCapacity] = useState<SdrCapacity | null>(null);
    const [absences, setAbsences] = useState<SdrAbsence[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingCapacity, setSavingCapacity] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showAddAbsence, setShowAddAbsence] = useState(false);
    const [newAbsence, setNewAbsence] = useState({
        startDate: '',
        endDate: '',
        type: 'VACATION' as keyof typeof ABSENCE_TYPE_LABELS,
        impactsPlanning: true,
        note: '',
    });
    const [addingAbsence, setAddingAbsence] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [capRes, absRes] = await Promise.all([
                fetch(`/api/sdr-capacity?sdrId=${sdrId}&month=${month}`),
                fetch(`/api/sdr-absences?sdrId=${sdrId}&month=${month}`),
            ]);
            const capJson = await capRes.json();
            const absJson = await absRes.json();
            if (capJson.success) setCapacity(capJson.data[0] ?? null);
            if (absJson.success) setAbsences(absJson.data);
        } finally {
            setLoading(false);
        }
    }, [sdrId, month]);

    useEffect(() => { load(); }, [load]);

    async function upsertCapacity(baseWorkingDays: number) {
        setSavingCapacity(true);
        try {
            const res = await fetch('/api/sdr-capacity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sdrId, month, baseWorkingDays }),
            });
            const json = await res.json();
            if (json.success) {
                setCapacity(json.data);
                onCapacityChange?.();
            }
        } finally {
            setSavingCapacity(false);
        }
    }

    async function addAbsence() {
        if (!newAbsence.startDate || !newAbsence.endDate) return;
        setAddingAbsence(true);
        try {
            const res = await fetch('/api/sdr-absences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sdrId, ...newAbsence }),
            });
            const json = await res.json();
            if (json.success) {
                await load();
                setShowAddAbsence(false);
                setNewAbsence({ startDate: '', endDate: '', type: 'VACATION', impactsPlanning: true, note: '' });
                onCapacityChange?.();
                showSuccess('Absence ajoutée');
            } else {
                showError('Erreur', json.error);
            }
        } finally {
            setAddingAbsence(false);
        }
    }

    async function deleteAbsence(id: string) {
        setDeletingId(id);
        try {
            await fetch(`/api/sdr-absences/${id}`, { method: 'DELETE' });
            setAbsences((prev) => prev.filter((a) => a.id !== id));
            await load();
            onCapacityChange?.();
        } finally {
            setDeletingId(null);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
        );
    }

    const absenceDays = absences
        .filter((a) => a.impactsPlanning)
        .reduce((s, a) => {
            const start = new Date(a.startDate);
            const end = new Date(a.endDate);
            return s + Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
        }, 0);

    return (
        <div className="space-y-4">
            {/* Capacity row */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Capacité — {sdrName}</span>
                    {savingCapacity && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Jours ouvrés</p>
                        <input
                            type="number"
                            min={0}
                            max={31}
                            value={capacity?.baseWorkingDays ?? ''}
                            onChange={(e) => {
                                const v = parseInt(e.target.value);
                                if (!isNaN(v)) upsertCapacity(v);
                            }}
                            className="w-full text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="—"
                        />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Absences (j)</p>
                        <div className="border border-amber-200 bg-amber-50 rounded-lg px-2 py-1.5 text-sm font-mono text-amber-700 text-center">
                            {absenceDays}j
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Dispo réelle</p>
                        <div className={cn(
                            'border rounded-lg px-2 py-1.5 text-sm font-mono text-center font-semibold',
                            capacity
                                ? capacity.effectiveAvailableDays > 0
                                    ? 'border-green-200 bg-green-50 text-green-700'
                                    : 'border-red-200 bg-red-50 text-red-700'
                                : 'border-gray-200 bg-gray-50 text-gray-400'
                        )}>
                            {capacity ? `${capacity.effectiveAvailableDays}j` : '—'}
                        </div>
                    </div>
                </div>
                {!capacity && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Définir la capacité pour activer le suivi de charge
                    </p>
                )}
            </div>

            {/* Absences list */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        Absences ce mois
                    </h4>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setShowAddAbsence(true)}
                    >
                        <Plus className="w-3 h-3 mr-1" /> Ajouter
                    </Button>
                </div>

                {absences.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">Aucune absence ce mois</p>
                ) : (
                    <div className="space-y-2">
                        {absences.map((abs) => (
                            <div
                                key={abs.id}
                                className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2"
                            >
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        'text-xs px-2 py-0.5 rounded-full font-medium',
                                        ABSENCE_TYPE_COLORS[abs.type]
                                    )}>
                                        {ABSENCE_TYPE_LABELS[abs.type]}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                        {formatDate(abs.startDate)}
                                        {abs.startDate !== abs.endDate && ` → ${formatDate(abs.endDate)}`}
                                    </span>
                                    {!abs.impactsPlanning && (
                                        <span className="text-xs text-gray-400">(hors planning)</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        if (deletingId === abs.id) {
                                            void deleteAbsence(abs.id);
                                        } else {
                                            setDeletingId(abs.id);
                                        }
                                    }}
                                    className={cn(
                                        'transition-colors',
                                        deletingId === abs.id
                                            ? 'text-red-600'
                                            : 'text-gray-300 hover:text-red-400',
                                    )}
                                >
                                    {deletingId === abs.id
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Trash2 className="w-3.5 h-3.5" />
                                    }
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add absence form */}
            {showAddAbsence && (
                <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-medium text-gray-800">Nouvelle absence</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Date début</label>
                            <input
                                type="date"
                                value={newAbsence.startDate}
                                onChange={(e) => setNewAbsence((p) => ({ ...p, startDate: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Date fin</label>
                            <input
                                type="date"
                                value={newAbsence.endDate}
                                onChange={(e) => setNewAbsence((p) => ({ ...p, endDate: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Type</label>
                            <select
                                value={newAbsence.type}
                                onChange={(e) => setNewAbsence((p) => ({ ...p, type: e.target.value as keyof typeof ABSENCE_TYPE_LABELS }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                                {Object.entries(ABSENCE_TYPE_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end pb-1.5">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newAbsence.impactsPlanning}
                                    onChange={(e) => setNewAbsence((p) => ({ ...p, impactsPlanning: e.target.checked }))}
                                    className="rounded"
                                />
                                <span className="text-xs text-gray-600">Impacte le planning</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={addAbsence} disabled={addingAbsence || !newAbsence.startDate}>
                            {addingAbsence ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                            Ajouter
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddAbsence(false)}>
                            Annuler
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
