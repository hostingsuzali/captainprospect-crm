'use client';

import { ChevronLeft, ChevronRight, AlertTriangle, CalendarDays, RefreshCw } from 'lucide-react';
import { usePlanningMonth } from './PlanningMonthContext';
import { formatMonthLabel, prevMonth as prevMonthFn, nextMonth as nextMonthFn } from './planning-utils';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export function StickyHeader() {
    const { month, setMonth, snapshot, loading, drawerOpen, setDrawerOpen, reload } = usePlanningMonth();
    const [refreshing, setRefreshing] = useState(false);
    const [shakeConflicts, setShakeConflicts] = useState(false);

    const health = snapshot?.healthSummary;
    const cSum = snapshot?.conflictSummary;

    const totalMissions = (health?.missions.active ?? 0) + (health?.missions.noSdr ?? 0);
    const totalSdrs = (health?.sdrs.optimal ?? 0) + (health?.sdrs.overloaded ?? 0) + (health?.sdrs.underutilized ?? 0);

    const stripColor = !health
        ? 'bg-slate-200'
        : (health.sdrs.overloaded > 0 || health.missions.noSdr > 0)
            ? 'bg-gradient-to-r from-red-400 via-amber-400 to-green-400'
            : health.missions.understaffed > 0
                ? 'bg-gradient-to-r from-amber-400 to-green-400'
                : 'bg-green-400';

    async function handleRefresh() {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
    }

    const today = new Date();
    const isCurrentMonth = month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    useEffect(() => {
        if (cSum && cSum.P0 > 0) {
            setShakeConflicts(true);
            const t = setTimeout(() => setShakeConflicts(false), 800);
            return () => clearTimeout(t);
        }
        return;
    }, [cSum?.P0]);

    return (
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
            <div className="px-6 py-3">
                <div className="flex items-center justify-between gap-4">
                    {/* Left — Month navigation */}
                    <div className="flex items-center gap-3">
                        <CalendarDays className="w-5 h-5 text-indigo-500" />
                        <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                            <button
                                onClick={() => setMonth(prevMonthFn(month))}
                                className="p-2 hover:bg-slate-100 border-r border-slate-200 text-slate-500 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-5 py-1.5 text-sm font-bold text-slate-800 min-w-[150px] text-center capitalize select-none">
                                {formatMonthLabel(month)}
                            </span>
                            <button
                                onClick={() => setMonth(nextMonthFn(month))}
                                className="p-2 hover:bg-slate-100 border-l border-slate-200 text-slate-500 transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        {!isCurrentMonth && (
                            <button
                                onClick={() => {
                                    const d = new Date();
                                    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                                }}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                            >
                                Aujourd&apos;hui
                            </button>
                        )}
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors disabled:opacity-30"
                            title="Rafraîchir"
                        >
                            <RefreshCw className={cn('w-4 h-4', (refreshing || loading) && 'animate-spin')} />
                        </button>
                    </div>

                    {/* Right — Conflict toggle */}
                    <div className="flex items-center gap-2">
                        {cSum && cSum.total > 0 && (
                            <button
                                onClick={() => setDrawerOpen(!drawerOpen)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all',
                                    drawerOpen
                                        ? 'bg-red-100 text-red-800 border-red-200'
                                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                                    shakeConflicts && 'animate-bounce',
                                )}
                            >
                                <AlertTriangle className="w-4 h-4" />
                                {cSum.total} conflit{cSum.total !== 1 ? 's' : ''}
                                {cSum.P0 > 0 && (
                                    <span className="bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center ml-0.5">
                                        {cSum.P0}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Health summary pills */}
                {health && !loading && (
                    <div className="flex items-center gap-4 mt-2.5 text-xs flex-wrap">
                        <div className="flex items-center gap-2 text-slate-500">
                            <span className="font-semibold text-slate-700">{totalMissions} mission{totalMissions !== 1 ? 's' : ''}</span>
                            <Pill count={health.missions.complete} label="complètes" color="emerald" />
                            {health.missions.understaffed > 0 && (
                                <Pill count={health.missions.understaffed} label="à compléter" color="amber" />
                            )}
                            {health.missions.noSdr > 0 && (
                                <Pill count={health.missions.noSdr} label="sans SDR" color="red" />
                            )}
                        </div>
                        <div className="w-px h-4 bg-slate-200" />
                        <div className="flex items-center gap-2 text-slate-500">
                            <span className="font-semibold text-slate-700">{totalSdrs} SDR{totalSdrs !== 1 ? 's' : ''}</span>
                            <Pill count={health.sdrs.optimal} label="optimaux" color="emerald" />
                            {health.sdrs.overloaded > 0 && (
                                <Pill count={health.sdrs.overloaded} label="surchargés" color="red" />
                            )}
                            {health.sdrs.underutilized > 0 && (
                                <Pill count={health.sdrs.underutilized} label="sous-utilisés" color="blue" />
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div
                className={cn('h-1 w-full transition-colors', stripColor)}
                title="Barre de santé: rouge = risques forts, ambre = points à surveiller, vert = planning sain"
            />
        </div>
    );
}

function Pill({ count, label, color }: { count: number; label: string; color: 'emerald' | 'amber' | 'red' | 'blue' }) {
    if (count === 0) return null;
    const colors = {
        emerald: 'bg-emerald-100 text-emerald-700',
        amber: 'bg-amber-100 text-amber-700',
        red: 'bg-red-100 text-red-700',
        blue: 'bg-blue-100 text-blue-700',
    };
    return (
        <span className={cn('px-2 py-0.5 rounded-full font-medium', colors[color])}>
            {count} {label}
        </span>
    );
}
