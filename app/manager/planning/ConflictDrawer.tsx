'use client';

import { useState } from 'react';
import { X, AlertTriangle, AlertCircle, Info, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlanningMonth, type PlanningConflict } from './PlanningMonthContext';

const SEVERITY_CONFIG = {
    P0: { label: 'Critique', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-600' },
    P1: { label: 'Important', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-500' },
    P2: { label: 'Info', icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-500' },
} as const;

export function ConflictDrawer() {
    const { drawerOpen, setDrawerOpen, snapshot, resolveConflict } = usePlanningMonth();
    const conflicts = snapshot?.conflicts ?? [];

    const grouped = {
        P0: conflicts.filter((c) => c.severity === 'P0'),
        P1: conflicts.filter((c) => c.severity === 'P1'),
        P2: conflicts.filter((c) => c.severity === 'P2'),
    };
    const p0Count = grouped.P0.length;

    return (
        <>
            {/* Backdrop */}
            {drawerOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 lg:hidden"
                    onClick={() => setDrawerOpen(false)}
                />
            )}

            {/* Drawer */}
            <div
                className={cn(
                    'fixed top-0 right-0 h-full bg-white border-l border-slate-200 shadow-2xl z-50 transition-transform duration-300 w-full max-w-md',
                    drawerOpen ? 'translate-x-0' : 'translate-x-full'
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            {p0Count > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                            )}
                        </div>
                        <h2 className="font-semibold text-slate-900">Conflits</h2>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            {conflicts.length}
                        </span>
                    </div>
                    <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto h-[calc(100vh-65px)] px-5 py-4 space-y-5">
                    {conflicts.length === 0 && (
                        <div className="flex flex-col items-center py-16 text-slate-400">
                            <Check className="w-12 h-12 mb-3 text-emerald-400" />
                            <p className="text-sm font-medium text-emerald-600">Aucun conflit</p>
                            <p className="text-xs mt-1">Tout est en ordre ce mois-ci.</p>
                        </div>
                    )}

                    {(['P0', 'P1', 'P2'] as const).map((severity) => {
                        const items = grouped[severity];
                        if (items.length === 0) return null;
                        const cfg = SEVERITY_CONFIG[severity];
                        return (
                            <div key={severity}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={cn('w-2 h-2 rounded-full', cfg.badge)} />
                                    <span className={cn('text-xs font-semibold uppercase tracking-wider', cfg.color)}>
                                        {cfg.label} ({items.length})
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {items.map((conflict) => (
                                        <ConflictEntry key={conflict.id} conflict={conflict} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

function ConflictEntry({ conflict }: { conflict: PlanningConflict }) {
    const { setFocusedMissionId, setFocusedSdrId, setDrawerOpen, resolveConflict } = usePlanningMonth();
    const cfg = SEVERITY_CONFIG[conflict.severity];
    const Icon = cfg.icon;

    function handleFocus() {
        if (conflict.missionId) setFocusedMissionId(conflict.missionId);
        if (conflict.sdrId) setFocusedSdrId(conflict.sdrId);
        setDrawerOpen(false);
    }

    const [confirming, setConfirming] = useState(false);

    function handleResolve() {
        if (!confirming) {
            setConfirming(true);
            return;
        }
        resolveConflict(conflict.id);
    }

    return (
        <div className={cn('rounded-lg border p-3', cfg.bg, cfg.border)}>
            <div className="flex items-start gap-2">
                <div className="relative flex-shrink-0 mt-0.5">
                    <Icon className={cn('w-4 h-4', cfg.color)} />
                    {conflict.severity === 'P0' && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800">{conflict.message}</p>
                    {conflict.suggestedAction && (
                        <button
                            onClick={handleFocus}
                            className="mt-1.5 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md px-2 py-1 flex items-center gap-1 transition-colors"
                        >
                            {conflict.suggestedAction} <ArrowRight className="w-3 h-3" />
                        </button>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                        {!conflict.suggestedAction && (
                            <button
                                onClick={handleFocus}
                                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                            >
                                Voir <ArrowRight className="w-3 h-3" />
                            </button>
                        )}
                        <button
                            onClick={handleResolve}
                            className={cn(
                                'text-[11px] font-medium flex items-center gap-0.5',
                                confirming ? 'text-red-600' : 'text-slate-500 hover:text-slate-700',
                            )}
                        >
                            <Check className="w-3 h-3" /> {confirming ? 'Confirmer ?' : 'Résoudre'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
