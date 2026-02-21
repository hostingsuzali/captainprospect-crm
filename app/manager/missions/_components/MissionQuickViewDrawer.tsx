"use client";

import { Drawer } from "@/components/ui";
import { Users, Target, Calendar, Phone, Mail, Linkedin, ChevronRight, Activity, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CHANNEL_CONFIG = {
    CALL: { icon: Phone, label: "Appel", className: "mgr-channel-call" },
    EMAIL: { icon: Mail, label: "Email", className: "mgr-channel-email" },
    LINKEDIN: { icon: Linkedin, label: "LinkedIn", className: "mgr-channel-linkedin" },
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

    const channel = CHANNEL_CONFIG[mission.channel as keyof typeof CHANNEL_CONFIG];
    const ChannelIcon = channel?.icon || Phone;

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            title="Aperçu rapide"
            description="Informations clés de la mission"
        >
            <div className="space-y-8">
                {/* Header Profile */}
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-indigo-500/20 flex-shrink-0">
                        {mission.client?.name?.[0] || "M"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h2 className="text-xl font-bold text-slate-900 truncate">{mission.name}</h2>
                        </div>
                        <p className="text-sm font-medium text-slate-500">{mission.client?.name}</p>
                        <div className="flex items-center gap-2 mt-3">
                            <span className={cn(
                                "px-2 py-0.5 text-xs font-semibold rounded-full",
                                mission.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                            )}>
                                {mission.isActive ? "Actif" : "En pause"}
                            </span>
                            <span className={cn("px-2 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1", channel?.className)}>
                                <ChannelIcon className="w-3 h-3" />
                                {channel?.label}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Objective */}
                {mission.objective && (
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Objectif</h3>
                        <div className="p-4 bg-white border border-slate-200 rounded-xl">
                            <p className="text-sm text-slate-700 leading-relaxed">{mission.objective}</p>
                        </div>
                    </div>
                )}

                {/* Key Stats */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Statistiques</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-4 bg-white border border-slate-200 rounded-xl text-center group hover:border-indigo-200 transition-colors">
                            <div className="w-8 h-8 mx-auto rounded-full bg-indigo-50 flex items-center justify-center mb-2 group-hover:bg-indigo-100 transition-colors">
                                <Users className="w-4 h-4 text-indigo-600" />
                            </div>
                            <p className="text-2xl font-bold text-slate-900">{mission._count?.sdrAssignments || 0}</p>
                            <p className="text-[10px] font-medium text-slate-500 uppercase">SDRs</p>
                        </div>
                        <div className="p-4 bg-white border border-slate-200 rounded-xl text-center group hover:border-emerald-200 transition-colors">
                            <div className="w-8 h-8 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-2 group-hover:bg-emerald-100 transition-colors">
                                <Target className="w-4 h-4 text-emerald-600" />
                            </div>
                            <p className="text-2xl font-bold text-slate-900">{mission._count?.campaigns || 0}</p>
                            <p className="text-[10px] font-medium text-slate-500 uppercase">Campagnes</p>
                        </div>
                        <div className="p-4 bg-white border border-slate-200 rounded-xl text-center group hover:border-amber-200 transition-colors">
                            <div className="w-8 h-8 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-2 group-hover:bg-amber-100 transition-colors">
                                <Calendar className="w-4 h-4 text-amber-600" />
                            </div>
                            <p className="text-2xl font-bold text-slate-900">{mission._count?.lists || 0}</p>
                            <p className="text-[10px] font-medium text-slate-500 uppercase">Listes</p>
                        </div>
                    </div>
                </div>

                {/* Activity Sparkline Mockup */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Activité récente
                    </h3>
                    <div className="h-24 bg-gradient-to-b from-slate-50 to-white border border-slate-200 rounded-xl w-full flex items-end p-2 gap-1 justify-between">
                        {/* Fake bars for elegance */}
                        {[40, 60, 45, 80, 50, 90, 70, 85, 60, 100].map((h, i) => (
                            <div key={i} className="w-full bg-indigo-100 rounded-t-sm hover:bg-indigo-400 transition-colors cursor-pointer" style={{ height: `${h}%` }}></div>
                        ))}
                    </div>
                </div>

                {/* Timetable */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Période</h3>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm flex justify-between items-center text-slate-600">
                        <span className="font-medium">{mission.startDate ? new Date(mission.startDate).toLocaleDateString("fr-FR") : "—"}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{mission.endDate ? new Date(mission.endDate).toLocaleDateString("fr-FR") : "En cours"}</span>
                    </div>
                </div>

                {/* Action button */}
                <div className="pt-4">
                    <Link
                        href={`/manager/missions/${mission.id}`}
                        className="w-full flex items-center justify-center gap-2 h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-indigo-500/20"
                    >
                        Voir la fiche complète
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </Drawer>
    );
}
