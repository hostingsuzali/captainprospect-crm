"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Mail, Phone, Key, Trash2, UserCheck, UserX } from "lucide-react";
import {
    Button,
    Badge,
    DataTable,
    EmptyState,
    TableSkeleton,
    useToast,
    Modal,
    ModalFooter,
    Input,
    type Column,
} from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { ClientShellData } from "../ClientDetailShell";

interface ContactEntry {
    value: string;
    label: string;
    isPrimary: boolean;
}

interface Interlocuteur {
    id: string;
    firstName: string;
    lastName: string;
    title?: string;
    department?: string;
    territory?: string;
    emails: ContactEntry[];
    phones: ContactEntry[];
    bookingLinks: { label: string; url: string; durationMinutes: number }[];
    notes?: string;
    isActive: boolean;
    portalUser?: { id: string; email: string; name: string; isActive: boolean } | null;
}

export function InterlocuteursTab({ client }: { client: ClientShellData }) {
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Interlocuteur | null>(null);

    const query = useQuery({
        queryKey: qk.clientInterlocuteurs(client.id),
        queryFn: async () => {
            const res = await fetch(`/api/clients/${client.id}/interlocuteurs`);
            const json = await res.json();
            return (json?.data ?? []) as Interlocuteur[];
        },
        staleTime: 30_000,
    });

    const save = useMutation({
        mutationFn: async (payload: {
            id?: string;
            firstName: string;
            lastName: string;
            title?: string;
            department?: string;
            territory?: string;
            emails: ContactEntry[];
            phones: ContactEntry[];
            isActive: boolean;
        }) => {
            const isEdit = !!payload.id;
            const url = isEdit
                ? `/api/clients/${client.id}/interlocuteurs/${payload.id}`
                : `/api/clients/${client.id}/interlocuteurs`;
            const res = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            success("Interlocuteur enregistré");
            queryClient.invalidateQueries({ queryKey: qk.clientInterlocuteurs(client.id) });
            setShowModal(false);
            setEditing(null);
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const remove = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/clients/${client.id}/interlocuteurs/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            success("Interlocuteur supprimé");
            queryClient.invalidateQueries({ queryKey: qk.clientInterlocuteurs(client.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const togglePortal = useMutation({
        mutationFn: async ({ id, activate }: { id: string; activate: boolean }) => {
            const res = await fetch(`/api/clients/${client.id}/interlocuteurs/${id}/activate-portal`, {
                method: activate ? "POST" : "DELETE",
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: (_data, vars) => {
            success(vars.activate ? "Portail activé" : "Portail désactivé");
            queryClient.invalidateQueries({ queryKey: qk.clientInterlocuteurs(client.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const columns: Column<Interlocuteur>[] = [
        {
            key: "name",
            header: "Nom",
            render: (_, row) => (
                <div>
                    <div className="font-medium text-slate-900">
                        {row.firstName} {row.lastName}
                    </div>
                    <div className="text-xs text-slate-500">{row.title || "—"}</div>
                </div>
            ),
        },
        { key: "department", header: "Département", render: (_, row) => row.department || "—" },
        { key: "territory", header: "Territoire", render: (_, row) => row.territory || "—" },
        {
            key: "emails",
            header: "Emails",
            render: (_, row) => (
                <div className="flex flex-wrap gap-1 max-w-[240px]">
                    {(row.emails || []).slice(0, 2).map((e, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            <Mail className="w-3 h-3" />
                            {e.value}
                        </span>
                    ))}
                    {(row.emails?.length ?? 0) > 2 && (
                        <Badge variant="outline" className="text-[10px]">+{row.emails.length - 2}</Badge>
                    )}
                </div>
            ),
        },
        {
            key: "phones",
            header: "Téléphones",
            render: (_, row) => (
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {(row.phones || []).slice(0, 1).map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            <Phone className="w-3 h-3" />
                            {p.value}
                        </span>
                    ))}
                </div>
            ),
        },
        {
            key: "portal",
            header: "Portail",
            render: (_, row) =>
                row.portalUser ? (
                    <Badge variant={row.portalUser.isActive ? "success" : "outline"}>
                        {row.portalUser.isActive ? "Actif" : "Inactif"}
                    </Badge>
                ) : (
                    <Badge variant="outline">Aucun</Badge>
                ),
        },
        {
            key: "actions",
            header: "",
            render: (_, row) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => togglePortal.mutate({ id: row.id, activate: !row.portalUser })}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title={row.portalUser ? "Désactiver le portail" : "Activer le portail"}
                    >
                        {row.portalUser ? <UserX className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => {
                            setEditing(row);
                            setShowModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded"
                        title="Modifier"
                    >
                        <UserCheck className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => {
                            if (confirm("Supprimer cet interlocuteur ?")) remove.mutate(row.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Supprimer"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Interlocuteurs</h2>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                        setEditing(null);
                        setShowModal(true);
                    }}
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Nouvel interlocuteur
                </Button>
            </div>

            {query.isLoading ? (
                <TableSkeleton rows={5} columns={7} />
            ) : query.error ? (
                <ErrorCard message="Impossible de charger les interlocuteurs" onRetry={() => query.refetch()} />
            ) : (query.data ?? []).length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="Aucun interlocuteur"
                    description="Ajoutez les commerciaux du client."
                    action={
                        <Button
                            variant="primary"
                            onClick={() => {
                                setEditing(null);
                                setShowModal(true);
                            }}
                        >
                            Ajouter un interlocuteur
                        </Button>
                    }
                />
            ) : (
                <DataTable
                    data={query.data ?? []}
                    columns={columns}
                    keyField="id"
                    searchable
                    searchPlaceholder="Rechercher..."
                    searchFields={["firstName" as keyof Interlocuteur, "lastName" as keyof Interlocuteur, "title" as keyof Interlocuteur]}
                    pagination
                    pageSize={10}
                />
            )}

            <InterlocuteurModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditing(null);
                }}
                editing={editing}
                onSave={(payload) => save.mutate({ ...payload, id: editing?.id })}
                isSaving={save.isPending}
            />
        </div>
    );
}

function InterlocuteurModal({
    isOpen,
    onClose,
    editing,
    onSave,
    isSaving,
}: {
    isOpen: boolean;
    onClose: () => void;
    editing: Interlocuteur | null;
    onSave: (payload: {
        firstName: string;
        lastName: string;
        title?: string;
        department?: string;
        territory?: string;
        emails: ContactEntry[];
        phones: ContactEntry[];
        isActive: boolean;
    }) => void;
    isSaving: boolean;
}) {
    const [firstName, setFirstName] = useState(editing?.firstName ?? "");
    const [lastName, setLastName] = useState(editing?.lastName ?? "");
    const [title, setTitle] = useState(editing?.title ?? "");
    const [department, setDepartment] = useState(editing?.department ?? "");
    const [territory, setTerritory] = useState(editing?.territory ?? "");
    const [email, setEmail] = useState(editing?.emails?.[0]?.value ?? "");
    const [phone, setPhone] = useState(editing?.phones?.[0]?.value ?? "");
    const [isActive, setIsActive] = useState(editing?.isActive ?? true);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editing ? "Modifier l'interlocuteur" : "Nouvel interlocuteur"}
            size="lg"
        >
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <Input label="Prénom *" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    <Input label="Nom *" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <Input label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Directeur commercial" />
                <div className="grid grid-cols-2 gap-3">
                    <Input label="Département" value={department} onChange={(e) => setDepartment(e.target.value)} />
                    <Input label="Territoire" value={territory} onChange={(e) => setTerritory(e.target.value)} />
                </div>
                <Input label="Email principal" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input label="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4"
                    />
                    Actif
                </label>
            </div>
            <ModalFooter>
                <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                    Annuler
                </Button>
                <Button
                    variant="primary"
                    isLoading={isSaving}
                    disabled={!firstName.trim() || !lastName.trim() || isSaving}
                    onClick={() =>
                        onSave({
                            firstName: firstName.trim(),
                            lastName: lastName.trim(),
                            title: title.trim() || undefined,
                            department: department.trim() || undefined,
                            territory: territory.trim() || undefined,
                            emails: email.trim()
                                ? [{ value: email.trim(), label: "Principal", isPrimary: true }]
                                : [],
                            phones: phone.trim()
                                ? [{ value: phone.trim(), label: "Principal", isPrimary: true }]
                                : [],
                            isActive,
                        })
                    }
                >
                    Enregistrer
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default InterlocuteursTab;
