"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui";
import { RefreshCw, ArrowRight, Calendar, Sparkles, PhoneCall, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientOnboardingModal } from "@/components/client/ClientOnboardingModal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { DashboardSkeleton } from "@/components/client/skeletons";

interface DashboardStats {
    totalActions: number;
    meetingsBooked: number;
    contactsReached: number;
    lastActivityDate: string | null;
    monthlyObjective: number;
    activeMissions: number;
}

interface ClientMeeting {
    id: string;
    createdAt: string;
    callbackDate?: string | null;
    note?: string | null;
    contact: {
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
        company: { name: string };
    };
    campaign: {
        name: string;
        mission: { name: string };
    };
}

interface Mission {
    id: string;
    name: string;
    isActive: boolean;
}

const MONTH_NAMES = [
    "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon apres-midi";
    return "Bonsoir";
}

function formatRelativeDate(dateString: string | null): string {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "aujourd'hui";
    if (diffDays === 1) return "hier";
    if (diffDays < 7) return `il y a ${diffDays} jours`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatMeetingDate(dateString: string): string {
    const d = new Date(dateString);
    return d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
}

export default function ClientPortal() {
    const { data: session, update } = useSession();
    const toast = useToast();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [upcomingMeetings, setUpcomingMeetings] = useState<ClientMeeting[]>([]);
    const [missionName, setMissionName] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [dismissedForThisVisit, setDismissedForThisVisit] = useState(false);
    const showOnboarding =
        session?.user?.role === "CLIENT" &&
        !(session.user as { clientOnboardingDismissedPermanently?: boolean })?.clientOnboardingDismissedPermanently &&
        !dismissedForThisVisit;

    const handleDismissOnboardingPermanently = async () => {
        const res = await fetch("/api/client/onboarding-dismissed", { method: "PATCH" });
        if (!res.ok) throw new Error("Failed to dismiss");
        await update();
    };

    const clientId = (session?.user as { clientId?: string })?.clientId;
    const userName = session?.user?.name?.split(" ")[0] ?? "Client";

    const now = new Date();
    const currentMonth = MONTH_NAMES[now.getMonth()];
    const currentYear = now.getFullYear();

    const fetchData = useCallback(async (refresh = false) => {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        try {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            const startDate = monthStart.toISOString().split("T")[0];
            const endDate = monthEnd.toISOString().split("T")[0];

            const [statsRes, missionsRes, meetingsRes] = await Promise.all([
                fetch(`/api/stats?startDate=${startDate}&endDate=${endDate}`),
                fetch("/api/missions?isActive=true"),
                clientId ? fetch(`/api/clients/${clientId}/meetings`) : Promise.resolve(null),
            ]);

            const [statsJson, missionsJson, meetingsJson] = await Promise.all([
                statsRes.json(),
                missionsRes.json(),
                meetingsRes?.ok ? meetingsRes.json() : Promise.resolve(null),
            ]);

            if (statsJson.success) setStats(statsJson.data);
            if (missionsJson.success) {
                const missions = Array.isArray(missionsJson.data) ? missionsJson.data as Mission[] : [];
                setMissionName(missions[0]?.name ?? "");
            }
            if (meetingsJson?.success) {
                const allMeetings: ClientMeeting[] = meetingsJson.data?.allMeetings ?? [];
                const upcoming = allMeetings
                    .filter((m) => {
                        const meetingDate = m.callbackDate || m.createdAt;
                        return new Date(meetingDate) >= new Date();
                    })
                    .sort((a, b) => {
                        const da = new Date(a.callbackDate || a.createdAt).getTime();
                        const db = new Date(b.callbackDate || b.createdAt).getTime();
                        return da - db;
                    })
                    .slice(0, 5);
                setUpcomingMeetings(upcoming);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast.error("Erreur de chargement", "Impossible de charger les donnees");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading && !stats) {
        return <DashboardSkeleton />;
    }

    const meetingsBooked = stats?.meetingsBooked ?? 0;
    const objective = stats?.monthlyObjective ?? 10;
    const pctComplete = objective > 0 ? Math.round((meetingsBooked / objective) * 100) : 0;

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-8">
            {/* Greeting bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
                <div>
                    <h1 className="text-2xl font-bold text-[#12122A] tracking-tight">
                        {getGreeting()}, <span className="gradient-text">{userName}</span>
                    </h1>
                    <p className="text-sm text-[#6B7194] mt-1">
                        {currentMonth} {currentYear}
                        {missionName && <> &middot; <span className="font-medium text-[#4A4B6A]">{missionName}</span></>}
                    </p>
                </div>
                <button
                    onClick={() => fetchData(true)}
                    disabled={isRefreshing}
                    className="w-10 h-10 rounded-xl border border-[#E8EBF0] flex items-center justify-center text-[#6B7194] hover:text-[#7C5CFC] hover:border-[#7C5CFC]/30 transition-all duration-300 disabled:opacity-50 bg-white/80 backdrop-blur-sm hover:shadow-md hover:shadow-[#7C5CFC]/10"
                    title="Rafraichir"
                    aria-label="Actualiser les donnees"
                >
                    <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                </button>
            </div>

            {/* Hero Card -- Gradient */}
            <div
                className="relative overflow-hidden rounded-2xl p-6 md:p-8 shadow-xl animate-fade-up"
                style={{
                    animationDelay: "80ms",
                    background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 35%, #4338CA 70%, #6366F1 100%)",
                }}
            >
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4" />
                <div className="absolute top-6 right-8 opacity-20">
                    <Sparkles className="w-6 h-6 text-white animate-float" />
                </div>

                <div className="relative flex flex-col md:flex-row gap-8">
                    {/* Left: RDV counter + ring */}
                    <div className="flex-1 flex flex-col items-center md:items-start">
                        <p className="text-xs font-semibold text-indigo-200 uppercase tracking-[0.15em]">
                            Rendez-vous ce mois
                        </p>
                        <div className="mt-4 flex items-end gap-3">
                            <AnimatedNumber
                                value={meetingsBooked}
                                className="text-7xl font-black text-white drop-shadow-lg"
                            />
                            <span className="text-lg text-indigo-200/80 mb-3 font-medium">
                                sur {objective}
                            </span>
                        </div>
                        <p className="text-sm text-indigo-200/70 mt-1">
                            {pctComplete}% de l&apos;objectif atteint
                        </p>
                        <div className="mt-6 animate-pulse-glow rounded-full">
                            <ProgressRing
                                value={meetingsBooked}
                                max={objective}
                                size={130}
                                strokeWidth={12}
                                variant="glow"
                            />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="hidden md:block w-px bg-white/10" />
                    <div className="md:hidden border-t border-white/10" />

                    {/* Right: Pace stats */}
                    <div className="flex-1">
                        <p className="text-xs font-semibold text-indigo-200 uppercase tracking-[0.15em] mb-6">
                            En cours de mission
                        </p>
                        <div className="space-y-5">
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors">
                                        <PhoneCall className="w-4 h-4 text-indigo-200" />
                                    </div>
                                    <span className="text-sm text-indigo-200/80">Appels realises</span>
                                </div>
                                <AnimatedNumber
                                    value={stats?.totalActions ?? 0}
                                    className="text-xl font-bold text-white"
                                />
                            </div>
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors">
                                        <Users className="w-4 h-4 text-indigo-200" />
                                    </div>
                                    <span className="text-sm text-indigo-200/80">Contacts joints</span>
                                </div>
                                <AnimatedNumber
                                    value={stats?.contactsReached ?? 0}
                                    className="text-xl font-bold text-white"
                                />
                            </div>
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors">
                                        <Clock className="w-4 h-4 text-indigo-200" />
                                    </div>
                                    <span className="text-sm text-indigo-200/80">Derniere activite</span>
                                </div>
                                <span className="text-xl font-bold text-white">
                                    {formatRelativeDate(stats?.lastActivityDate ?? null)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upcoming Meetings */}
            <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: "160ms" }}>
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C5CFC] to-[#A78BFA] flex items-center justify-center shadow-sm shadow-[#7C5CFC]/20">
                            <Calendar className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="text-sm font-semibold text-[#12122A] uppercase tracking-wider">
                            Prochains RDV
                        </h2>
                    </div>
                    <Link
                        href="/client/portal/meetings"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7C5CFC] hover:text-[#6C3AFF] transition-colors group"
                    >
                        Voir tout <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>
                {upcomingMeetings.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F4F6F9] to-[#E8EBF0] flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-6 h-6 text-[#A0A3BD]" />
                        </div>
                        <p className="text-sm font-medium text-[#6B7194]">Aucun RDV a venir</p>
                        <p className="text-xs text-[#A0A3BD] mt-1 max-w-xs mx-auto">
                            Les prochains RDV planifies par votre equipe apparaitront ici.
                        </p>
                    </div>
                ) : (
                    <div className="stagger-children space-y-1">
                        {upcomingMeetings.map((m, idx) => {
                            const contactName = [m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "Contact";
                            const companyName = m.contact.company.name;
                            const dateStr = formatMeetingDate(m.callbackDate || m.createdAt);
                            return (
                                <Link
                                    key={m.id}
                                    href="/client/portal/meetings"
                                    className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-gradient-to-r hover:from-[#F8F7FF] hover:to-transparent transition-all duration-300 group border border-transparent hover:border-[#7C5CFC]/10"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] flex items-center justify-center flex-shrink-0 group-hover:from-[#7C5CFC] group-hover:to-[#A78BFA] transition-all duration-300">
                                        <ArrowRight className="w-3.5 h-3.5 text-[#7C5CFC] group-hover:text-white group-hover:translate-x-0.5 transition-all duration-300" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-semibold text-[#12122A] capitalize">
                                            {dateStr}
                                        </span>
                                        <span className="text-sm text-[#6B7194]">
                                            {" — "}{contactName}, <span className="text-[#4A4B6A]">{companyName}</span>
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Client onboarding modal */}
            <ClientOnboardingModal
                isOpen={showOnboarding}
                onClose={() => setDismissedForThisVisit(true)}
                onDismissPermanently={handleDismissOnboardingPermanently}
            />
        </div>
    );
}
