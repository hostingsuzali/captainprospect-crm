"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Save, BookOpen, ExternalLink } from "lucide-react";
import { Button, Input, Badge, Skeleton, useToast, Select } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import type { ClientShellData } from "../ClientDetailShell";

interface Mailbox {
    id: string;
    email: string;
    displayName?: string;
    isShared?: boolean;
}

export function PortalSettingsTab({ client }: { client: ClientShellData }) {
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();

    const [bookingUrl, setBookingUrl] = useState(client.bookingUrl ?? "");
    const [portalShowCallHistory, setPortalShowCallHistory] = useState(client.portalShowCallHistory);
    const [portalShowDatabase, setPortalShowDatabase] = useState(client.portalShowDatabase);
    const [rdvEmailNotificationsEnabled, setRdvEmailNotificationsEnabled] = useState(
        client.rdvEmailNotificationsEnabled
    );
    const [defaultMailboxId, setDefaultMailboxId] = useState<string>(client.defaultMailboxId ?? "");
    const [salesPlaybook, setSalesPlaybook] = useState<string>(
        typeof client.salesPlaybook === "string"
            ? client.salesPlaybook
            : client.salesPlaybook
            ? JSON.stringify(client.salesPlaybook, null, 2)
            : ""
    );

    useEffect(() => {
        setBookingUrl(client.bookingUrl ?? "");
        setPortalShowCallHistory(client.portalShowCallHistory);
        setPortalShowDatabase(client.portalShowDatabase);
        setRdvEmailNotificationsEnabled(client.rdvEmailNotificationsEnabled);
        setDefaultMailboxId(client.defaultMailboxId ?? "");
    }, [client]);

    const mailboxesQuery = useQuery({
        queryKey: qk.sharedMailboxes(),
        queryFn: async () => {
            const res = await fetch(`/api/email/mailboxes?includeShared=true`);
            const json = await res.json();
            return (json?.data ?? []) as Mailbox[];
        },
        staleTime: 60_000,
    });

    const save = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/clients/${client.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookingUrl: bookingUrl.trim() || "",
                    portalShowCallHistory,
                    portalShowDatabase,
                    rdvEmailNotificationsEnabled,
                    defaultMailboxId: defaultMailboxId || "",
                }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            success("Paramètres enregistrés");
            queryClient.invalidateQueries({ queryKey: qk.client(client.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-600" />
                    Paramètres portail
                </h2>
                <Button variant="primary" onClick={() => save.mutate()} isLoading={save.isPending}>
                    <Save className="w-4 h-4 mr-1" />
                    Enregistrer
                </Button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Booking & visibilité</h3>
                <Input
                    label="URL de réservation (Calendly, Cal.com, etc.)"
                    value={bookingUrl}
                    onChange={(e) => setBookingUrl(e.target.value)}
                    placeholder="https://calendly.com/..."
                />
                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={portalShowCallHistory}
                        onChange={(e) => setPortalShowCallHistory(e.target.checked)}
                        className="w-4 h-4 mt-0.5"
                    />
                    <div>
                        <div className="font-medium">Historique des appels visible au client</div>
                        <div className="text-xs text-slate-500">Le client peut voir l&apos;historique de prospection.</div>
                    </div>
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={portalShowDatabase}
                        onChange={(e) => setPortalShowDatabase(e.target.checked)}
                        className="w-4 h-4 mt-0.5"
                    />
                    <div>
                        <div className="font-medium">Base de données visible</div>
                        <div className="text-xs text-slate-500">Affiche les listes et contacts côté portail client.</div>
                    </div>
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={rdvEmailNotificationsEnabled}
                        onChange={(e) => setRdvEmailNotificationsEnabled(e.target.checked)}
                        className="w-4 h-4 mt-0.5"
                    />
                    <div>
                        <div className="font-medium">Notifications email RDV</div>
                        <div className="text-xs text-slate-500">Envoie un email au client quand un RDV est pris.</div>
                    </div>
                </label>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Mailbox par défaut</h3>
                {mailboxesQuery.isLoading ? (
                    <Skeleton className="h-10" />
                ) : (
                    <Select
                        value={defaultMailboxId}
                        onChange={(v) => setDefaultMailboxId(v)}
                        options={[
                            { value: "", label: "Aucune" },
                            ...((mailboxesQuery.data ?? []).map((m) => ({
                                value: m.id,
                                label: m.displayName ? `${m.displayName} (${m.email})` : m.email,
                            }))),
                        ]}
                        label="Mailbox sortante par défaut"
                    />
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-slate-400" /> Sales playbook
                </h3>
                <textarea
                    value={salesPlaybook}
                    onChange={(e) => setSalesPlaybook(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    placeholder="Rédigez le playbook commercial (markdown)..."
                />
                <p className="text-xs text-slate-500">
                    Le playbook n&apos;est pas sauvegardé dans cette version — la sauvegarde JSON passera par une prochaine itération.
                </p>
            </div>
        </div>
    );
}

export default PortalSettingsTab;
