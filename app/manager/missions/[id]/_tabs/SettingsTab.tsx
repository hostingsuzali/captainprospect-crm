"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Save, Trash2, Key, Mail, Phone, Linkedin, AlertTriangle } from "lucide-react";
import {
    Button,
    Input,
    Badge,
    Skeleton,
    useToast,
    ConfirmModal,
    Select,
    MultiSelect,
} from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { MissionShellData } from "../MissionDetailShell";

interface Interlocuteur {
    id: string;
    firstName: string;
    lastName: string;
    title?: string | null;
}

interface ClientBooking {
    bookingUrl?: string | null;
    defaultInterlocuteurId?: string | null;
    interlocuteurs: Interlocuteur[];
}

interface ApiKeyData {
    id: string;
    name: string;
    keyPrefix?: string;
    lastUsedAt?: string | null;
    createdAt: string;
}

export function SettingsTab({ mission }: { mission: MissionShellData }) {
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();

    const [name, setName] = useState(mission.name);
    const [objective, setObjective] = useState(mission.objective ?? "");
    const [startDate, setStartDate] = useState(mission.startDate.slice(0, 10));
    const [endDate, setEndDate] = useState(mission.endDate.slice(0, 10));
    const [channels, setChannels] = useState<string[]>(
        (mission.channels && mission.channels.length > 0 ? mission.channels : [mission.channel]) as string[]
    );
    const [totalContractDays, setTotalContractDays] = useState<string>(
        mission.totalContractDays ? String(mission.totalContractDays) : ""
    );
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        setName(mission.name);
        setObjective(mission.objective ?? "");
        setStartDate(mission.startDate.slice(0, 10));
        setEndDate(mission.endDate.slice(0, 10));
        setChannels((mission.channels && mission.channels.length > 0 ? mission.channels : [mission.channel]) as string[]);
        setTotalContractDays(mission.totalContractDays ? String(mission.totalContractDays) : "");
    }, [mission]);

    const bookingQuery = useQuery({
        queryKey: qk.missionClientBooking(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/missions/${mission.id}/client-booking`);
            const json = await res.json();
            return (json?.data ?? json) as ClientBooking;
        },
    });

    const apiKeysQuery = useQuery({
        queryKey: qk.missionApiKeys(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/manager/api-keys?missionId=${mission.id}`);
            const json = await res.json();
            return (json?.data ?? []) as ApiKeyData[];
        },
    });

    const save = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/missions/${mission.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    objective,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                    channels,
                    totalContractDays: totalContractDays ? Number(totalContractDays) : null,
                }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            success("Mission enregistrée");
            queryClient.invalidateQueries({ queryKey: qk.mission(mission.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const saveBooking = useMutation({
        mutationFn: async ({
            defaultInterlocuteurId,
            bookingUrl,
        }: {
            defaultInterlocuteurId?: string | null;
            bookingUrl?: string | null;
        }) => {
            if (defaultInterlocuteurId !== undefined) {
                const r1 = await fetch(`/api/missions/${mission.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ defaultInterlocuteurId }),
                });
                const j1 = await r1.json();
                if (!r1.ok || j1.success === false) throw new Error(j1?.error || "Erreur");
            }
            if (bookingUrl !== undefined) {
                const r2 = await fetch(`/api/clients/${mission.clientId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bookingUrl }),
                });
                const j2 = await r2.json();
                if (!r2.ok || j2.success === false) throw new Error(j2?.error || "Erreur");
            }
        },
        onSuccess: () => {
            success("Booking enregistré");
            queryClient.invalidateQueries({ queryKey: qk.missionClientBooking(mission.id) });
            queryClient.invalidateQueries({ queryKey: qk.mission(mission.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const remove = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/missions/${mission.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
        },
        onSuccess: () => {
            success("Mission supprimée");
            window.location.href = "/manager/missions";
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-600" />
                    Paramètres de la mission
                </h2>
                <Button variant="primary" onClick={() => save.mutate()} isLoading={save.isPending}>
                    <Save className="w-4 h-4 mr-1" />
                    Enregistrer
                </Button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Objectif</label>
                    <textarea
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Input type="date" label="Début" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <Input type="date" label="Fin" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <Input
                    type="number"
                    label="Jours de contrat"
                    value={totalContractDays}
                    onChange={(e) => setTotalContractDays(e.target.value)}
                />
                <MultiSelect
                    label="Canaux"
                    value={channels}
                    onChange={(ids) => setChannels(ids)}
                    options={[
                        { value: "CALL", label: "Appels" },
                        { value: "EMAIL", label: "Email" },
                        { value: "LINKEDIN", label: "LinkedIn" },
                    ]}
                />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Booking client</h3>
                {bookingQuery.isLoading ? (
                    <Skeleton className="h-24" />
                ) : bookingQuery.error ? (
                    <ErrorCard message="Erreur" onRetry={() => bookingQuery.refetch()} />
                ) : (
                    <BookingForm
                        data={bookingQuery.data}
                        onSave={(payload) => saveBooking.mutate(payload)}
                        isSaving={saveBooking.isPending}
                    />
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Key className="w-4 h-4 text-slate-400" /> Clés API
                </h3>
                {apiKeysQuery.isLoading ? (
                    <Skeleton className="h-24" />
                ) : (apiKeysQuery.data ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">Aucune clé API pour cette mission.</p>
                ) : (
                    <ul className="space-y-2">
                        {(apiKeysQuery.data ?? []).map((k) => (
                            <li key={k.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                                <Key className="w-4 h-4 text-slate-400" />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-900">{k.name}</div>
                                    <div className="text-xs text-slate-500 font-mono">{k.keyPrefix || "—"}</div>
                                </div>
                                <IdChip id={k.id} length={6} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="bg-white border border-red-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Zone dangereuse
                </h3>
                <p className="text-sm text-slate-600">
                    Supprimer la mission supprimera également ses campagnes, listes, templates et assignations.
                </p>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="text-red-600 border-red-300 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-1" /> Supprimer la mission
                </Button>
            </div>

            <ConfirmModal
                isOpen={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={() => {
                    setConfirmDelete(false);
                    remove.mutate();
                }}
                title="Supprimer la mission"
                message={`Cette action est irréversible. Tapez le nom exact pour confirmer : ${mission.name}`}
                confirmLabel="Supprimer"
                variant="danger"
            />
        </div>
    );
}

function BookingForm({
    data,
    onSave,
    isSaving,
}: {
    data: ClientBooking | undefined;
    onSave: (payload: { defaultInterlocuteurId?: string | null; bookingUrl?: string | null }) => void;
    isSaving: boolean;
}) {
    const [bookingUrl, setBookingUrl] = useState(data?.bookingUrl ?? "");
    const [defaultInterlocuteurId, setDefaultInterlocuteurId] = useState(data?.defaultInterlocuteurId ?? "");

    useEffect(() => {
        setBookingUrl(data?.bookingUrl ?? "");
        setDefaultInterlocuteurId(data?.defaultInterlocuteurId ?? "");
    }, [data]);

    return (
        <div className="space-y-3">
            <Input
                label="Booking URL (niveau client)"
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="https://calendly.com/..."
            />
            <Select
                label="Commercial par défaut (mission)"
                value={defaultInterlocuteurId}
                onChange={(v) => setDefaultInterlocuteurId(v)}
                options={[
                    { value: "", label: "Aucun" },
                    ...(data?.interlocuteurs ?? []).map((i) => ({
                        value: i.id,
                        label: `${i.firstName} ${i.lastName}${i.title ? ` — ${i.title}` : ""}`,
                    })),
                ]}
            />
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        onSave({ bookingUrl: bookingUrl.trim() || null, defaultInterlocuteurId: defaultInterlocuteurId || null })
                    }
                    isLoading={isSaving}
                >
                    <Save className="w-4 h-4 mr-1" /> Enregistrer booking
                </Button>
            </div>
        </div>
    );
}

export default SettingsTab;
