"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    Building2,
    LayoutDashboard,
    Target,
    Mic,
    Users,
    ShieldCheck,
    Rocket,
    Receipt,
    BarChart3,
    Filter,
    MessageSquare,
    Folder,
    Settings,
} from "lucide-react";
import { Tabs, StatCard, Badge, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { useClientNavState, CLIENT_TAB_IDS, type ClientTab } from "./_hooks/useClientNavState";
import { OverviewTab } from "./_tabs/OverviewTab";
import { MissionsTab } from "./_tabs/MissionsTab";
import { SessionsTab } from "./_tabs/SessionsTab";
import { InterlocuteursTab } from "./_tabs/InterlocuteursTab";
import { UsersAccessTab } from "./_tabs/UsersAccessTab";
import { OnboardingTab } from "./_tabs/OnboardingTab";
import { BillingTab } from "./_tabs/BillingTab";
import { ReportingTab } from "./_tabs/ReportingTab";
import { ProspectsTab } from "./_tabs/ProspectsTab";
import { CommsTab } from "./_tabs/CommsTab";
import { FilesTab } from "./_tabs/FilesTab";
import { PortalSettingsTab } from "./_tabs/PortalSettingsTab";

export interface ClientShellData {
    id: string;
    name: string;
    industry?: string | null;
    email?: string | null;
    phone?: string | null;
    bookingUrl?: string | null;
    portalShowCallHistory: boolean;
    portalShowDatabase: boolean;
    rdvEmailNotificationsEnabled: boolean;
    defaultMailboxId?: string | null;
    salesPlaybook?: unknown;
    createdAt: string;
    billingClientId?: string | null;
    _count: {
        missions: number;
        users: number;
        interlocuteurs: number;
        files: number;
    };
    onboarding?: { status?: string; targetLaunchDate?: string | null; onboardingData?: unknown } | null;
}

interface ClientDetailShellProps {
    clientId: string;
    initialClient: ClientShellData;
}

const TAB_META: Record<ClientTab, { label: string; icon: React.ReactNode }> = {
    overview: { label: "Vue d'ensemble", icon: <LayoutDashboard className="w-4 h-4" /> },
    missions: { label: "Missions", icon: <Target className="w-4 h-4" /> },
    sessions: { label: "Sessions", icon: <Mic className="w-4 h-4" /> },
    interlocuteurs: { label: "Interlocuteurs", icon: <Users className="w-4 h-4" /> },
    users: { label: "Utilisateurs", icon: <ShieldCheck className="w-4 h-4" /> },
    onboarding: { label: "Onboarding", icon: <Rocket className="w-4 h-4" /> },
    billing: { label: "Facturation", icon: <Receipt className="w-4 h-4" /> },
    reporting: { label: "Reporting", icon: <BarChart3 className="w-4 h-4" /> },
    prospects: { label: "Prospection", icon: <Filter className="w-4 h-4" /> },
    comms: { label: "Communications", icon: <MessageSquare className="w-4 h-4" /> },
    files: { label: "Fichiers", icon: <Folder className="w-4 h-4" /> },
    "portal-settings": { label: "Portail", icon: <Settings className="w-4 h-4" /> },
};

export function ClientDetailShell({ clientId, initialClient }: ClientDetailShellProps) {
    const nav = useClientNavState();

    const clientQuery = useQuery({
        queryKey: qk.client(clientId),
        queryFn: async () => {
            const res = await fetch(`/api/clients/${clientId}`);
            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json?.error || "Impossible de charger le client");
            }
            return json.data as ClientShellData;
        },
        initialData: initialClient,
        staleTime: 30_000,
    });

    const client = clientQuery.data ?? initialClient;

    // Counts queries for tab badges (lightweight; only runs once per session per tab)
    const missionsCountQuery = useQuery({
        queryKey: [...qk.clientMissions(clientId), "count"],
        queryFn: async () => {
            const res = await fetch(`/api/missions?clientId=${clientId}&limit=1`);
            const json = await res.json();
            return json?.pagination?.total ?? (json?.data?.length ?? 0);
        },
        staleTime: 60_000,
    });
    const sessionsCountQuery = useQuery({
        queryKey: [...qk.clientSessions(clientId), "count"],
        queryFn: async () => {
            const res = await fetch(`/api/clients/${clientId}/sessions`);
            const json = await res.json();
            const arr = json?.data ?? json ?? [];
            return Array.isArray(arr) ? arr.length : 0;
        },
        staleTime: 60_000,
    });
    const interlocuteursCountQuery = useQuery({
        queryKey: [...qk.clientInterlocuteurs(clientId), "count"],
        queryFn: async () => {
            const res = await fetch(`/api/clients/${clientId}/interlocuteurs`);
            const json = await res.json();
            const arr = json?.data ?? json ?? [];
            return Array.isArray(arr) ? arr.length : 0;
        },
        staleTime: 60_000,
    });

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            const tag = t?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            if (t?.isContentEditable) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            const key = e.key.toLowerCase();
            if (key === "m") {
                e.preventDefault();
                nav.setTab("missions");
            } else if (key === "s") {
                e.preventDefault();
                nav.setTab("sessions");
            } else if (key === "u") {
                e.preventDefault();
                nav.setTab("users");
            } else if (e.key === "Escape") {
                nav.closePanel();
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [nav]);

    const tabs = useMemo(
        () =>
            CLIENT_TAB_IDS.map((id) => {
                const meta = TAB_META[id];
                let badge: string | number | undefined;
                if (id === "missions" && missionsCountQuery.data !== undefined) badge = missionsCountQuery.data;
                if (id === "sessions" && sessionsCountQuery.data !== undefined) badge = sessionsCountQuery.data;
                if (id === "interlocuteurs" && interlocuteursCountQuery.data !== undefined)
                    badge = interlocuteursCountQuery.data;
                return { id, label: meta.label, icon: meta.icon, badge };
            }),
        [missionsCountQuery.data, sessionsCountQuery.data, interlocuteursCountQuery.data]
    );

    const kpiActiveMissions = missionsCountQuery.data ?? client._count.missions;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Sticky header */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
                <div className="px-6 pt-4 pb-3">
                    <div className="flex items-center gap-3 text-sm text-slate-500 mb-3">
                        <Link
                            href="/manager/clients"
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Clients
                        </Link>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-900 font-medium truncate">{client.name}</span>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-2xl font-bold text-slate-900 truncate">{client.name}</h1>
                                    <IdChip id={client.id} label="Client ID" />
                                    {client.industry && (
                                        <Badge variant="outline" className="text-xs">
                                            {client.industry}
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                                    {client.email && <span>{client.email}</span>}
                                    {client.phone && <span>{client.phone}</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KPI row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <StatCard
                            label="Missions actives"
                            value={kpiActiveMissions}
                            icon={Target}
                            iconBg="bg-indigo-100"
                            iconColor="text-indigo-600"
                        />
                        <StatCard
                            label="Sessions"
                            value={sessionsCountQuery.data ?? "—"}
                            icon={Mic}
                            iconBg="bg-emerald-100"
                            iconColor="text-emerald-600"
                        />
                        <StatCard
                            label="Interlocuteurs"
                            value={interlocuteursCountQuery.data ?? client._count.interlocuteurs}
                            icon={Users}
                            iconBg="bg-amber-100"
                            iconColor="text-amber-600"
                        />
                        <StatCard
                            label="Utilisateurs portail"
                            value={client._count.users}
                            icon={ShieldCheck}
                            iconBg="bg-pink-100"
                            iconColor="text-pink-600"
                        />
                    </div>

                    {/* Tabs */}
                    <div className="mt-4 -mx-6 px-6 overflow-x-auto">
                        <Tabs
                            tabs={tabs}
                            activeTab={nav.tab}
                            onTabChange={(id) => nav.setTab(id as ClientTab)}
                            className="flex-nowrap"
                        />
                    </div>
                </div>
            </div>

            {/* Main panel */}
            <div className="relative">
                <main
                    className={cn(
                        "transition-[margin] duration-200",
                        (nav.m || nav.s) && "lg:mr-[420px]"
                    )}
                >
                    <div className="p-6">
                        {clientQuery.isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-8 w-40" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : (
                            <TabContent tab={nav.tab} client={client} />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

function TabContent({ tab, client }: { tab: ClientTab; client: ClientShellData }) {
    switch (tab) {
        case "overview":
            return <OverviewTab client={client} />;
        case "missions":
            return <MissionsTab client={client} />;
        case "sessions":
            return <SessionsTab client={client} />;
        case "interlocuteurs":
            return <InterlocuteursTab client={client} />;
        case "users":
            return <UsersAccessTab client={client} />;
        case "onboarding":
            return <OnboardingTab client={client} />;
        case "billing":
            return <BillingTab client={client} />;
        case "reporting":
            return <ReportingTab client={client} />;
        case "prospects":
            return <ProspectsTab client={client} />;
        case "comms":
            return <CommsTab client={client} />;
        case "files":
            return <FilesTab client={client} />;
        case "portal-settings":
            return <PortalSettingsTab client={client} />;
        default:
            return null;
    }
}

export default ClientDetailShell;
