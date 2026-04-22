"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "@/components/ui";
import { Building2, Calendar, Target, Users, Mail, Phone, Linkedin, ArrowRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MissionShellData } from "../MissionDetailShell";
import { useMissionNavState } from "../_hooks/useMissionNavState";

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
    CALL: <Phone className="w-3.5 h-3.5" />,
    EMAIL: <Mail className="w-3.5 h-3.5" />,
    LINKEDIN: <Linkedin className="w-3.5 h-3.5" />,
};

export function OverviewTab({ mission }: { mission: MissionShellData }) {
    const nav = useMissionNavState();

    const channels = mission.channels && mission.channels.length > 0 ? mission.channels : [mission.channel];
    const elapsedDays = Math.max(
        0,
        Math.round((Date.now() - new Date(mission.startDate).getTime()) / (1000 * 60 * 60 * 24))
    );
    const totalDays = mission.totalContractDays ?? Math.round(
        (new Date(mission.endDate).getTime() - new Date(mission.startDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Target className="w-4 h-4 text-indigo-600" />
                            Objectif
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                            {mission.objective || "Aucun objectif défini pour cette mission."}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-emerald-600" />
                            Client
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link
                            href={`/manager/clients/${mission.clientId}`}
                            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
                        >
                            {mission.client.name}
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-amber-600" />
                            Période & canaux
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Début</span>
                                <span className="text-slate-900 font-medium">
                                    {new Date(mission.startDate).toLocaleDateString("fr-FR")}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Fin</span>
                                <span className="text-slate-900 font-medium">
                                    {new Date(mission.endDate).toLocaleDateString("fr-FR")}
                                </span>
                            </div>
                            {totalDays > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Jours de contrat</span>
                                    <span className="text-slate-900 font-medium">
                                        {elapsedDays} / {totalDays}
                                    </span>
                                </div>
                            )}
                            <div className="pt-2 border-t border-slate-100">
                                <div className="text-xs text-slate-500 mb-1.5">Canaux</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {channels.map((ch) => (
                                        <Badge key={ch} variant="primary" className="flex items-center gap-1">
                                            {CHANNEL_ICONS[ch]}
                                            {ch}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="w-4 h-4 text-pink-600" />
                            Équipe SDR
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => nav.setTab("sdr-team")}>
                            Gérer <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {mission.teamLeadSdr && (
                            <div className="mb-3 p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <div className="text-[11px] uppercase tracking-wide text-indigo-600 font-semibold mb-0.5">
                                    Team Lead
                                </div>
                                <div className="text-sm text-slate-900">{mission.teamLeadSdr.name}</div>
                            </div>
                        )}
                        {(mission.sdrAssignments?.length ?? 0) === 0 ? (
                            <p className="text-sm text-slate-500 italic">Aucun SDR assigné</p>
                        ) : (
                            <ul className="space-y-1.5">
                                {mission.sdrAssignments!.map((a) => (
                                    <li key={a.id} className="flex items-center gap-2 text-sm">
                                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600 font-medium">
                                            {a.sdr.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-slate-900">{a.sdr.name}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-600" />
                        Accès rapide
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <QuickLink label="Campagnes" onClick={() => nav.setTab("campaigns")} count={mission._count.campaigns} />
                        <QuickLink label="Listes" onClick={() => nav.setTab("lists")} count={mission._count.lists} />
                        <QuickLink label="Templates" onClick={() => nav.setTab("email-templates")} />
                        <QuickLink label="Paramètres" onClick={() => nav.setTab("settings")} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function QuickLink({ label, onClick, count }: { label: string; onClick: () => void; count?: number }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors text-left"
            )}
        >
            <div className="text-xs text-slate-500">{label}</div>
            {count !== undefined && <div className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">{count}</div>}
        </button>
    );
}

export default OverviewTab;
