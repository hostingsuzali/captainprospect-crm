'use client';

import { useState, useMemo } from 'react';
import { Search, Target, SlidersHorizontal, Loader2 } from 'lucide-react';
import { usePlanningMonth, type SnapshotMission } from './PlanningMonthContext';
import { MissionCard } from './MissionCard';
import { cn } from '@/lib/utils';

type FilterKey = 'all' | 'no-plan' | 'understaffed' | 'complete';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'Toutes' },
    { key: 'no-plan', label: 'Sans plan' },
    { key: 'understaffed', label: 'Incomplètes' },
    { key: 'complete', label: 'Complètes' },
];

export function MissionPanel() {
    const { snapshot, loading, month } = usePlanningMonth();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterKey>('all');

    const missions = useMemo(() => {
        if (!snapshot) return [];
        let list = [...snapshot.missions];

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (m) =>
                    m.name.toLowerCase().includes(q) ||
                    m.client.name.toLowerCase().includes(q)
            );
        }

        if (filter === 'no-plan') {
            list = list.filter((m) => !m.missionMonthPlans.find((p) => p.month === month));
        } else if (filter === 'understaffed') {
            list = list.filter((m) => {
                const plan = m.missionMonthPlans.find((p) => p.month === month);
                if (!plan) return false;
                const alloc = plan.allocations.reduce((s, a) => s + a.allocatedDays, 0);
                return alloc < plan.targetDays;
            });
        } else if (filter === 'complete') {
            list = list.filter((m) => {
                const plan = m.missionMonthPlans.find((p) => p.month === month);
                if (!plan) return false;
                const alloc = plan.allocations.reduce((s, a) => s + a.allocatedDays, 0);
                return alloc === plan.targetDays && plan.targetDays > 0;
            });
        }

        list.sort((a, b) => missionSortScore(a, month) - missionSortScore(b, month));
        return list;
    }, [snapshot, search, month, filter]);

    const totalCount = snapshot?.missions.length ?? 0;
    const noPlanCount = snapshot?.missions.filter((m) => !m.missionMonthPlans.find((p) => p.month === month)).length ?? 0;

    return (
        <div className="flex flex-col h-full">
            {/* Header bar */}
            <div className="px-4 py-3 border-b border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Missions</h3>
                        {!loading && <span className="text-[10px] text-slate-400">{missions.length}/{totalCount}</span>}
                    </div>
                    {noPlanCount > 0 && !loading && (
                        <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            {noPlanCount} sans plan
                        </span>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher une mission..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none transition"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-1">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={cn(
                                'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors',
                                filter === f.key
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'text-slate-500 hover:bg-slate-100'
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Mission list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                        <p className="text-xs">Chargement des missions...</p>
                    </div>
                )}
                {!loading && missions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <Target className="w-10 h-10 mb-3 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">
                            {filter !== 'all' ? 'Aucune mission correspondante' : 'Aucune mission active ce mois'}
                        </p>
                        <p className="text-xs mt-1 text-slate-400">
                            {filter !== 'all'
                                ? 'Essayez de changer le filtre.'
                                : 'Les missions actives dont la période couvre ce mois apparaîtront ici.'}
                        </p>
                    </div>
                )}
                {missions.map((m) => (
                    <MissionCard key={m.id} mission={m} />
                ))}
            </div>
        </div>
    );
}

function missionSortScore(m: SnapshotMission, month: string): number {
    const plan = m.missionMonthPlans.find((p) => p.month === month);
    if (!plan) return 0; // no plan → top priority
    const allocated = plan.allocations.reduce((s, a) => s + a.allocatedDays, 0);
    if (allocated === 0 && plan.targetDays > 0) return 1;
    if (allocated < plan.targetDays) return 2;
    return 3;
}
