"use client";

import { useQuery } from "@tanstack/react-query";
import { Target, Mic, CalendarCheck, Users, ArrowRight, Activity, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, Badge, Skeleton, Button } from "@/components/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { qk } from "@/lib/query-keys";
import type { ClientShellData } from "../ClientDetailShell";
import { useClientNavState } from "../_hooks/useClientNavState";

interface MissionRow {
    id: string;
    name: string;
    status: string;
    isActive: boolean;
    channels: string[];
    startDate: string;
    endDate: string;
    _count: { sdrAssignments: number; campaigns: number; lists: number };
    sdrAssignments?: { sdr: { id: string; name: string } }[];
}

interface SessionRow {
    id: string;
    type: string;
    date: string;
    recordingUrl?: string;
    tasks: { id: string; doneAt?: string | null }[];
}

export function OverviewTab({ client }: { client: ClientShellData }) {
    const nav = useClientNavState();

    const missionsQuery = useQuery({
        queryKey: qk.clientMissions(client.id),
        queryFn: async () => {
            const res = await fetch(`/api/missions?clientId=${client.id}&limit=20`);
            const json = await res.json();
            return (json?.data ?? []) as MissionRow[];
        },
        staleTime: 30_000,
    });

    const sessionsQuery = useQuery({
        queryKey: qk.clientSessions(client.id),
        queryFn: async () => {
            const res = await fetch(`/api/clients/${client.id}/sessions`);
            const json = await res.json();
            return (json?.data ?? []) as SessionRow[];
        },
        staleTime: 30_000,
    });

    const activeMissions = (missionsQuery.data ?? []).filter((m) => m.status === "ACTIVE");
    const upcomingSessions = (sessionsQuery.data ?? [])
        .filter((s) => new Date(s.date).getTime() >= Date.now())
        .slice(0, 3);

    return (
        <div className="space-y-6">
            {/* Contact & next meeting banner */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Informations client</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <div className="text-xs text-slate-500 mb-0.5">Nom</div>
                            <div className="text-slate-900 font-medium">{client.name}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 mb-0.5">Email</div>
                            <div className="text-slate-900">{client.email || "—"}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 mb-0.5">Téléphone</div>
                            <div className="text-slate-900">{client.phone || "—"}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 mb-0.5">Industrie</div>
                            <div className="text-slate-900">{client.industry || "—"}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 mb-0.5">Booking URL</div>
                            <div className="text-slate-900 truncate">
                                {client.bookingUrl ? (
                                    <a href={client.bookingUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                        Lien
                                    </a>
                                ) : (
                                    "—"
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 mb-0.5">Client depuis</div>
                            <div className="text-slate-900">{new Date(client.createdAt).toLocaleDateString("fr-FR")}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Active missions */}
            <Card>
                <CardHeader className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Target className="w-4 h-4 text-indigo-600" />
                        Missions actives ({activeMissions.length})
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => nav.setTab("missions")}>
                        Voir tout <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {missionsQuery.isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Skeleton className="h-24" />
                            <Skeleton className="h-24" />
                        </div>
                    ) : missionsQuery.error ? (
                        <ErrorCard message="Impossible de charger les missions" onRetry={() => missionsQuery.refetch()} />
                    ) : activeMissions.length === 0 ? (
                        <p className="text-sm text-slate-500 py-4 text-center">Aucune mission active</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {activeMissions.slice(0, 4).map((m) => {
                                const progress = computeProgress(m.startDate, m.endDate);
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => {
                                            nav.setTab("missions");
                                            nav.setM(m.id);
                                        }}
                                        className="text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="font-medium text-slate-900 truncate">{m.name}</div>
                                            <Badge variant="success" className="text-[10px]">
                                                {m._count.sdrAssignments} SDR
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-slate-500 mb-2">
                                            {(m.channels || []).join(" · ")}
                                        </div>
                                        <ProgressBar value={progress} max={100} height="sm" />
                                        <div className="text-[11px] text-slate-500 mt-1">{progress}% période</div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Next sessions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <CalendarCheck className="w-4 h-4 text-emerald-600" />
                            Prochaines sessions
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => nav.setTab("sessions")}>
                            Voir tout <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {sessionsQuery.isLoading ? (
                            <Skeleton className="h-24" />
                        ) : upcomingSessions.length === 0 ? (
                            <p className="text-sm text-slate-500 py-4 text-center">Aucune session programmée</p>
                        ) : (
                            <ul className="space-y-2">
                                {upcomingSessions.map((s) => (
                                    <li
                                        key={s.id}
                                        className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                                        onClick={() => {
                                            nav.setTab("sessions");
                                            nav.setS(s.id);
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Badge variant="primary" className="text-[10px]">{s.type}</Badge>
                                            <span className="text-sm text-slate-700">
                                                {new Date(s.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        </div>
                                        {s.recordingUrl && <Mic className="w-3.5 h-3.5 text-slate-400" />}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Activity className="w-4 h-4 text-amber-600" />
                            Activité récente
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-500 py-4 text-center">
                            L&apos;activité s&apos;affichera ici (en cours de connexion au feed unifié).
                        </p>
                        <div className="flex justify-center">
                            <Link href={`/manager/clients/${client.id}?tab=reporting`}>
                                <Button variant="ghost" size="sm">
                                    Voir rapport complet <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Portal access info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Users className="w-4 h-4 text-pink-600" />
                        Accès portail
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Utilisateurs :</span>
                            <span className="font-medium text-slate-900">{client._count.users}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Historique appels :</span>
                            <Badge variant={client.portalShowCallHistory ? "success" : "outline"}>
                                {client.portalShowCallHistory ? "Visible" : "Masqué"}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Base de données :</span>
                            <Badge variant={client.portalShowDatabase ? "success" : "outline"}>
                                {client.portalShowDatabase ? "Visible" : "Masqué"}
                            </Badge>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => nav.setTab("portal-settings")} className="ml-auto">
                            Configurer
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function computeProgress(start: string, end: string): number {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const n = Date.now();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
    return Math.max(0, Math.min(100, Math.round(((n - s) / (e - s)) * 100)));
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1 text-sm text-red-800">{message}</div>
            <Button variant="outline" size="sm" onClick={onRetry}>Réessayer</Button>
        </div>
    );
}

export default OverviewTab;
