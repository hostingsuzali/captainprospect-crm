"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Crown, UserMinus, Calendar as CalendarIcon } from "lucide-react";
import { Button, Badge, EmptyState, Skeleton, useToast, Modal, ModalFooter, Tabs, MultiSelect } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { MissionShellData } from "../MissionDetailShell";
import { useMissionNavState } from "../_hooks/useMissionNavState";

interface SdrUser {
    id: string;
    name: string;
    email: string;
    role: string;
}

export function SdrTeamTab({ mission }: { mission: MissionShellData }) {
    const nav = useMissionNavState();
    const sub = nav.sub ?? "assignments";
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();
    const [showAssignModal, setShowAssignModal] = useState(false);

    const assignments = mission.sdrAssignments ?? [];

    const sdrsQuery = useQuery({
        queryKey: qk.sdrUsers(),
        queryFn: async () => {
            const res = await fetch(`/api/users?role=SDR&limit=200`);
            const json = await res.json();
            return (json?.data ?? []) as SdrUser[];
        },
        enabled: showAssignModal,
    });

    const availabilityQuery = useQuery({
        queryKey: qk.missionSdrAvailability(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/missions/${mission.id}/sdr-availability`);
            const json = await res.json();
            return (json?.data ?? []) as {
                sdrId: string;
                sdrName: string;
                month: string;
                daysAvailable: number;
                daysPlanned: number;
            }[];
        },
        enabled: sub === "availability",
    });

    const assign = useMutation({
        mutationFn: async (sdrIds: string[]) => {
            for (const sdrId of sdrIds) {
                const res = await fetch(`/api/missions/${mission.id}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sdrId }),
                });
                const json = await res.json();
                if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            }
        },
        onSuccess: () => {
            success("SDRs assignés");
            queryClient.invalidateQueries({ queryKey: qk.mission(mission.id) });
            setShowAssignModal(false);
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const unassign = useMutation({
        mutationFn: async (sdrId: string) => {
            const res = await fetch(`/api/missions/${mission.id}?sdrId=${sdrId}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
        },
        onSuccess: () => {
            success("SDR retiré");
            queryClient.invalidateQueries({ queryKey: qk.mission(mission.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const setTeamLead = useMutation({
        mutationFn: async (sdrId: string | null) => {
            const res = await fetch(`/api/missions/${mission.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamLeadSdrId: sdrId }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
        },
        onSuccess: () => {
            success("Team lead mis à jour");
            queryClient.invalidateQueries({ queryKey: qk.mission(mission.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const availableSdrs = (sdrsQuery.data ?? []).filter(
        (s) => !assignments.some((a) => a.sdr.id === s.id)
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Équipe SDR
                </h2>
                <Button variant="primary" size="sm" onClick={() => setShowAssignModal(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Assigner un SDR
                </Button>
            </div>

            <Tabs
                tabs={[
                    { id: "assignments", label: "Affectations", badge: assignments.length },
                    { id: "availability", label: "Disponibilités" },
                ]}
                activeTab={sub}
                onTabChange={(id) => nav.setSub(id)}
                variant="pills"
            />

            {sub === "assignments" && (
                <>
                    {assignments.length === 0 ? (
                        <EmptyState icon={Users} title="Aucun SDR" description="Assignez des SDRs pour cette mission." />
                    ) : (
                        <ul className="space-y-2">
                            {assignments.map((a) => {
                                const isLead = a.sdr.id === mission.teamLeadSdrId;
                                return (
                                    <li
                                        key={a.id}
                                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-medium">
                                            {a.sdr.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-slate-900">{a.sdr.name}</span>
                                                <IdChip id={a.sdr.id} length={6} />
                                                {isLead && (
                                                    <Badge variant="warning">
                                                        <Crown className="w-3 h-3 mr-1" /> Team Lead
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">{a.sdr.email}</div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setTeamLead.mutate(isLead ? null : a.sdr.id)}
                                            isLoading={setTeamLead.isPending}
                                            title={isLead ? "Retirer Team Lead" : "Définir comme Team Lead"}
                                        >
                                            <Crown className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                if (confirm(`Retirer ${a.sdr.name} ?`)) unassign.mutate(a.sdr.id);
                                            }}
                                            className="text-red-600 hover:bg-red-50"
                                        >
                                            <UserMinus className="w-4 h-4" />
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}

            {sub === "availability" && (
                <div>
                    {availabilityQuery.isLoading ? (
                        <Skeleton className="h-40" />
                    ) : availabilityQuery.error ? (
                        <ErrorCard message="Impossible de charger les disponibilités" onRetry={() => availabilityQuery.refetch()} />
                    ) : (availabilityQuery.data ?? []).length === 0 ? (
                        <EmptyState icon={CalendarIcon} title="Aucune disponibilité" description="Les disponibilités SDR pour cette mission ne sont pas renseignées." />
                    ) : (
                        <ul className="space-y-2">
                            {(availabilityQuery.data ?? []).map((a, i) => (
                                <li key={i} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                    <div>
                                        <div className="font-medium text-slate-900">{a.sdrName}</div>
                                        <div className="text-xs text-slate-500">{a.month}</div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="tabular-nums">
                                            <span className="text-emerald-600 font-medium">{a.daysAvailable}</span>
                                            <span className="text-slate-400 mx-1">/</span>
                                            <span className="text-slate-600">{a.daysPlanned}</span>
                                            <span className="text-xs text-slate-500 ml-1">jours</span>
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <AssignSdrModal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                available={availableSdrs}
                isLoading={sdrsQuery.isLoading}
                onAssign={(ids) => assign.mutate(ids)}
                isSaving={assign.isPending}
            />
        </div>
    );
}

function AssignSdrModal({
    isOpen,
    onClose,
    available,
    isLoading,
    onAssign,
    isSaving,
}: {
    isOpen: boolean;
    onClose: () => void;
    available: SdrUser[];
    isLoading: boolean;
    onAssign: (ids: string[]) => void;
    isSaving: boolean;
}) {
    const [selected, setSelected] = useState<string[]>([]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Assigner des SDRs" size="md">
            {isLoading ? (
                <Skeleton className="h-40" />
            ) : available.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">Tous les SDRs sont déjà assignés.</p>
            ) : (
                <MultiSelect
                    label="SDRs disponibles"
                    options={available.map((s) => ({ value: s.id, label: `${s.name} (${s.email})` }))}
                    value={selected}
                    onChange={setSelected}
                    placeholder="Sélectionner..."
                />
            )}
            <ModalFooter>
                <Button variant="ghost" onClick={onClose} disabled={isSaving}>Annuler</Button>
                <Button
                    variant="primary"
                    onClick={() => onAssign(selected)}
                    disabled={selected.length === 0 || isSaving}
                    isLoading={isSaving}
                >
                    Assigner {selected.length > 0 ? `(${selected.length})` : ""}
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default SdrTeamTab;
