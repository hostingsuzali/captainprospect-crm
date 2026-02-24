'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, Users, Search, Loader2 } from 'lucide-react';
import { usePlanningMonth, type SnapshotSdr } from './PlanningMonthContext';
import { SdrRow } from './SdrRow';
import { getSdrStatus } from './planning-utils';
import { cn } from '@/lib/utils';

type SortKey = 'load-desc' | 'load-asc' | 'name' | 'available';

const SORTS: Array<{ key: SortKey; label: string }> = [
    { key: 'load-desc', label: 'Charge ↓' },
    { key: 'load-asc', label: 'Charge ↑' },
    { key: 'available', label: 'Dispo ↓' },
    { key: 'name', label: 'Nom A-Z' },
];

export function TeamPanel() {
    const { snapshot, loading } = usePlanningMonth();
    const [sortBy, setSortBy] = useState<SortKey>('load-desc');
    const [search, setSearch] = useState('');

    const sdrs = useMemo(() => {
        if (!snapshot) return [];
        let list = [...snapshot.sdrs];

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
        }

        list.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'available') return sdrAvailable(b) - sdrAvailable(a);
            const loadA = sdrLoad(a);
            const loadB = sdrLoad(b);
            return sortBy === 'load-desc' ? loadB - loadA : loadA - loadB;
        });
        return list;
    }, [snapshot, sortBy, search]);

    const overloadedCount = snapshot?.sdrs.filter((s) => {
        const cap = s.sdrMonthCapacities[0]?.effectiveAvailableDays ?? 0;
        const alloc = s.sdrDayAllocations.reduce((sum, a) => sum + a.allocatedDays, 0);
        return cap > 0 && alloc > cap;
    }).length ?? 0;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Équipe</h3>
                        {!loading && <span className="text-[10px] text-slate-400">{sdrs.length} SDR{sdrs.length !== 1 ? 's' : ''}</span>}
                    </div>
                    {overloadedCount > 0 && !loading && (
                        <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            {overloadedCount} surchargé{overloadedCount !== 1 ? 's' : ''}
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
                        placeholder="Rechercher un SDR..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 outline-none transition"
                    />
                </div>

                {/* Sort chips */}
                <div className="flex items-center gap-1">
                    {SORTS.map((s) => (
                        <button
                            key={s.key}
                            onClick={() => setSortBy(s.key)}
                            className={cn(
                                'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors',
                                sortBy === s.key
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'text-slate-500 hover:bg-slate-100'
                            )}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* SDR list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                        <p className="text-xs">Chargement de l&apos;équipe...</p>
                    </div>
                )}
                {!loading && sdrs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <Users className="w-10 h-10 mb-3 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">Aucun SDR actif</p>
                        <p className="text-xs mt-1">Les SDRs avec le rôle SDR/BD apparaîtront ici.</p>
                    </div>
                )}
                {sdrs.map((s) => (
                    <SdrRow key={s.id} sdr={s} />
                ))}
            </div>
        </div>
    );
}

function sdrLoad(sdr: SnapshotSdr): number {
    const cap = sdr.sdrMonthCapacities[0]?.effectiveAvailableDays ?? 0;
    if (cap === 0) return 0;
    const alloc = sdr.sdrDayAllocations.reduce((s, a) => s + a.allocatedDays, 0);
    return alloc / cap;
}

function sdrAvailable(sdr: SnapshotSdr): number {
    const cap = sdr.sdrMonthCapacities[0]?.effectiveAvailableDays ?? 0;
    const alloc = sdr.sdrDayAllocations.reduce((s, a) => s + a.allocatedDays, 0);
    return cap - alloc;
}
