"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    Target,
    LayoutDashboard,
    Megaphone,
    List as ListIcon,
    Users,
    Calendar,
    Mail,
    Activity,
    BarChart3,
    Filter,
    ThumbsUp,
    MessageSquare,
    Folder,
    Mic,
    Settings,
    Phone,
    Linkedin,
    Play,
    Pause,
    ChevronRight,
} from "lucide-react";
import { Tabs, StatCard, Badge, Skeleton, Button } from "@/components/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";
import { qk } from "@/lib/query-keys";
import { MISSION_STATUS_CONFIG, type MissionStatusValue } from "@/lib/constants/missionStatus";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { MissionStatusWorkflowDrawer } from "@/components/drawers/MissionStatusWorkflowDrawer";
import { useMissionNavState, MISSION_TAB_IDS, type MissionTab } from "./_hooks/useMissionNavState";
import { OverviewTab } from "./_tabs/OverviewTab";
import { CampaignsTab } from "./_tabs/CampaignsTab";
import { ListsTab } from "./_tabs/ListsTab";
import { SdrTeamTab } from "./_tabs/SdrTeamTab";
import { PlanningTab } from "./_tabs/PlanningTab";
import { EmailTemplatesTab } from "./_tabs/EmailTemplatesTab";
import { ActionsTab } from "./_tabs/ActionsTab";
import { ReportingTab } from "./_tabs/ReportingTab";
import { ProspectSourcesTab } from "./_tabs/ProspectSourcesTab";
import { FeedbackTab } from "./_tabs/FeedbackTab";
import { CommsTab } from "./_tabs/CommsTab";
import { FilesTab } from "./_tabs/FilesTab";
import { LeexiTab } from "./_tabs/LeexiTab";
import { SettingsTab } from "./_tabs/SettingsTab";

export interface MissionShellData {
    id: string;
    name: string;
    objective?: string | null;
    channel: "CALL" | "EMAIL" | "LINKEDIN";
    channels?: ("CALL" | "EMAIL" | "LINKEDIN")[];
    status: MissionStatusValue;
    isActive: boolean;
    clientId: string;
    client: { id: string; name: string };
    startDate: string;
    endDate: string;
    totalContractDays?: number | null;
    defaultMailboxId?: string | null;
    defaultInterlocuteurId?: string | null;
    teamLeadSdrId?: string | null;
    teamLeadSdr?: { id: string; name: string; email: string } | null;
    sdrAssignments?: { id: string; sdr: { id: string; name: string; email: string } }[];
    _count: {
        campaigns: number;
        lists: number;
        sdrAssignments: number;
    };
    stats?: {
        totalActions: number;
        meetingsBooked: number;
        opportunities: number;
    } | null;
    createdAt: string;
}

interface MissionDetailShellProps {
    missionId: string;
    initialMission: MissionShellData;
}

const TAB_META: Record<MissionTab, { label: string; icon: React.ReactNode }> = {
    overview: { label: "Vue d'ensemble", icon: <LayoutDashboard className="w-4 h-4" /> },
    campaigns: { label: "Campagnes", icon: <Megaphone className="w-4 h-4" /> },
    lists: { label: "Listes", icon: <ListIcon className="w-4 h-4" /> },
    "sdr-team": { label: "Équipe SDR", icon: <Users className="w-4 h-4" /> },
    planning: { label: "Planning", icon: <Calendar className="w-4 h-4" /> },
    "email-templates": { label: "Templates email", icon: <Mail className="w-4 h-4" /> },
    actions: { label: "Actions", icon: <Activity className="w-4 h-4" /> },
    reporting: { label: "Reporting", icon: <BarChart3 className="w-4 h-4" /> },
    "prospect-sources": { label: "Sources", icon: <Filter className="w-4 h-4" /> },
    feedback: { label: "Feedback SDR", icon: <ThumbsUp className="w-4 h-4" /> },
    comms: { label: "Comms", icon: <MessageSquare className="w-4 h-4" /> },
    files: { label: "Fichiers", icon: <Folder className="w-4 h-4" /> },
    leexi: { label: "Leexi", icon: <Mic className="w-4 h-4" /> },
    settings: { label: "Paramètres", icon: <Settings className="w-4 h-4" /> },
};

const STATUS_COLORS: Record<MissionStatusValue, { bg: string; text: string; border: string }> = {
    DRAFT: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
    ACTIVE: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
    PAUSED: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
    COMPLETED: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
    ARCHIVED: { bg: "bg-zinc-100", text: "text-zinc-700", border: "border-zinc-200" },
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
    CALL: <Phone className="w-3.5 h-3.5" />,
    EMAIL: <Mail className="w-3.5 h-3.5" />,
    LINKEDIN: <Linkedin className="w-3.5 h-3.5" />,
};

export function MissionDetailShell({ missionId, initialMission }: MissionDetailShellProps) {
    const nav = useMissionNavState();
    const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);

    const missionQuery = useQuery({
        queryKey: qk.mission(missionId),
        queryFn: async () => {
            const res = await fetch(`/api/missions/${missionId}`);
            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json?.error || "Impossible de charger la mission");
            }
            return json.data as MissionShellData;
        },
        initialData: initialMission,
        staleTime: 30_000,
    });

    const mission = missionQuery.data ?? initialMission;

    // Count queries for tab badges
    const campaignsCountQuery = useQuery({
        queryKey: [...qk.missionCampaigns(missionId), "count"],
        queryFn: async () => {
            const res = await fetch(`/api/campaigns?missionId=${missionId}`);
            const json = await res.json();
            const arr = json?.data ?? [];
            return Array.isArray(arr) ? arr.length : 0;
        },
        staleTime: 60_000,
    });
    const listsCountQuery = useQuery({
        queryKey: [...qk.missionLists(missionId), "count"],
        queryFn: async () => {
            const res = await fetch(`/api/lists?missionId=${missionId}&limit=1`);
            const json = await res.json();
            return json?.pagination?.total ?? (Array.isArray(json?.data) ? json.data.length : 0);
        },
        staleTime: 60_000,
    });
    const templatesCountQuery = useQuery({
        queryKey: [...qk.missionTemplates(missionId), "count"],
        queryFn: async () => {
            const res = await fetch(`/api/missions/${missionId}/templates`);
            const json = await res.json();
            const arr = json?.data ?? [];
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
                nav.setTab("campaigns");
            } else if (key === "s") {
                e.preventDefault();
                nav.setTab("sdr-team");
            } else if (key === "u") {
                e.preventDefault();
                nav.setTab("sdr-team");
            } else if (e.key === "Escape") {
                nav.closePanel();
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [nav]);

    const tabs = useMemo(
        () =>
            MISSION_TAB_IDS.map((id) => {
                const meta = TAB_META[id];
                let badge: string | number | undefined;
                if (id === "campaigns" && campaignsCountQuery.data !== undefined) badge = campaignsCountQuery.data;
                if (id === "lists" && listsCountQuery.data !== undefined) badge = listsCountQuery.data;
                if (id === "sdr-team") badge = mission._count.sdrAssignments;
                if (id === "email-templates" && templatesCountQuery.data !== undefined) badge = templatesCountQuery.data;
                return { id, label: meta.label, icon: meta.icon, badge };
            }),
        [campaignsCountQuery.data, listsCountQuery.data, templatesCountQuery.data, mission._count.sdrAssignments]
    );

    const statusMeta = MISSION_STATUS_CONFIG[mission.status];
    const statusColors = STATUS_COLORS[mission.status];

    const channels = mission.channels && mission.channels.length > 0 ? mission.channels : [mission.channel];

    // Period progress
    const periodProgress = useMemo(() => {
        const start = new Date(mission.startDate).getTime();
        const end = new Date(mission.endDate).getTime();
        const now = Date.now();
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
        return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
    }, [mission.startDate, mission.endDate]);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
                <div className="px-6 pt-4 pb-3">
                    <div className="flex items-center gap-3 text-sm text-slate-500 mb-3">
                        <Link
                            href="/manager/missions"
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Missions
                        </Link>
                        <span className="text-slate-300">/</span>
                        <Link
                            href={`/manager/clients/${mission.clientId}`}
                            className="text-slate-600 hover:text-indigo-600 transition-colors truncate"
                        >
                            {mission.client.name}
                        </Link>
                        <ChevronRight className="w-3 h-3 text-slate-300" />
                        <span className="text-slate-900 font-medium truncate">{mission.name}</span>
                    </div>

                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                <Target className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-2xl font-bold text-slate-900 truncate">{mission.name}</h1>
                                    <IdChip id={mission.id} label="Mission ID" />
                                    <button
                                        onClick={() => setStatusDrawerOpen(true)}
                                        className={cn(
                                            "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border transition-colors hover:opacity-80",
                                            statusColors.bg,
                                            statusColors.text,
                                            statusColors.border
                                        )}
                                    >
                                        {mission.isActive ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                                        {statusMeta.label}
                                    </button>
                                </div>
                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                                    {channels.map((ch) => (
                                        <span key={ch} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded">
                                            {CHANNEL_ICONS[ch]}
                                            {ch}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setStatusDrawerOpen(true)}>
                                Changer statut
                            </Button>
                        </div>
                    </div>

                    {/* KPI row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <StatCard
                            label="SDRs assignés"
                            value={mission._count.sdrAssignments}
                            icon={Users}
                            iconBg="bg-indigo-100"
                            iconColor="text-indigo-600"
                        />
                        <StatCard
                            label="Campagnes"
                            value={campaignsCountQuery.data ?? mission._count.campaigns}
                            icon={Megaphone}
                            iconBg="bg-emerald-100"
                            iconColor="text-emerald-600"
                        />
                        <StatCard
                            label="Actions"
                            value={mission.stats?.totalActions ?? 0}
                            icon={Activity}
                            iconBg="bg-amber-100"
                            iconColor="text-amber-600"
                        />
                        <StatCard
                            label="RDV réservés"
                            value={mission.stats?.meetingsBooked ?? 0}
                            icon={Calendar}
                            iconBg="bg-pink-100"
                            iconColor="text-pink-600"
                        />
                    </div>

                    <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                            <span>
                                Période : {new Date(mission.startDate).toLocaleDateString("fr-FR")} →{" "}
                                {new Date(mission.endDate).toLocaleDateString("fr-FR")}
                            </span>
                            <span>{periodProgress}%</span>
                        </div>
                        <ProgressBar value={periodProgress} max={100} height="sm" />
                    </div>

                    <div className="mt-4 -mx-6 px-6 overflow-x-auto">
                        <Tabs
                            tabs={tabs}
                            activeTab={nav.tab}
                            onTabChange={(id) => nav.setTab(id as MissionTab)}
                            className="flex-nowrap"
                        />
                    </div>
                </div>
            </div>

            <div className="relative">
                <main
                    className={cn(
                        "transition-[margin] duration-200",
                        (nav.c || nav.l) && "lg:mr-[420px]"
                    )}
                >
                    <div className="p-6">
                        {missionQuery.isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-8 w-40" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : (
                            <TabContent tab={nav.tab} mission={mission} />
                        )}
                    </div>
                </main>
            </div>

            <MissionStatusWorkflowDrawer
                isOpen={statusDrawerOpen}
                onClose={() => setStatusDrawerOpen(false)}
                missionId={mission.id}
                missionName={mission.name}
                onSaved={() => missionQuery.refetch()}
            />
        </div>
    );
}

function TabContent({ tab, mission }: { tab: MissionTab; mission: MissionShellData }) {
    switch (tab) {
        case "overview":
            return <OverviewTab mission={mission} />;
        case "campaigns":
            return <CampaignsTab mission={mission} />;
        case "lists":
            return <ListsTab mission={mission} />;
        case "sdr-team":
            return <SdrTeamTab mission={mission} />;
        case "planning":
            return <PlanningTab mission={mission} />;
        case "email-templates":
            return <EmailTemplatesTab mission={mission} />;
        case "actions":
            return <ActionsTab mission={mission} />;
        case "reporting":
            return <ReportingTab mission={mission} />;
        case "prospect-sources":
            return <ProspectSourcesTab mission={mission} />;
        case "feedback":
            return <FeedbackTab mission={mission} />;
        case "comms":
            return <CommsTab mission={mission} />;
        case "files":
            return <FilesTab mission={mission} />;
        case "leexi":
            return <LeexiTab mission={mission} />;
        case "settings":
            return <SettingsTab mission={mission} />;
        default:
            return null;
    }
}

export default MissionDetailShell;
