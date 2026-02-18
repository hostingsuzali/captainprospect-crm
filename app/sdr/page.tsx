"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, Badge, Button, Drawer } from "@/components/ui";
import Link from "next/link";
import { CompanyDrawer, ContactDrawer } from "@/components/drawers";
import {
    Phone,
    Calendar,
    Clock,
    Briefcase,
    Target,
    ChevronRight,
    TrendingUp,
    Zap,
    Users,
    Mail,
    Linkedin,
    Play,
    Loader2,
    Activity,
    User,
    Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface SDRStats {
    actionsToday: number;
    meetingsBooked: number;
    callbacksPending: number;
    opportunitiesGenerated: number;
    weeklyProgress: number;
}

interface Mission {
    id: string;
    name: string;
    channel: "CALL" | "EMAIL" | "LINKEDIN";
    client: { name: string };
    progress: number;
    contactsRemaining: number;
    _count: {
        lists: number;
        campaigns: number;
    };
}

interface SDRActionItem {
    id: string;
    contactId: string | null;
    companyId: string | null;
    result: string;
    resultLabel: string;
    channel: string;
    campaignName?: string;
    contactName?: string;
    companyName?: string;
    note?: string;
    createdAt: string;
}

// Shape expected by ContactDrawer / CompanyDrawer
interface DrawerContact {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    title: string | null;
    linkedin: string | null;
    status: "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";
    companyId: string;
    companyName?: string;
    missionId?: string;
}

interface DrawerCompany {
    id: string;
    name: string;
    industry: string | null;
    country: string | null;
    website: string | null;
    size: string | null;
    status: "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";
    missionId?: string;
    contacts: Array<{
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        phone: string | null;
        title: string | null;
        linkedin: string | null;
        status: "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";
        companyId: string;
    }>;
    _count: { contacts: number };
}

// ============================================
// CHANNEL ICONS
// ============================================

const CHANNEL_ICONS = {
    CALL: Phone,
    EMAIL: Mail,
    LINKEDIN: Linkedin,
};

const CHANNEL_COLORS = {
    CALL: "text-emerald-500 bg-emerald-50",
    EMAIL: "text-blue-500 bg-blue-50",
    LINKEDIN: "text-sky-500 bg-sky-50",
};

// ============================================
// SDR DASHBOARD PAGE
// ============================================

export default function SDRDashboardPage() {
    const { data: session } = useSession();
    const [stats, setStats] = useState<SDRStats | null>(null);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [actionsPeriod, setActionsPeriod] = useState<"today" | "all">("today");
    const [myActions, setMyActions] = useState<SDRActionItem[]>([]);
    const [actionsLoading, setActionsLoading] = useState(false);
    // Drawer: open contact or company fiche with edit
    const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
    const [drawerCompanyId, setDrawerCompanyId] = useState<string | null>(null);
    const [drawerContact, setDrawerContact] = useState<DrawerContact | null>(null);
    const [drawerCompany, setDrawerCompany] = useState<DrawerCompany | null>(null);
    const [drawerLoading, setDrawerLoading] = useState(false);

    // ============================================
    // FETCH DATA
    // ============================================

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch stats
                const statsRes = await fetch("/api/sdr/stats");
                const statsJson = await statsRes.json();
                if (statsJson.success) {
                    setStats(statsJson.data);
                }

                // Fetch missions
                const missionsRes = await fetch("/api/sdr/missions");
                const missionsJson = await missionsRes.json();
                if (missionsJson.success) {
                    setMissions(missionsJson.data);
                    // Get selected mission from localStorage
                    const saved = localStorage.getItem("sdr_selected_mission");
                    if (saved && missionsJson.data.some((m: Mission) => m.id === saved)) {
                        setSelectedMissionId(saved);
                    } else if (missionsJson.data.length > 0) {
                        setSelectedMissionId(missionsJson.data[0].id);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch data:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // Listen for mission changes
    useEffect(() => {
        const handleMissionChange = (e: CustomEvent) => {
            setSelectedMissionId(e.detail);
        };
        window.addEventListener("sdr_mission_changed", handleMissionChange as EventListener);
        return () => {
            window.removeEventListener("sdr_mission_changed", handleMissionChange as EventListener);
        };
    }, []);

    // Fetch my actions (calls and actions) for Today / All time
    useEffect(() => {
        const fetchMyActions = async () => {
            setActionsLoading(true);
            try {
                const res = await fetch(`/api/sdr/actions?period=${actionsPeriod}&limit=50`);
                const json = await res.json();
                if (json.success) {
                    setMyActions(json.data);
                }
            } catch (err) {
                console.error("Failed to fetch my actions:", err);
            } finally {
                setActionsLoading(false);
            }
        };
        fetchMyActions();
    }, [actionsPeriod]);

    // Fetch contact when opening contact drawer
    useEffect(() => {
        if (!drawerContactId) {
            setDrawerContact(null);
            return;
        }
        setDrawerLoading(true);
        fetch(`/api/contacts/${drawerContactId}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.success && json.data) {
                    const c = json.data;
                    setDrawerContact({
                        id: c.id,
                        firstName: c.firstName,
                        lastName: c.lastName,
                        email: c.email,
                        phone: c.phone,
                        title: c.title,
                        linkedin: c.linkedin,
                        status: c.status ?? "PARTIAL",
                        companyId: c.company?.id ?? "",
                        companyName: c.company?.name ?? undefined,
                        missionId: (c.company as { list?: { mission?: { id: string } } })?.list?.mission?.id,
                    });
                } else {
                    setDrawerContact(null);
                }
            })
            .catch(() => setDrawerContact(null))
            .finally(() => setDrawerLoading(false));
    }, [drawerContactId]);

    // Fetch company when opening company drawer
    useEffect(() => {
        if (!drawerCompanyId) {
            setDrawerCompany(null);
            return;
        }
        setDrawerLoading(true);
        fetch(`/api/companies/${drawerCompanyId}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.success && json.data) {
                    const co = json.data;
                    setDrawerCompany({
                        id: co.id,
                        name: co.name,
                        industry: co.industry,
                        country: co.country,
                        website: co.website,
                        size: co.size,
                        status: co.status ?? "PARTIAL",
                        missionId: (co.list as { mission?: { id: string } })?.mission?.id,
                        contacts: (co.contacts ?? []).map((ct: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; title: string | null; linkedin: string | null; status: string; companyId: string }) => ({
                            id: ct.id,
                            firstName: ct.firstName,
                            lastName: ct.lastName,
                            email: ct.email,
                            phone: ct.phone,
                            title: ct.title,
                            linkedin: ct.linkedin,
                            status: (ct.status ?? "PARTIAL") as "INCOMPLETE" | "PARTIAL" | "ACTIONABLE",
                            companyId: ct.companyId,
                        })),
                        _count: { contacts: co._count?.contacts ?? co.contacts?.length ?? 0 },
                    });
                } else {
                    setDrawerCompany(null);
                }
            })
            .catch(() => setDrawerCompany(null))
            .finally(() => setDrawerLoading(false));
    }, [drawerCompanyId]);

    const openFicheForAction = (item: SDRActionItem) => {
        if (item.contactId) {
            setDrawerCompanyId(null);
            setDrawerContactId(item.contactId);
        } else if (item.companyId) {
            setDrawerContactId(null);
            setDrawerCompanyId(item.companyId);
        }
    };

    const closeContactDrawer = () => {
        setDrawerContactId(null);
        setDrawerContact(null);
    };

    const closeCompanyDrawer = () => {
        setDrawerCompanyId(null);
        setDrawerCompany(null);
    };

    const handleContactFromCompany = (contact: { id: string }) => {
        setDrawerCompanyId(null);
        setDrawerCompany(null);
        setDrawerContactId(contact.id);
    };

    const activeMission = missions.find(m => m.id === selectedMissionId);
    const ChannelIcon = activeMission ? CHANNEL_ICONS[activeMission.channel] : Phone;

    // ============================================
    // GREETING
    // ============================================

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Bonjour";
        if (hour < 18) return "Bon après-midi";
        return "Bonsoir";
    };

    // ============================================
    // LOADING STATE
    // ============================================

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">Chargement du dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Welcome Header */}
            <div className="text-center py-4">
                <h1 className="text-2xl font-bold text-slate-900">
                    {getGreeting()}, {session?.user?.name?.split(" ")[0] ?? "vous"} ! 👋
                </h1>
                <p className="text-slate-500 mt-1">
                    Voici votre journée en un coup d'œil
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <Card className="!p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <Phone className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{stats?.actionsToday || 0}</p>
                            <p className="text-xs text-slate-500">Appels faits aujourd'hui</p>
                        </div>
                    </div>
                </Card>

                <Card className="!p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-emerald-600">{stats?.meetingsBooked || 0}</p>
                            <p className="text-xs text-slate-500">RDV pris</p>
                        </div>
                    </div>
                </Card>

                <Card className="!p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-amber-600">{stats?.callbacksPending || 0}</p>
                            <p className="text-xs text-slate-500">Rappels en attente</p>
                        </div>
                    </div>
                </Card>

                <Card className="!p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                            <Briefcase className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-purple-600">{stats?.opportunitiesGenerated || 0}</p>
                            <p className="text-xs text-slate-500">Contacts chauds</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* No missions assigned */}
            {missions.length === 0 && (
                <Card className="!p-6 border-dashed border-2 bg-slate-50/50 text-center">
                    <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="font-semibold text-slate-700">Aucune mission assignée</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Contactez votre manager pour être assigné à une mission.
                    </p>
                </Card>
            )}

            {/* Active Mission Card */}
            {activeMission && (
                <Card className="!p-0 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-4 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Target className="w-5 h-5" />
                                <span className="font-medium">Mission Active</span>
                            </div>
                            <Badge variant="outline" className="!bg-white/20 !text-white !border-white/30">
                                <ChannelIcon className="w-3 h-3 mr-1" />
                                {activeMission.channel === "CALL" ? "Appel" : activeMission.channel === "EMAIL" ? "Email" : "LinkedIn"}
                            </Badge>
                        </div>
                    </div>

                    <div className="p-4 space-y-4 bg-white">
                        <div>
                            <h3 className="font-semibold text-lg text-slate-900">{activeMission.name}</h3>
                            <p className="text-sm text-slate-500">{activeMission.client.name}</p>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Progression</span>
                                <span className="font-medium text-indigo-600">{activeMission.progress || 0}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                                    style={{ width: `${activeMission.progress || 0}%` }}
                                />
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600">{activeMission.contactsRemaining || 0} contacts restants</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600">{activeMission._count?.campaigns || 0} campagnes</span>
                            </div>
                        </div>

                        {/* CTA Button */}
                        <Link href="/sdr/action" className="block">
                            <Button variant="primary" size="lg" className="w-full gap-2">
                                <Play className="w-5 h-5" />
                                Commencer à appeler
                            </Button>
                        </Link>
                    </div>
                </Card>
            )}

            {/* Other Missions */}
            {missions.length > 1 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900">Autres Missions</h2>
                        <span className="text-xs text-slate-500">{missions.length} missions assignées</span>
                    </div>

                    <div className="space-y-2">
                        {missions
                            .filter(m => m.id !== selectedMissionId)
                            .slice(0, 3)
                            .map((mission) => {
                                const Icon = CHANNEL_ICONS[mission.channel];
                                return (
                                    <Card
                                        key={mission.id}
                                        className="!p-3 hover:border-indigo-300 cursor-pointer transition-all"
                                        onClick={() => {
                                            setSelectedMissionId(mission.id);
                                            localStorage.setItem("sdr_selected_mission", mission.id);
                                            window.dispatchEvent(new CustomEvent("sdr_mission_changed", { detail: mission.id }));
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                                CHANNEL_COLORS[mission.channel]
                                            )}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-slate-900 truncate">{mission.name}</h3>
                                                <p className="text-xs text-slate-500 truncate">{mission.client.name}</p>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-400" />
                                        </div>
                                    </Card>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* My calls and actions — click opens contact or company fiche */}
            <Card className="!p-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" />
                        Mes appels et actions
                    </h2>
                    <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                        <button
                            type="button"
                            onClick={() => setActionsPeriod("today")}
                            className={cn(
                                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                                actionsPeriod === "today"
                                    ? "bg-white text-indigo-600 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            Aujourd'hui
                        </button>
                        <button
                            type="button"
                            onClick={() => setActionsPeriod("all")}
                            className={cn(
                                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                                actionsPeriod === "all"
                                    ? "bg-white text-indigo-600 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            Tout
                        </button>
                    </div>
                </div>
                {actionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    </div>
                ) : myActions.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">
                        {actionsPeriod === "today" ? "Aucune action aujourd'hui." : "Aucune action enregistrée."}
                    </p>
                ) : (
                    <ul className="space-y-1 max-h-[280px] overflow-y-auto">
                        {myActions.map((item) => {
                            const name = item.contactName || item.companyName || "—";
                            const hasFiche = !!(item.contactId || item.companyId);
                            return (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => hasFiche && openFicheForAction(item)}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                                            hasFiche
                                                ? "hover:bg-indigo-50 cursor-pointer"
                                                : "cursor-default"
                                        )}
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                            {item.contactId ? (
                                                <User className="w-4 h-4 text-slate-500" />
                                            ) : (
                                                <Building2 className="w-4 h-4 text-slate-500" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-900 truncate">{name}</p>
                                            <p className="text-xs text-slate-500">
                                                {item.resultLabel}
                                                {item.campaignName ? ` · ${item.campaignName}` : ""}
                                            </p>
                                        </div>
                                        <span className="text-xs text-slate-400 flex-shrink-0">
                                            {new Date(item.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                        {hasFiche && (
                                            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>

            {/* Quick Tips */}
            <Card className="!p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="font-medium text-amber-900">Astuce du jour</h3>
                        <p className="text-sm text-amber-700 mt-1">
                            Utilisez les raccourcis clavier (1-6) lors des actions pour gagner du temps.
                            Appuyez sur Entrée pour valider rapidement.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Weekly Progress (evolution vs last week) */}
            {stats && (
                <Card className="!p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-slate-900">Évolution vs semaine dernière</h3>
                        <div className="flex items-center gap-1 text-emerald-600 text-sm">
                            <TrendingUp className="w-4 h-4" />
                            <span>{stats.weeklyProgress != null && stats.weeklyProgress >= 0 ? "Beau travail !" : "À toi de jouer"}</span>
                        </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(Math.max(stats.weeklyProgress ?? 0, 0), 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        {stats.weeklyProgress != null && stats.weeklyProgress > 0
                            ? "Tu as fait plus d'actions cette semaine que la précédente."
                            : stats.weeklyProgress === 0
                                ? "Même rythme que la semaine dernière."
                                : "Continue comme ça !"}
                    </p>
                </Card>
            )}

            {/* Loading drawer when fetching contact/company */}
            {(drawerContactId || drawerCompanyId) && drawerLoading && (
                <Drawer
                    isOpen
                    onClose={() => {
                        setDrawerContactId(null);
                        setDrawerCompanyId(null);
                    }}
                    title="Chargement..."
                >
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                </Drawer>
            )}

            {/* Contact fiche drawer — view and edit */}
            {drawerContactId && drawerContact && (
                <ContactDrawer
                    isOpen={!!drawerContactId}
                    onClose={closeContactDrawer}
                    contact={drawerContact}
                    onUpdate={(updated) => setDrawerContact(updated)}
                    isManager={true}
                    companies={[]}
                />
            )}

            {/* Company fiche drawer — view and edit */}
            {drawerCompanyId && drawerCompany && (
                <CompanyDrawer
                    isOpen={!!drawerCompanyId}
                    onClose={closeCompanyDrawer}
                    company={drawerCompany}
                    onUpdate={(updated) => setDrawerCompany(updated)}
                    onContactClick={handleContactFromCompany}
                    isManager={true}
                />
            )}
        </div>
    );
}
