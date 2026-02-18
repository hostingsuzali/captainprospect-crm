"use client";

import { useState, useEffect } from "react";
import {
    Building2,
    Target,
    Users,
    TrendingUp,
    Plus,
    Loader2,
    RefreshCw,
    ChevronRight,
    Clock,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Card, Button, Badge, LoadingState, StatCard, PageHeader, EmptyState } from "@/components/ui";

// ============================================
// TYPES
// ============================================

interface DashboardStats {
    totalClients: number;
    activeClients: number;
    pendingOnboarding: number;
    totalMissions: number;
}

interface Client {
    id: string;
    name: string;
    industry?: string;
    onboarding?: {
        status: string;
        targetLaunchDate?: string;
    };
    _count: {
        missions: number;
    };
}

const ONBOARDING_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-600", icon: <Clock className="w-3 h-3" /> },
    IN_PROGRESS: { label: "En cours", color: "bg-blue-100 text-blue-600", icon: <Clock className="w-3 h-3" /> },
    READY_FOR_REVIEW: { label: "En attente", color: "bg-amber-100 text-amber-600", icon: <AlertCircle className="w-3 h-3" /> },
    APPROVED: { label: "Approuvé", color: "bg-emerald-100 text-emerald-600", icon: <CheckCircle2 className="w-3 h-3" /> },
    ACTIVE: { label: "Actif", color: "bg-green-100 text-green-600", icon: <CheckCircle2 className="w-3 h-3" /> },
};

export default function BDDashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [statsRes, clientsRes] = await Promise.all([
                fetch("/api/bd/stats"),
                fetch("/api/bd/clients?limit=5"),
            ]);

            const [statsJson, clientsJson] = await Promise.all([
                statsRes.json(),
                clientsRes.json(),
            ]);

            if (statsJson.success) setStats(statsJson.data);
            if (clientsJson.success) setClients(clientsJson.data);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading && !stats) {
        return <LoadingState message="Chargement du dashboard..." />;
    }

    return (
        <div className="space-y-8">
            {/* Hero Header */}
            <PageHeader
                variant="hero"
                title="Dashboard Business Developer"
                subtitle="Gérez votre portfolio clients et suivez les onboardings en cours."
                icon={<><TrendingUp className="w-4 h-4" /><span>Vue d'ensemble</span></>}
                actions={
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchData}
                            className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                        </button>
                        <Link
                            href="/bd/clients/new"
                            className="flex items-center gap-2 h-10 px-5 text-sm font-medium bg-white text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Nouveau client
                        </Link>
                    </div>
                }
            />

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-5">
                <StatCard
                    label="Clients dans le portfolio"
                    value={stats?.totalClients || 0}
                    icon={Building2}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                />
                <StatCard
                    label="Clients actifs"
                    value={stats?.activeClients || 0}
                    icon={CheckCircle2}
                    iconBg="bg-green-100"
                    iconColor="text-green-600"
                />
                <StatCard
                    label="Onboardings en cours"
                    value={stats?.pendingOnboarding || 0}
                    icon={Clock}
                    iconBg="bg-amber-100"
                    iconColor="text-amber-600"
                />
                <StatCard
                    label="Missions actives"
                    value={stats?.totalMissions || 0}
                    icon={Target}
                    iconBg="bg-indigo-100"
                    iconColor="text-indigo-600"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-3 gap-6">
                {/* Recent Clients */}
                <div className="col-span-2">
                    <Card>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Mon Portfolio</h2>
                                    <p className="text-sm text-slate-500">{clients.length} clients récents</p>
                                </div>
                            </div>
                            <Link
                                href="/bd/clients"
                                className="text-sm text-emerald-600 hover:text-emerald-500 flex items-center gap-1"
                            >
                                Voir tout <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {clients.length === 0 ? (
                            <EmptyState
                                icon={Building2}
                                title="Aucun client dans le portfolio"
                                description="Commencez par onboarder votre premier client"
                                variant="inline"
                                action={
                                    <Link href="/bd/clients/new">
                                        <Button variant="primary" className="gap-2">
                                            <Plus className="w-4 h-4" />
                                            Nouveau client
                                        </Button>
                                    </Link>
                                }
                            />
                        ) : (
                            <div className="space-y-3">
                                {clients.map((client) => {
                                    const status = client.onboarding?.status || "DRAFT";
                                    const statusConfig = ONBOARDING_STATUS_CONFIG[status] || ONBOARDING_STATUS_CONFIG.DRAFT;

                                    return (
                                        <Link
                                            key={client.id}
                                            href={`/bd/clients/${client.id}`}
                                            className="group flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center text-lg font-bold text-emerald-600 group-hover:scale-110 transition-transform duration-300">
                                                {client.name[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium text-slate-900 group-hover:text-emerald-600 transition-colors">
                                                        {client.name}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                                        {statusConfig.icon}
                                                        {statusConfig.label}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-500">
                                                    {client.industry || "Secteur non défini"} · {client._count.missions} mission{client._count.missions > 1 ? "s" : ""}
                                                </p>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6">
                    <Card>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                                <Plus className="w-5 h-5 text-indigo-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900">Actions rapides</h2>
                        </div>
                        <div className="space-y-2">
                            <Link
                                href="/bd/clients/new"
                                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Building2 className="w-4 h-4 text-emerald-600" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-600">Onboarder un client</span>
                            </Link>
                            <Link
                                href="/bd/clients"
                                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Users className="w-4 h-4 text-indigo-600" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600">Voir le portfolio</span>
                            </Link>
                            <Link
                                href="/bd/missions"
                                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-all group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Target className="w-4 h-4 text-amber-600" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 group-hover:text-amber-600">Suivre les missions</span>
                            </Link>
                        </div>
                    </Card>

                    {/* Tips Card */}
                    <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-medium text-emerald-900 mb-1">Astuce du jour</h3>
                                <p className="text-sm text-emerald-700">
                                    Complétez l'onboarding avec un maximum de détails pour faciliter le travail des managers et SDRs.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
