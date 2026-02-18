"use client";

import { useMemo, useState, useEffect } from "react";
import {
    Phone,
    Clock,
    PhoneOff,
    PhoneCall,
    TrendingUp,
    Award,
    User,
    Building2,
    Loader2,
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
} from "recharts";
import { Card, StatCard } from "@/components/ui";
import {
    MOCK_DASHBOARD_STATS,
    MOCK_CALLS,
    getMockCallsOverTime,
    getMockSDRPerformance,
} from "@/lib/calls/mock-data";
import { cn } from "@/lib/utils";

// ============================================
// HELPERS
// ============================================

function formatDateShort(iso: string): string {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

function formatDuration(seconds: number): string {
    if (seconds === 0) return "0 min";
    const m = Math.floor(seconds / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}min` : `${m} min`;
}

// ============================================
// CALLS DASHBOARD
// ============================================

export function CallsDashboard() {
    const [apiStats, setApiStats] = useState<{
        totalCalls: number;
        totalDurationSeconds: number;
        byStatus: Record<string, number>;
        byUser: Array<{ userId: string; userName: string; calls: number; durationSeconds: number }>;
    } | null>(null);
    const [recentCallsFromApi, setRecentCallsFromApi] = useState<Array<{
        id: string;
        contactName: string;
        companyName: string;
        date: string;
        duration: number;
        sdrName: string;
    }>>([]);
    const [loading, setLoading] = useState(true);
    const [useMock, setUseMock] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        Promise.all([
            fetch("/api/calls/stats").then((r) => r.json()),
            fetch("/api/calls?limit=5").then((r) => r.json()),
        ])
            .then(([statsRes, callsRes]) => {
                if (cancelled) return;
                if (statsRes.success && statsRes.data) {
                    setApiStats(statsRes.data);
                    setUseMock(false);
                }
                if (callsRes.success && Array.isArray(callsRes.data?.calls)) {
                    setRecentCallsFromApi(
                        callsRes.data.calls.slice(0, 5).map((c: {
                            id: string;
                            startTime: string;
                            durationSeconds: number | null;
                            contact?: { firstName?: string | null; lastName?: string | null };
                            company?: { name: string };
                            user?: { name: string | null };
                        }) => ({
                            id: c.id,
                            contactName: c.contact
                                ? [c.contact.firstName, c.contact.lastName].filter(Boolean).join(" ") || "—"
                                : c.company?.name ?? "—",
                            companyName: c.company?.name ?? "—",
                            date: c.startTime,
                            duration: c.durationSeconds ?? 0,
                            sdrName: c.user?.name ?? "—",
                        }))
                    );
                }
            })
            .catch(() => {
                if (!cancelled) setUseMock(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const stats = useMemo(() => {
        if (apiStats) {
            return {
                totalCalls: apiStats.totalCalls,
                totalDurationMinutes: Math.floor(apiStats.totalDurationSeconds / 60),
                completed: apiStats.byStatus?.completed ?? 0,
                missed: apiStats.byStatus?.failed ?? 0,
                callbackRequested: 0,
                noAnswer: apiStats.byStatus?.queued ?? 0,
            };
        }
        return MOCK_DASHBOARD_STATS;
    }, [apiStats]);

    const overTime = useMemo(() => getMockCallsOverTime(), []);

    const sdrPerf = useMemo(() => {
        if (apiStats?.byUser?.length) {
            return apiStats.byUser
                .map((u) => ({
                    sdrId: u.userId,
                    sdrName: u.userName,
                    calls: u.calls,
                    durationMinutes: Math.floor(u.durationSeconds / 60),
                    completed: 0,
                }))
                .sort((a, b) => b.calls - a.calls);
        }
        return getMockSDRPerformance();
    }, [apiStats?.byUser]);

    const statusPieData = useMemo(() => {
        const arr = [
            { name: "Complétés", value: stats.completed, color: "#10b981" },
            { name: "Échoués", value: stats.missed, color: "#ef4444" },
            { name: "En file", value: stats.noAnswer, color: "#94a3b8" },
        ].filter((d) => d.value > 0);
        return arr.length ? arr : [{ name: "Aucun", value: 1, color: "#e2e8f0" }];
    }, [stats]);

    const recentCalls = useMemo(() => {
        if (recentCallsFromApi.length) {
            return recentCallsFromApi.map((c) => ({
                id: c.id,
                contactName: c.contactName,
                companyName: c.companyName,
                date: c.date,
                duration: c.duration,
                sdrName: c.sdrName,
            }));
        }
        return [...MOCK_CALLS]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [recentCallsFromApi]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-slate-500">Chargement des statistiques...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {useMock && (
                <p className="text-sm text-amber-600">Données de démo (API non disponible).</p>
            )}
            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total appels"
                    value={stats.totalCalls}
                    icon={Phone}
                    iconBg="bg-indigo-100"
                    iconColor="text-indigo-600"
                />
                <StatCard
                    label="Durée totale"
                    value={`${Math.floor(stats.totalDurationMinutes / 60)}h ${stats.totalDurationMinutes % 60}min`}
                    icon={Clock}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                />
                <StatCard
                    label="Complétés"
                    value={stats.completed}
                    icon={TrendingUp}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                />
                <StatCard
                    label="Manqués / Pas de réponse"
                    value={stats.missed + stats.noAnswer}
                    icon={PhoneOff}
                    iconBg="bg-amber-100"
                    iconColor="text-amber-600"
                />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Line chart - calls over time */}
                <Card variant="elevated" className="p-6 border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Appels sur 14 jours</h2>
                    </div>
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={overTime} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11, fill: "#64748b" }}
                                    tickFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                                />
                                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                                    labelFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                                    formatter={(value: number) => [value, "Appels"]}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="calls"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    dot={{ fill: "#6366f1", r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Pie chart - status distribution */}
                <Card variant="elevated" className="p-6 border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                        <PhoneCall className="w-5 h-5 text-violet-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Répartition des statuts</h2>
                    </div>
                    <div className="h-[260px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusPieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    labelLine={false}
                                >
                                    {statusPieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                                    formatter={(value: number) => [value, "Appels"]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Bar chart SDR + Leaderboard + Recent calls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bar chart - SDR performance */}
                <Card variant="elevated" className="p-6 border border-slate-200 lg:col-span-2">
                    <div className="flex items-center gap-2 mb-4">
                        <Award className="w-5 h-5 text-amber-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Performance par SDR</h2>
                    </div>
                    <div className="h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sdrPerf} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                                <YAxis
                                    type="category"
                                    dataKey="sdrName"
                                    tick={{ fontSize: 11, fill: "#64748b" }}
                                    width={72}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                                    formatter={(value: number, name: string) => {
                                        if (name === "calls") return [value, "Appels"];
                                        if (name === "durationMinutes") return [`${value} min`, "Durée"];
                                        return [value, name];
                                    }}
                                />
                                <Bar dataKey="calls" fill="#6366f1" radius={[0, 4, 4, 0]} name="Appels" />
                                <Bar dataKey="durationMinutes" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Durée (min)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Leaderboard compact */}
                <Card variant="elevated" className="p-6 border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                        <Award className="w-5 h-5 text-amber-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Classement</h2>
                    </div>
                    <ul className="space-y-3">
                        {sdrPerf.map((sdr, index) => (
                            <li
                                key={sdr.sdrId}
                                className={cn(
                                    "flex items-center gap-3 p-2 rounded-xl",
                                    index === 0 && "bg-amber-50"
                                )}
                            >
                                <span
                                    className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                                        index === 0 ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"
                                    )}
                                >
                                    {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 truncate">{sdr.sdrName}</p>
                                    <p className="text-xs text-slate-500">{sdr.calls} appels · {sdr.durationMinutes} min</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>

            {/* Recent calls cards */}
            <Card variant="elevated" className="p-6 border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                    <Phone className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Appels récents</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {recentCalls.map((call) => (
                        <div
                            key={call.id}
                            className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-start gap-2">
                                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4 text-slate-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 truncate">{call.contactName}</p>
                                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                                        <Building2 className="w-3 h-3 shrink-0" />
                                        {call.companyName}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {formatDateShort(call.date)} · {formatDuration(call.duration)}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">{call.sdrName}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
