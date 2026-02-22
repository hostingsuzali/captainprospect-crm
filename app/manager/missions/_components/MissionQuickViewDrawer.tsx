"use client";

import { Drawer } from "@/components/ui";
import { Users, Target, Calendar, Phone, Mail, Linkedin, ChevronRight, ArrowRight, ListChecks, ExternalLink, Zap, Globe, Activity } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CHANNEL_CONFIG = {
    CALL: {
        icon: Phone,
        label: "Appel",
        className: "mgr-channel-call",
        gradient: "from-blue-500 to-indigo-600",
        softBg: "bg-blue-50",
        text: "text-blue-600",
        ring: "ring-blue-200",
    },
    EMAIL: {
        icon: Mail,
        label: "Email",
        className: "mgr-channel-email",
        gradient: "from-violet-500 to-purple-600",
        softBg: "bg-violet-50",
        text: "text-violet-600",
        ring: "ring-violet-200",
    },
    LINKEDIN: {
        icon: Linkedin,
        label: "LinkedIn",
        className: "mgr-channel-linkedin",
        gradient: "from-sky-500 to-blue-600",
        softBg: "bg-sky-50",
        text: "text-sky-600",
        ring: "ring-sky-200",
    },
};

export function MissionQuickViewDrawer({
    isOpen,
    onClose,
    mission
}: {
    isOpen: boolean;
    onClose: () => void;
    mission: any | null;
}) {
    if (!mission) return <Drawer isOpen={isOpen} onClose={onClose} size="sm"><div /></Drawer>;

    const channelsList = mission.channels?.length ? mission.channels : [mission.channel];
    const channel = CHANNEL_CONFIG[mission.channel as keyof typeof CHANNEL_CONFIG];
    const ChannelIcon = channel?.icon || Phone;

    const memberCount = mission._count?.sdrAssignments ?? 0;
    const campaignCount = mission._count?.campaigns ?? 0;
    const listCount = mission._count?.lists ?? 0;
    const members = mission.sdrAssignments ?? [];

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            title="Aperçu de la mission"
            description="Informations clés et actions rapides"
        >
            <div className="space-y-6">

                {/* ─── HERO HEADER ─── */}
                <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5 blur-xl pointer-events-none" />
                    <div className="absolute -bottom-8 -left-6 w-24 h-24 rounded-full bg-indigo-600/20 blur-xl pointer-events-none" />
                    <div className="relative z-10">
                        <div className="flex items-start gap-4">
                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${channel?.gradient} flex items-center justify-center text-2xl font-bold text-white shadow-lg flex-shrink-0 ring-1 ring-white/20`}>
                                {mission.client?.name?.[0] || "M"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold leading-tight mb-0.5 truncate">{mission.name}</h2>
                                <p className="text-sm text-slate-400 font-medium mb-3">{mission.client?.name}</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                                        mission.isActive
                                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                            : "bg-white/10 text-white/60 border border-white/10"
                                    )}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${mission.isActive ? "bg-emerald-400" : "bg-white/40"}`} />
                                        {mission.isActive ? "Actif" : "En pause"}
                                    </span>
                                    {channelsList.length === 1 ? (
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border",
                                            channel?.softBg,
                                            channel?.text,
                                            "bg-white/10 text-white/80 border-white/20"
                                        )}>
                                            <ChannelIcon className="w-3 h-3" />
                                            {channel?.label}
                                        </span>
                                    ) : (
                                        channelsList.map((ch: keyof typeof CHANNEL_CONFIG) => {
                                            const cfg = CHANNEL_CONFIG[ch];
                                            const Icon = cfg?.icon ?? ChannelIcon;
                                            return (
                                                <span
                                                    key={ch}
                                                    className={cn(
                                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border",
                                                        cfg?.softBg ?? "bg-white/10",
                                                        cfg?.text ?? "text-white/80",
                                                        "border-white/20"
                                                    )}
                                                >
                                                    <Icon className="w-2.5 h-2.5" />
                                                    {cfg?.label ?? ch}
                                                </span>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── OBJECTIVE ─── */}
                {mission.objective && (
                    <div>
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5" /> Objectif
                        </h3>
                        <div className="p-4 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-violet-500 rounded-l-xl" />
                            <p className="text-sm text-slate-700 leading-relaxed pl-1">{mission.objective}</p>
                        </div>
                    </div>
                )}

                {/* ─── KPI STATS ─── */}
                <div>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" /> Statistiques
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            {
                                icon: Users,
                                label: "SDRs",
                                count: memberCount,
                                iconBg: "bg-indigo-100",
                                iconColor: "text-indigo-600",
                                valColor: "text-indigo-700",
                            },
                            {
                                icon: Target,
                                label: "Campagnes",
                                count: campaignCount,
                                iconBg: "bg-emerald-100",
                                iconColor: "text-emerald-600",
                                valColor: "text-emerald-700",
                            },
                            {
                                icon: ListChecks,
                                label: "Listes",
                                count: listCount,
                                iconBg: "bg-amber-100",
                                iconColor: "text-amber-600",
                                valColor: "text-amber-700",
                            },
                        ].map((s) => (
                            <div
                                key={s.label}
                                className="group p-4 bg-white border border-slate-200 rounded-xl text-center hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 transition-all"
                            >
                                <div className={`w-9 h-9 mx-auto rounded-xl ${s.iconBg} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform`}>
                                    <s.icon className={`w-4.5 h-4.5 ${s.iconColor}`} />
                                </div>
                                <p className={`text-2xl font-bold ${s.valColor}`}>{s.count}</p>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── TEAM MEMBERS ─── */}
                {members.length > 0 && (
                    <div>
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" /> Équipe ({memberCount})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {members.slice(0, 8).map((a: { sdr: { id: string; name: string } }) => (
                                <div
                                    key={a.sdr.id}
                                    title={a.sdr.name}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full hover:border-indigo-200 hover:bg-indigo-50 transition-all"
                                >
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-[9px] font-bold text-white">
                                        {a.sdr.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                    </div>
                                    <span className="text-xs font-medium text-slate-700">{a.sdr.name.split(" ")[0]}</span>
                                </div>
                            ))}
                            {members.length > 8 && (
                                <div className="flex items-center px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full">
                                    <span className="text-xs font-medium text-slate-500">+{members.length - 8}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── DATE PERIOD ─── */}
                <div>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Période
                    </h3>
                    <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex-1 text-center">
                            <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Début</p>
                            <p className="text-sm font-bold text-slate-800">
                                {mission.startDate ? new Date(mission.startDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                            <div className="w-8 h-px bg-slate-300" />
                            <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 text-center">
                            <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Fin</p>
                            <p className="text-sm font-bold text-slate-800">
                                {mission.endDate ? new Date(mission.endDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "En cours"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ─── ACTIONS ─── */}
                <div className="space-y-3 pt-2">
                    <Link
                        href={`/manager/missions/${mission.id}`}
                        className="w-full flex items-center justify-between gap-3 h-12 px-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25 group"
                    >
                        <span>Voir la fiche complète</span>
                        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                        </div>
                    </Link>
                    {mission._count?.campaigns > 0 && (
                        <Link
                            href={`/manager/campaigns`}
                            className="w-full flex items-center justify-between gap-3 h-11 px-5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 font-semibold rounded-xl transition-all text-sm group"
                        >
                            <span>Voir les campagnes</span>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </Link>
                    )}
                </div>
            </div>
        </Drawer>
    );
}
