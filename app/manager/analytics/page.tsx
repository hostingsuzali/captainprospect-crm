"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Calendar, Download, RefreshCw, Target, User, Briefcase, TrendingUp, X, Phone, Clock, Search,
    Activity, BrainCircuit, Zap, Flame, Trophy, Play, CheckCircle2, LayoutDashboard, Sparkles
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";
import { cn } from "@/lib/utils";
import { ACTION_RESULT_LABELS } from "@/lib/types";
import { DataTable } from "@/components/ui/DataTable";

const SDR_COLORS: Record<string, string> = {
    'Mathieu Deville': '#7C5CFC', // updated to violet
    'Rayan': '#059669', // emerald
    'Anaïs': '#A78BFA', // lighter violet
};
const getSdrColor = (name: string) => SDR_COLORS[name] || '#94A3B8';

export default function AnalyticsPage() {
    // Filters State
    const [dateRange, setDateRange] = useState({
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });
    const [selectedSdrs, setSelectedSdrs] = useState<string[]>([]);
    const [selectedMissions, setSelectedMissions] = useState<string[]>([]);
    const [selectedClients, setSelectedClients] = useState<string[]>([]);

    // Data State
    const [stats, setStats] = useState<any>(null);
    const [missions, setMissions] = useState<any[]>([]);
    const [sdrs, setSdrs] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Actions State for the Journal
    const [actions, setActions] = useState<any[]>([]);
    const [isLoadingActions, setIsLoadingActions] = useState(true);
    const [journalFilter, setJournalFilter] = useState<string>('all');

    // UI State
    const [aiRefreshCount, setAiRefreshCount] = useState(0);

    // Fetch Reference Data
    useEffect(() => {
        const fetchRefs = async () => {
            try {
                const [mRes, sRes, cRes] = await Promise.all([
                    fetch('/api/missions?isActive=true'),
                    fetch('/api/users?role=SDR,BUSINESS_DEVELOPER&limit=100'),
                    fetch('/api/clients?limit=100')
                ]);
                const [mJson, sJson, cJson] = await Promise.all([mRes.json(), sRes.json(), cRes.json()]);

                if (mJson.success) setMissions(mJson.data || []);
                if (sJson.success) setSdrs(sJson.data?.users || sJson.users || []);
                if (cJson.success) setClients(cJson.data || []);
            } catch (err) {
                console.error("Refs fetch error:", err);
            }
        };
        fetchRefs();
    }, []);

    // Fetch Stats Data
    const fetchStats = async () => {
        setIsRefreshing(true);
        try {
            const params = new URLSearchParams();
            params.set('from', dateRange.from);
            params.set('to', dateRange.to);
            selectedSdrs.forEach(id => params.append('sdrIds[]', id));
            selectedMissions.forEach(id => params.append('missionIds[]', id));
            selectedClients.forEach(id => params.append('clientIds[]', id));

            const res = await fetch(`/api/analytics/stats?${params.toString()}`);
            const json = await res.json();
            if (json.success) {
                setStats(json.data);
            }
        } catch (err) {
            console.error("Stats fetch error:", err);
        } finally {
            setIsRefreshing(false);
            setIsLoading(false);
        }
    };

    // Fetch Actions Data (Journal)
    const fetchActions = async () => {
        setIsLoadingActions(true);
        try {
            const params = new URLSearchParams();
            params.set('from', dateRange.from);
            params.set('to', dateRange.to);
            params.set('limit', '500');
            selectedSdrs.forEach(id => params.append('sdrIds[]', id));
            selectedMissions.forEach(id => params.append('missionIds[]', id));
            selectedClients.forEach(id => params.append('clientIds[]', id));

            const res = await fetch(`/api/analytics/actions?${params.toString()}`);
            const json = await res.json();
            if (json.success) {
                setActions(json.data);
            }
        } catch (err) {
            console.error("Actions fetch error:", err);
        } finally {
            setIsLoadingActions(false);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchActions();
    }, [dateRange, selectedSdrs, selectedMissions, selectedClients]);

    // Data Formatting
    const dailyData = useMemo(() => {
        if (!stats?.charts?.daily) return [];
        return stats.charts.daily.map((d: any) => ({
            name: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
            calls: d.calls,
            meetings: d.meetings,
        }));
    }, [stats]);

    // Derived AI Summary Text
    const aiSummary = useMemo(() => {
        if (!stats) return "Analyse en cours...";
        const calls = stats.kpis?.totalCalls || 0;
        const meetings = stats.kpis?.meetings || 0;
        const noRespRate = calls > 0 ? Math.round(((stats.statusBreakdown?.['NO_RESPONSE'] || 0) / calls) * 100) : 0;
        const topSdr = stats.sdrPerformance?.[0];
        const topSdrText = topSdr ? `**${topSdr.sdrName}** représente une part majeure du volume.` : '';

        const texts = [
            `Sur cette période, l'équipe a réalisé **${calls} appels**. Le taux de non-réponse est de **${noRespRate}%**. ${topSdrText} ${meetings} meetings ont été bookés : les **${stats.funnel?.opportunities || 0} rappels en attente** sont des opportunités immédiates à saisir cette semaine.`,
            `L'analyse révèle un volume d'appels de **${calls}** et un funnel de conversion avec **${meetings} meetings**. Les **${stats.funnel?.opportunities || 0} rappels en attente** sont la priorité immédiate. ${topSdrText} Il est conseillé de réviser le pitch pour maximiser la conversion.`,
        ];
        return texts[aiRefreshCount % texts.length];
    }, [stats, aiRefreshCount]);

    // Handle Journal Filtering
    const filteredActions = useMemo(() => {
        if (journalFilter === 'all') return actions;
        if (journalFilter === 'meetings') return actions.filter(a => a.result === 'MEETING_BOOKED');
        if (journalFilter === 'callbacks') return actions.filter(a => a.result === 'CALLBACK_REQUESTED' || a.result === 'INTERESTED');
        if (journalFilter === 'disqualified') return actions.filter(a => a.result === 'DISQUALIFIED');
        if (journalFilter === 'no_response') return actions.filter(a => a.result === 'NO_RESPONSE');
        return actions;
    }, [actions, journalFilter]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-40" style={{ background: "#F4F6FA", minHeight: "100vh" }}>
                <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
                    <RefreshCw className="w-7 h-7 text-violet-600 animate-spin" />
                </div>
                <p className="text-[13px] text-slate-400 font-medium">Chargement des analytics...</p>
            </div>
        );
    }

    const { kpis, segments, funnel, sdrPerformance, missionStates } = stats || {};
    const totalCalls = kpis?.totalCalls || 1; // Prevent division by 0
    const noRespCount = stats?.statusBreakdown?.['NO_RESPONSE'] || 0;
    const disqCount = stats?.statusBreakdown?.['DISQUALIFIED'] || 0;
    const cbackCount = stats?.statusBreakdown?.['CALLBACK_REQUESTED'] || 0;
    const intCount = stats?.statusBreakdown?.['INTERESTED'] || 0;
    const totalCbacks = cbackCount + intCount;
    const stdCount = totalCalls - noRespCount - disqCount - totalCbacks - (kpis?.meetings || 0);

    // Heatmap Config
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

    return (
        <div className="min-h-full p-5 lg:p-6 pb-20 overflow-x-hidden" style={{ background: "linear-gradient(160deg, #F4F6FA 0%, #EEF2FF 100%)", fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* Page Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <Activity className="w-4 h-4 text-white" />
                        </div>
                        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Analytics & Performance</h1>
                    </div>
                    <p className="text-[12px] text-slate-400 ml-10 font-medium">Suivi détaillé des appels et des résultats d'équipe</p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-2 px-3.5 py-2 text-[12px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-violet-300 transition-all">
                        <Calendar className="w-3.5 h-3.5 text-violet-500" />
                        <input
                            type="date"
                            value={dateRange.from}
                            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                            className="bg-transparent border-none p-0 outline-none hover:text-violet-600 transition-colors cursor-pointer"
                        />
                        <span className="text-slate-300 font-normal">→</span>
                        <input
                            type="date"
                            value={dateRange.to}
                            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                            className="bg-transparent border-none p-0 outline-none hover:text-violet-600 transition-colors cursor-pointer"
                        />
                    </div>

                    <button className="flex items-center gap-2 px-3.5 py-2 text-[12px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-violet-300 hover:shadow-sm transition-all shadow-sm">
                        <Download className="w-3.5 h-3.5 text-slate-400" /> Exporter
                    </button>
                    <button onClick={fetchStats} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-violet-600 hover:border-violet-300 hover:shadow-sm transition-all shadow-sm">
                        <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
                <div className="flex-1 min-w-[200px] flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 transition-all hover:border-violet-300 shadow-sm">
                    <div className="flex-1">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mission</span>
                        <select className="w-full bg-transparent border-none text-[13px] font-semibold text-slate-700 outline-none p-0 cursor-pointer" onChange={e => {
                            if (e.target.value === "all") setSelectedMissions([]);
                            else if (!selectedMissions.includes(e.target.value)) setSelectedMissions([e.target.value]);
                        }}>
                            <option value="all">Toutes les missions</option>
                            {(missions || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0"><Target className="w-4 h-4 text-indigo-500" /></div>
                </div>

                <div className="flex-1 min-w-[200px] flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 transition-all hover:border-violet-300 shadow-sm">
                    <div className="flex-1">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">SDR</span>
                        <select className="w-full bg-transparent border-none text-[13px] font-semibold text-slate-700 outline-none p-0 cursor-pointer" onChange={e => {
                            if (e.target.value === "all") setSelectedSdrs([]);
                            else if (!selectedSdrs.includes(e.target.value)) setSelectedSdrs([e.target.value]);
                        }}>
                            <option value="all">Toute l'équipe</option>
                            {(sdrs || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-emerald-500" /></div>
                </div>

                <div className="flex-1 min-w-[200px] flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 transition-all hover:border-violet-300 shadow-sm">
                    <div className="flex-1">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Client</span>
                        <select className="w-full bg-transparent border-none text-[13px] font-semibold text-slate-700 outline-none p-0 cursor-pointer" onChange={e => {
                            if (e.target.value === "all") setSelectedClients([]);
                            else if (!selectedClients.includes(e.target.value)) setSelectedClients([e.target.value]);
                        }}>
                            <option value="all">Tous les clients</option>
                            {(clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Briefcase className="w-4 h-4 text-amber-500" /></div>
                </div>
            </div>

            {/* AI Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8 mb-6 shadow-xl" style={{ background: "linear-gradient(145deg, #16103A 0%, #1A1040 40%, #08051E 100%)" }}>
                <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none" style={{ background: "radial-gradient(circle, #7C5CFC, transparent 70%)" }} />
                <div className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle, #A78BFA, transparent 70%)" }} />

                <button className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all text-[11px] font-semibold backdrop-blur-sm z-20" onClick={() => setAiRefreshCount(c => c + 1)}>
                    <RefreshCw className="w-3.5 h-3.5" /> Ré-analyser
                </button>

                <div className="relative z-10 flex items-center gap-3 mb-5">
                    <div className="flex items-center gap-2 bg-violet-600/30 border border-violet-500/50 text-violet-200 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                        ANALYSE IA
                    </div>
                    <span className="text-[13px] font-medium text-white/50">Résumé de la période</span>
                </div>

                <div className="relative z-10 text-[14.5px] leading-relaxed text-white/80 max-w-4xl font-medium" dangerouslySetInnerHTML={{ __html: aiSummary.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-extrabold">$1</strong>') }} />

                <div className="relative z-10 flex flex-wrap gap-4 mt-7">
                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-5 py-3 hover:bg-white/10 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center"><Phone className="w-4 h-4 text-red-400" /></div>
                        <div><div className="text-[18px] font-black text-white leading-none tracking-tight">{Math.round((noRespCount / totalCalls) * 100)}%</div><div className="text-[10px] text-white/50 uppercase tracking-widest mt-1">Non-réponse</div></div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-5 py-3 hover:bg-white/10 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center"><Activity className="w-4 h-4 text-blue-400" /></div>
                        <div><div className="text-[18px] font-black text-white leading-none tracking-tight">{kpis?.totalCalls || 0}</div><div className="text-[10px] text-white/50 uppercase tracking-widest mt-1">Appels passés</div></div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-5 py-3 hover:bg-white/10 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center"><Flame className="w-4 h-4 text-amber-400" /></div>
                        <div><div className="text-[18px] font-black text-white leading-none tracking-tight">{totalCbacks || 0}</div><div className="text-[10px] text-white/50 uppercase tracking-widest mt-1">Opp. à traiter</div></div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-5 py-3 hover:bg-white/10 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div>
                        <div><div className="text-[18px] font-black text-white leading-none tracking-tight">{kpis?.meetings || 0}</div><div className="text-[10px] text-white/50 uppercase tracking-widest mt-1">RDV Confirmés</div></div>
                    </div>
                    {sdrPerformance?.[0] && (
                        <div className="flex items-center gap-3 bg-violet-600/20 backdrop-blur-md border border-violet-500/30 rounded-xl px-5 py-3 ml-auto hover:bg-violet-600/30 transition-colors">
                            <div className="w-9 h-9 rounded-full bg-violet-500/30 flex items-center justify-center"><Trophy className="w-4 h-4 text-violet-300" /></div>
                            <div><div className="text-[18px] font-black text-white leading-none tracking-tight">{sdrPerformance[0].sdrName.split(' ')[0]}</div><div className="text-[10px] text-violet-300 uppercase tracking-widest mt-1 font-bold">Top SDR</div></div>
                        </div>
                    )}
                </div>
            </div>

            {/* KPI ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col justify-between group hover:shadow-md hover:border-violet-100 transition-all cursor-default">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center transition-transform group-hover:scale-110">
                            <Phone className="w-5 h-5 text-violet-600" />
                        </div>
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" />+12%</span>
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Total Appels</div>
                        <div className="text-[36px] font-black text-slate-800 leading-none tracking-tight">{kpis?.totalCalls || 0}</div>
                    </div>
                    <div className="h-10 mt-5 -mx-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyData}>
                                <defs><linearGradient id="gViolet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed" stopOpacity={0.2} /><stop offset="100%" stopColor="#7c3aed" stopOpacity={0} /></linearGradient></defs>
                                <Area type="monotone" dataKey="calls" stroke="#7c3aed" strokeWidth={2.5} fillOpacity={1} fill="url(#gViolet)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col justify-between group hover:shadow-md hover:border-emerald-100 transition-all cursor-default relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500"><Target className="w-24 h-24 text-emerald-900" /></div>
                    <div className="flex items-center justify-between mb-5 relative z-10">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center transition-transform group-hover:scale-110">
                            <Target className="w-5 h-5 text-emerald-600" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Meetings Bookés</div>
                        <div className="text-[36px] font-black text-slate-800 leading-none tracking-tight">{kpis?.meetings || 0}</div>
                    </div>
                    <div className="mt-6 relative z-10">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-2"><span>Objectif hebdo (10)</span><span className="text-slate-700">{Math.min(100, ((kpis?.meetings || 0) / 10) * 100).toFixed(0)}%</span></div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, ((kpis?.meetings || 0) / 10) * 100)}%` }} /></div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col justify-between group hover:shadow-md hover:border-indigo-100 transition-all cursor-default">
                    <div className="flex items-center justify-between mb-5">
                        <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center transition-transform group-hover:scale-110">
                            <Zap className="w-5 h-5 text-indigo-500" />
                        </div>
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 flex items-center gap-1"><TrendingUp className="w-3 h-3 rotate-180" />-2%</span>
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Taux de Conversion</div>
                        <div className="flex items-baseline gap-1">
                            <div className="text-[36px] font-black text-slate-800 leading-none tracking-tight">{kpis?.conversionRate || 0}</div>
                            <span className="text-[18px] font-bold text-slate-400">%</span>
                        </div>
                    </div>
                    <div className="mt-6">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-2"><span>Cible (3%)</span><span className="text-slate-700">{Math.min(100, ((kpis?.conversionRate || 0) / 3) * 100).toFixed(0)}%</span></div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, ((kpis?.conversionRate || 0) / 3) * 100)}%` }} /></div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col justify-between group hover:shadow-md hover:border-amber-100 transition-all cursor-default">
                    <div className="flex items-center justify-between mb-5">
                        <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center transition-transform group-hover:scale-110">
                            <Clock className="w-5 h-5 text-amber-500" />
                        </div>
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" />+8%</span>
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Temps de Talk Total</div>
                        <div className="flex items-baseline gap-1">
                            <div className="text-[36px] font-black text-slate-800 leading-none tracking-tight">{Math.round((kpis?.totalTalkTime || 0) / 60)}</div>
                            <span className="text-[18px] font-bold text-slate-400">min</span>
                        </div>
                    </div>
                    <div className="h-10 mt-5 hidden lg:block" /> {/* spacer for alignment without chart */}
                </div>
            </div>

            {/* Missions List */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm mb-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-violet-500" />
                        <h3 className="text-[16px] font-bold text-slate-800">Missions proches de l'objectif</h3>
                    </div>
                    <button className="text-[12px] font-bold text-violet-600 hover:text-violet-800 transition-colors">Voir toutes →</button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {(missionStates || []).map((m: any) => {
                        const mGoal = 5;
                        const pct = Math.min(100, (m.meetings / mGoal) * 100);
                        const isHot = pct >= 80;
                        return (
                            <div key={m.missionId} className="group p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="overflow-hidden">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            {isHot && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
                                            <div className="text-[14px] font-bold text-slate-800 truncate group-hover:text-violet-600 transition-colors">{m.missionName}</div>
                                        </div>
                                        <div className="text-[11.5px] text-slate-400 truncate flex items-center gap-1">
                                            <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", m.isActive ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                                                {m.isActive ? "ACTIF" : "PAUSE"}
                                            </span>
                                            · {m.clientName}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-[15px] font-black text-slate-700 leading-tight">{m.meetings}</div>
                                        <div className="text-[10px] font-bold text-slate-400">/ {mGoal} RDV</div>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: isHot ? "linear-gradient(90deg, #7C5CFC, #A78BFA)" : (pct >= 50 ? "#F59E0B" : "#CBD5E1") }} />
                                </div>
                                <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500">
                                    <div className="flex gap-3">
                                        <span><span className="text-blue-600 font-bold">{m.calls}</span> Appels</span>
                                        <span><span className="text-amber-500 font-bold">{m.callbacks}</span> Rappels</span>
                                    </div>
                                    <div className="flex">
                                        {m.sdrNames.slice(0, 3).map((name: string, i: number) => (
                                            <div key={i} className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-[7px] font-black text-white -ml-1.5 first:ml-0 shadow-sm" style={{ background: getSdrColor(name) }} title={name}>
                                                {name.substring(0, 2).toUpperCase()}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Charts Row */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
                <div className="flex-[3] bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-[15px] font-bold text-slate-800">Évolution de l'activité</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-500"><div className="w-3 h-1.5 rounded bg-violet-500" />Appels</div>
                            <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-500"><div className="w-3 h-1.5 rounded bg-amber-400" />Meetings</div>
                        </div>
                    </div>
                    <div className="flex-1 min-h-[200px] -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.15} /><stop offset="100%" stopColor="#7C5CFC" stopOpacity={0} /></linearGradient>
                                </defs>
                                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '12px', fontWeight: 600, padding: '10px 14px' }} />
                                <Area type="monotone" dataKey="calls" stroke="#7C5CFC" strokeWidth={2.5} fillOpacity={1} fill="url(#gV)" />
                                <Area type="monotone" dataKey="meetings" stroke="#F59E0B" strokeWidth={2.5} fillOpacity={0} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="flex-[2] bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[15px] font-bold text-slate-800">Résultats des appels</h3>
                        <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{totalCalls} total</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="w-28 h-28 relative shrink-0">
                            <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90 drop-shadow-sm">
                                <circle cx="26" cy="26" r="20" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                                <circle cx="26" cy="26" r="20" fill="none" stroke="#60a5fa" strokeWidth="6" strokeDasharray={`${(noRespCount / totalCalls) * 125} 125`} strokeLinecap="round" />
                                <circle cx="26" cy="26" r="20" fill="none" stroke="#ef4444" strokeWidth="6" strokeDasharray={`${(disqCount / totalCalls) * 125} 125`} strokeDashoffset={-((noRespCount / totalCalls) * 125)} strokeLinecap="round" />
                                <circle cx="26" cy="26" r="20" fill="none" stroke="#f59e0b" strokeWidth="6" strokeDasharray={`${(totalCbacks / totalCalls) * 125} 125`} strokeDashoffset={-(((noRespCount + disqCount) / totalCalls) * 125)} strokeLinecap="round" />
                                <circle cx="26" cy="26" r="20" fill="none" stroke="#7C5CFC" strokeWidth="6" strokeDasharray={`${(stdCount / totalCalls) * 125} 125`} strokeDashoffset={-(((noRespCount + disqCount + totalCbacks) / totalCalls) * 125)} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[17px] font-black text-slate-800 mt-1">{totalCalls}</span>
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[11.5px] font-bold text-slate-600"><div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />Non-réponse</div>
                                <div className="flex items-center gap-1.5"><span className="text-[11.5px] font-black text-slate-800">{noRespCount}</span><span className="text-[10px] font-bold text-slate-400 w-7 text-right">{Math.round((noRespCount / totalCalls) * 100)}%</span></div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[11.5px] font-bold text-slate-600"><div className="w-2.5 h-2.5 rounded-sm bg-red-500" />Disqualifié</div>
                                <div className="flex items-center gap-1.5"><span className="text-[11.5px] font-black text-slate-800">{disqCount}</span><span className="text-[10px] font-bold text-slate-400 w-7 text-right">{Math.round((disqCount / totalCalls) * 100)}%</span></div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[11.5px] font-bold text-slate-600"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />Rappels</div>
                                <div className="flex items-center gap-1.5"><span className="text-[11.5px] font-black text-slate-800">{totalCbacks}</span><span className="text-[10px] font-bold text-slate-400 w-7 text-right">{Math.round((totalCbacks / totalCalls) * 100)}%</span></div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[11.5px] font-bold text-slate-600"><div className="w-2.5 h-2.5 rounded-sm bg-violet-500" />Standard</div>
                                <div className="flex items-center gap-1.5"><span className="text-[11.5px] font-black text-slate-800">{stdCount}</span><span className="text-[10px] font-bold text-slate-400 w-7 text-right">{Math.round((stdCount / totalCalls) * 100)}%</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SDR TABLE */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden mb-6">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <h3 className="text-[15px] font-bold text-slate-800">Leaderboard SDR</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-5 py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 w-10 text-center">#</th>
                                <th className="px-5 py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100">SDR</th>
                                <th className="px-5 py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Appels</th>
                                <th className="px-5 py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Rappels</th>
                                <th className="px-5 py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Meetings</th>
                                <th className="px-5 py-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100">Taux Contact</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(sdrPerformance || []).map((s: any, i: number) => {
                                const contactRate = Math.round((s.contacts / s.calls) * 100) || 0;
                                const isFirst = i === 0;
                                return (
                                    <tr key={s.sdrId} className={cn("transition-colors", isFirst ? "bg-gradient-to-r from-violet-50/50 to-transparent" : "hover:bg-slate-50")}>
                                        <td className="px-5 py-4 text-center">
                                            <span className={cn("text-[12px] font-black", i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-slate-300")}>
                                                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow-sm", isFirst ? "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-300" : "")} style={!isFirst ? { background: getSdrColor(s.sdrName) } : {}}>
                                                    {s.sdrName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className={cn("text-[13.5px] font-bold", isFirst ? "text-violet-700" : "text-slate-800")}>{s.sdrName}</div>
                                                    <div className="text-[11px] text-slate-500 font-medium">{s.sdrRole}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center text-[13.5px] font-black text-slate-700">{s.calls}</td>
                                        <td className="px-5 py-4 text-center text-[13.5px] font-bold text-amber-500">{s.callbacks}</td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={cn("text-[13px] font-black", s.meetings > 0 ? "text-emerald-600" : "text-slate-400")}>{s.meetings}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3 max-w-[140px]">
                                                <div className="text-[12.5px] font-black text-slate-600 w-10 text-right">{contactRate}%</div>
                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${contactRate}%` }} /></div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* JOURNAL TABLE */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-[15px] font-bold text-slate-800">Journal d'Activité</h3>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
                        <button className={cn("px-3.5 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap rounded-xl", journalFilter === 'all' ? "bg-slate-800 text-white shadow-md shadow-slate-800/20" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200")} onClick={() => setJournalFilter('all')}>
                            Tous <span className={cn("ml-1.5 px-1.5 py-0.5 rounded text-[9px]", journalFilter === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{actions.length}</span>
                        </button>
                        <button className={cn("px-3.5 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap rounded-xl flex items-center gap-1.5", journalFilter === 'meetings' ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200")} onClick={() => setJournalFilter('meetings')}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", journalFilter === 'meetings' ? "bg-white" : "bg-emerald-500")} /> Meetings
                        </button>
                        <button className={cn("px-3.5 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap rounded-xl flex items-center gap-1.5", journalFilter === 'callbacks' ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200")} onClick={() => setJournalFilter('callbacks')}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", journalFilter === 'callbacks' ? "bg-white" : "bg-amber-500")} /> Intéressés
                        </button>
                        <button className={cn("px-3.5 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap rounded-xl flex items-center gap-1.5", journalFilter === 'disqualified' ? "bg-red-500 text-white shadow-md shadow-red-500/20" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200")} onClick={() => setJournalFilter('disqualified')}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", journalFilter === 'disqualified' ? "bg-white" : "bg-red-500")} /> Disqualifiés
                        </button>
                        <button className={cn("px-3.5 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap rounded-xl flex items-center gap-1.5", journalFilter === 'no_response' ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200")} onClick={() => setJournalFilter('no_response')}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", journalFilter === 'no_response' ? "bg-white" : "bg-blue-500")} /> Sans réponse
                        </button>
                    </div>

                    <div className="relative shrink-0 w-full md:w-auto">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input className="w-full md:w-56 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all placeholder:text-slate-400 shadow-sm" type="text" placeholder="Rechercher..." disabled />
                    </div>
                </div>

                <div className="[&_.rt-table]:border-slate-100 [&_th]:text-[10px] [&_th]:font-extrabold [&_th]:text-slate-400 [&_th]:uppercase [&_th]:tracking-widest [&_th]:bg-slate-50/50 [&_th]:py-3 [&_td]:py-3.5 [&_td]:text-[13px] border border-slate-100 rounded-xl overflow-hidden [&_.rt-pagination]:p-3 [&_.rt-pagination]:border-t [&_.rt-pagination]:border-slate-100">
                    <DataTable
                        data={filteredActions}
                        columns={[
                            { key: "createdAt", header: "Date", sortable: true, render: (val: string) => <div className="text-[12px] text-slate-500 font-bold font-mono bg-slate-50 px-2 py-1 rounded w-max">{new Date(val).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div> },
                            { key: "sdrName", header: "SDR", sortable: true, render: (val: string) => <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-sm" style={{ background: getSdrColor(val) }}>{val.substring(0, 2).toUpperCase()}</div><span className="font-bold text-slate-700">{val}</span></div> },
                            { key: "missionName", header: "Mission", sortable: true, render: (val: string) => <span className="text-[12px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-md">{val}</span> },
                            { key: "contactName", header: "Contact", sortable: true, render: (val: string, row: any) => <div><div className="font-black text-slate-800 tracking-tight">{val}</div><div className="text-[11.5px] font-medium text-slate-400">{row.companyName}</div></div> },
                            {
                                key: "result", header: "Résultat", sortable: true, render: (val: string) => {
                                    let bg = 'bg-slate-100 text-slate-600', dot = 'bg-slate-400';
                                    if (val === 'MEETING_BOOKED') { bg = 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'; dot = 'bg-emerald-500'; }
                                    if (val === 'CALLBACK_REQUESTED' || val === 'INTERESTED') { bg = 'bg-amber-50 text-amber-700 border border-amber-100/50'; dot = 'bg-amber-500'; }
                                    if (val === 'DISQUALIFIED') { bg = 'bg-red-50 text-red-700 border border-red-100/50'; dot = 'bg-red-500'; }
                                    if (val === 'NO_RESPONSE') { bg = 'bg-blue-50 text-blue-700 border border-blue-100/50'; dot = 'bg-blue-500'; }
                                    return <span className={cn("px-2.5 py-1.5 rounded-full text-[10px] font-bold tracking-wider flex w-max items-center gap-1.5 uppercase", bg)}><div className={cn("w-1.5 h-1.5 rounded-full", dot)} />{ACTION_RESULT_LABELS[val] || val}</span>
                                }
                            },
                            { key: "duration", header: "Durée", sortable: true, render: (val: number) => <span className="text-slate-500 text-[11.5px] font-mono font-bold bg-slate-50 px-2 py-1 rounded">{val ? `${Math.floor(val / 60)}m ${val % 60}s` : '-'}</span> }
                        ]}
                        keyField="id"
                        pagination
                        pageSize={15}
                        loading={isLoadingActions}
                    />
                </div>
            </div>

        </div>
    );
}
