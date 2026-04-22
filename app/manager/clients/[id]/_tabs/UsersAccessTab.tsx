"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, Mail, Trash2, Key, Copy, Check } from "lucide-react";
import {
    Button,
    Badge,
    EmptyState,
    Skeleton,
    useToast,
    Modal,
    ModalFooter,
    Input,
    Tabs,
} from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { ClientShellData } from "../ClientDetailShell";
import { useClientNavState } from "../_hooks/useClientNavState";

interface PortalUser {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    lastSignInAt?: string | null;
    lastConnectedAt?: string | null;
}

export function UsersAccessTab({ client }: { client: ClientShellData }) {
    const nav = useClientNavState();
    const sub = nav.sub ?? "users";
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();
    const [showCreate, setShowCreate] = useState(false);
    const [credentials, setCredentials] = useState<{ email: string; password?: string } | null>(null);

    const usersQuery = useQuery({
        queryKey: qk.clientUsers(client.id),
        queryFn: async () => {
            const res = await fetch(`/api/users?clientId=${client.id}&limit=100`);
            const json = await res.json();
            return (json?.data ?? []) as PortalUser[];
        },
        staleTime: 30_000,
    });

    const permissionsQuery = useQuery({
        queryKey: qk.permissions(),
        queryFn: async () => {
            const res = await fetch(`/api/permissions`);
            const json = await res.json();
            return json?.data ?? [];
        },
        enabled: sub === "permissions",
        staleTime: 60_000,
    });

    const mailboxesQuery = useQuery({
        queryKey: qk.sharedMailboxes(),
        queryFn: async () => {
            const res = await fetch(`/api/email/mailboxes?includeShared=true`);
            const json = await res.json();
            return json?.data ?? [];
        },
        enabled: sub === "mailbox",
        staleTime: 60_000,
    });

    const createUser = useMutation({
        mutationFn: async (payload: { name: string; email: string; password?: string }) => {
            const res = await fetch(`/api/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: payload.name,
                    email: payload.email,
                    password: payload.password,
                    role: "CLIENT",
                    clientId: client.id,
                }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: (data, vars) => {
            success("Utilisateur créé");
            queryClient.invalidateQueries({ queryKey: qk.clientUsers(client.id) });
            setCredentials({ email: vars.email, password: vars.password });
            setShowCreate(false);
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const removeUser = useMutation({
        mutationFn: async (userId: string) => {
            const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            success("Utilisateur supprimé");
            queryClient.invalidateQueries({ queryKey: qk.clientUsers(client.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Utilisateurs & accès</h2>
                <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Inviter un utilisateur
                </Button>
            </div>

            <Tabs
                tabs={[
                    { id: "users", label: "Utilisateurs", badge: usersQuery.data?.length ?? undefined },
                    { id: "permissions", label: "Permissions" },
                    { id: "mailbox", label: "Accès mailboxes" },
                ]}
                activeTab={sub}
                onTabChange={(id) => nav.setSub(id)}
                variant="pills"
            />

            {sub === "users" && (
                <>
                    {usersQuery.isLoading ? (
                        <Skeleton className="h-40" />
                    ) : usersQuery.error ? (
                        <ErrorCard message="Impossible de charger les utilisateurs" onRetry={() => usersQuery.refetch()} />
                    ) : (usersQuery.data ?? []).length === 0 ? (
                        <EmptyState
                            icon={ShieldCheck}
                            title="Aucun utilisateur portail"
                            description="Invitez vos premiers utilisateurs côté client."
                            action={<Button variant="primary" onClick={() => setShowCreate(true)}>Inviter</Button>}
                        />
                    ) : (
                        <ul className="space-y-2">
                            {(usersQuery.data ?? []).map((u) => (
                                <li key={u.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-medium">
                                        {u.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-slate-900 truncate">{u.name}</span>
                                            <IdChip id={u.id} length={6} />
                                            <Badge variant={u.isActive ? "success" : "outline"}>
                                                {u.isActive ? "Actif" : "Inactif"}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <Mail className="w-3 h-3" />
                                            {u.email}
                                            {u.lastSignInAt && (
                                                <span className="ml-2">• Dernière connexion: {new Date(u.lastSignInAt).toLocaleDateString("fr-FR")}</span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (confirm(`Supprimer ${u.name} ?`)) removeUser.mutate(u.id);
                                        }}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {sub === "permissions" && (
                <div>
                    {permissionsQuery.isLoading ? (
                        <Skeleton className="h-40" />
                    ) : (
                        <div className="p-6 bg-white border border-slate-200 rounded-xl">
                            <p className="text-sm text-slate-700 mb-2">
                                Matrice des permissions (lecture seule ici — configurez-la par utilisateur depuis leur fiche).
                            </p>
                            <ul className="text-sm text-slate-600 space-y-1">
                                {(permissionsQuery.data ?? []).slice(0, 10).map((p: { id: string; name: string; description?: string }) => (
                                    <li key={p.id} className="flex items-center gap-2">
                                        <Key className="w-3.5 h-3.5 text-slate-400" />
                                        {p.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {sub === "mailbox" && (
                <div>
                    {mailboxesQuery.isLoading ? (
                        <Skeleton className="h-40" />
                    ) : (
                        <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-3">
                            <p className="text-sm text-slate-700">
                                Liste des mailboxes disponibles. La gestion fine par utilisateur se fait depuis la page Email.
                            </p>
                            <ul className="text-sm text-slate-700 space-y-1">
                                {(mailboxesQuery.data ?? []).map((m: { id: string; email: string; displayName?: string }) => (
                                    <li key={m.id} className="flex items-center gap-2">
                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                        {m.displayName || m.email}
                                        <span className="text-xs text-slate-500">{m.email}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {showCreate && (
                <CreateUserModal
                    isOpen={showCreate}
                    onClose={() => setShowCreate(false)}
                    onCreate={(payload) => createUser.mutate(payload)}
                    isSaving={createUser.isPending}
                />
            )}

            {credentials && (
                <CredentialsModal
                    credentials={credentials}
                    onClose={() => setCredentials(null)}
                />
            )}
        </div>
    );
}

function CreateUserModal({
    isOpen,
    onClose,
    onCreate,
    isSaving,
}: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (payload: { name: string; email: string; password?: string }) => void;
    isSaving: boolean;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState(generatePassword());

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Inviter un utilisateur" size="md">
            <div className="space-y-3">
                <Input label="Nom *" value={name} onChange={(e) => setName(e.target.value)} />
                <Input label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <div className="flex items-end gap-2">
                    <Input
                        label="Mot de passe (facultatif)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="flex-1"
                    />
                    <Button variant="outline" size="sm" onClick={() => setPassword(generatePassword())}>
                        Générer
                    </Button>
                </div>
            </div>
            <ModalFooter>
                <Button variant="ghost" onClick={onClose} disabled={isSaving}>Annuler</Button>
                <Button
                    variant="primary"
                    onClick={() => onCreate({ name: name.trim(), email: email.trim(), password })}
                    disabled={!name.trim() || !email.trim() || isSaving}
                    isLoading={isSaving}
                >
                    Créer
                </Button>
            </ModalFooter>
        </Modal>
    );
}

function CredentialsModal({
    credentials,
    onClose,
}: {
    credentials: { email: string; password?: string };
    onClose: () => void;
}) {
    const { success } = useToast();
    const [copied, setCopied] = useState<"email" | "pass" | null>(null);
    const copy = (text: string, which: "email" | "pass") => {
        navigator.clipboard.writeText(text);
        setCopied(which);
        success("Copié");
        setTimeout(() => setCopied(null), 1200);
    };
    return (
        <Modal isOpen onClose={onClose} title="Identifiants créés" size="md">
            <div className="space-y-3 text-sm">
                <p className="text-slate-600">
                    Copiez ces identifiants maintenant, ils ne seront plus affichés.
                </p>
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                    <span className="font-mono text-slate-900 flex-1">{credentials.email}</span>
                    <button onClick={() => copy(credentials.email, "email")} className="p-1.5 text-slate-500 hover:text-indigo-600">
                        {copied === "email" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                </div>
                {credentials.password && (
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                        <span className="font-mono text-slate-900 flex-1">{credentials.password}</span>
                        <button onClick={() => copy(credentials.password!, "pass")} className="p-1.5 text-slate-500 hover:text-indigo-600">
                            {copied === "pass" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                )}
            </div>
            <ModalFooter>
                <Button variant="primary" onClick={onClose}>Fermer</Button>
            </ModalFooter>
        </Modal>
    );
}

function generatePassword(length = 14): string {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let out = "";
    for (let i = 0; i < length; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
}

export default UsersAccessTab;
