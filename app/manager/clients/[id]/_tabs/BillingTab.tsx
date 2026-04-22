"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt, FileText, User, Plus, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
    Button,
    Badge,
    EmptyState,
    Skeleton,
    Tabs,
    DataTable,
    type Column,
} from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { ClientShellData } from "../ClientDetailShell";
import { useClientNavState } from "../_hooks/useClientNavState";

interface Engagement {
    id: string;
    name: string;
    amount: number;
    currency: string;
    status: string;
    startDate?: string;
    endDate?: string;
}

interface Invoice {
    id: string;
    number: string;
    amount: number;
    currency: string;
    status: string;
    issuedAt: string;
    dueAt?: string;
}

interface BillingProfile {
    id: string;
    legalName?: string | null;
    vatNumber?: string | null;
    address?: string | null;
    email?: string | null;
}

export function BillingTab({ client }: { client: ClientShellData }) {
    const nav = useClientNavState();
    const sub = nav.sub ?? "engagements";

    const engagementsQuery = useQuery({
        queryKey: qk.clientEngagements(client.id),
        queryFn: async () => {
            const res = await fetch(`/api/billing/engagements?clientId=${client.id}`);
            const json = await res.json();
            return (json?.data ?? []) as Engagement[];
        },
        enabled: sub === "engagements",
    });

    const invoicesQuery = useQuery({
        queryKey: client.billingClientId ? qk.clientInvoices(client.billingClientId) : ["no-billing"],
        queryFn: async () => {
            const res = await fetch(`/api/billing/invoices?billingClientId=${client.billingClientId}`);
            const json = await res.json();
            return (json?.data ?? []) as Invoice[];
        },
        enabled: sub === "invoices" && !!client.billingClientId,
    });

    const profileQuery = useQuery({
        queryKey: client.billingClientId ? qk.clientBillingProfile(client.billingClientId) : ["no-billing"],
        queryFn: async () => {
            const res = await fetch(`/api/billing/clients/${client.billingClientId}`);
            const json = await res.json();
            return (json?.data ?? null) as BillingProfile | null;
        },
        enabled: sub === "profile" && !!client.billingClientId,
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-indigo-600" />
                    Facturation
                </h2>
            </div>

            <Tabs
                tabs={[
                    { id: "engagements", label: "Engagements" },
                    { id: "invoices", label: "Factures" },
                    { id: "profile", label: "Profil" },
                ]}
                activeTab={sub}
                onTabChange={(id) => nav.setSub(id)}
                variant="pills"
            />

            {sub === "engagements" && <EngagementsSection query={engagementsQuery} clientId={client.id} />}
            {sub === "invoices" && (
                client.billingClientId ? (
                    <InvoicesSection query={invoicesQuery} billingClientId={client.billingClientId} />
                ) : (
                    <EmptyState
                        icon={Receipt}
                        title="Pas de profil de facturation"
                        description="Ce client n'a pas encore de profil de facturation lié."
                    />
                )
            )}
            {sub === "profile" && (
                client.billingClientId ? (
                    <ProfileSection query={profileQuery} billingClientId={client.billingClientId} />
                ) : (
                    <EmptyState
                        icon={User}
                        title="Pas de profil"
                        description="Créez un profil de facturation depuis la page Facturation."
                    />
                )
            )}
        </div>
    );
}

function EngagementsSection({
    query,
    clientId,
}: {
    query: ReturnType<typeof useQuery<Engagement[]>>;
    clientId: string;
}) {
    const columns: Column<Engagement>[] = [
        { key: "name", header: "Nom" },
        {
            key: "amount",
            header: "Montant",
            render: (_, row) => (
                <span className="tabular-nums">
                    {row.amount.toLocaleString("fr-FR")} {row.currency}
                </span>
            ),
        },
        {
            key: "status",
            header: "Statut",
            render: (_, row) => <Badge variant={row.status === "ACTIVE" ? "success" : "outline"}>{row.status}</Badge>,
        },
        {
            key: "period",
            header: "Période",
            render: (_, row) => (
                <span className="text-xs text-slate-600">
                    {row.startDate ? new Date(row.startDate).toLocaleDateString("fr-FR") : "—"} →{" "}
                    {row.endDate ? new Date(row.endDate).toLocaleDateString("fr-FR") : "—"}
                </span>
            ),
        },
    ];

    if (query.isLoading) return <Skeleton className="h-40" />;
    if (query.error) return <ErrorCard message="Erreur" onRetry={() => query.refetch()} />;
    const rows = query.data ?? [];
    if (rows.length === 0) {
        return (
            <EmptyState
                icon={FileText}
                title="Aucun engagement"
                description="Créez un engagement depuis la page Facturation."
                action={
                    <Link href={`/manager/billing?clientId=${clientId}`}>
                        <Button variant="primary">
                            <Plus className="w-4 h-4 mr-1" /> Créer
                        </Button>
                    </Link>
                }
            />
        );
    }
    return <DataTable data={rows} columns={columns} keyField="id" pagination pageSize={10} />;
}

function InvoicesSection({
    query,
    billingClientId,
}: {
    query: ReturnType<typeof useQuery<Invoice[]>>;
    billingClientId: string;
}) {
    const columns: Column<Invoice>[] = [
        {
            key: "number",
            header: "Numéro",
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{row.number}</span>
                    <IdChip id={row.id} length={5} />
                </div>
            ),
        },
        {
            key: "amount",
            header: "Montant",
            render: (_, row) => (
                <span className="tabular-nums">
                    {row.amount.toLocaleString("fr-FR")} {row.currency}
                </span>
            ),
        },
        {
            key: "status",
            header: "Statut",
            render: (_, row) => (
                <Badge variant={row.status === "PAID" ? "success" : row.status === "OVERDUE" ? "danger" : "warning"}>
                    {row.status}
                </Badge>
            ),
        },
        {
            key: "issuedAt",
            header: "Émise le",
            render: (_, row) => new Date(row.issuedAt).toLocaleDateString("fr-FR"),
        },
    ];

    if (query.isLoading) return <Skeleton className="h-40" />;
    if (query.error) return <ErrorCard message="Erreur" onRetry={() => query.refetch()} />;
    const rows = query.data ?? [];
    if (rows.length === 0) {
        return <EmptyState icon={Receipt} title="Aucune facture" />;
    }
    return <DataTable data={rows} columns={columns} keyField="id" pagination pageSize={10} />;
}

function ProfileSection({
    query,
    billingClientId,
}: {
    query: ReturnType<typeof useQuery<BillingProfile | null>>;
    billingClientId: string;
}) {
    if (query.isLoading) return <Skeleton className="h-40" />;
    if (query.error) return <ErrorCard message="Erreur" onRetry={() => query.refetch()} />;
    const profile = query.data;
    if (!profile) return <EmptyState icon={User} title="Aucun profil" />;

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <IdChip id={profile.id} label="Billing ID" />
                </div>
                <Link href={`/manager/billing/clients/${profile.id}`}>
                    <Button variant="outline" size="sm">
                        Modifier <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </Button>
                </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <div className="text-xs text-slate-500">Nom légal</div>
                    <div>{profile.legalName || "—"}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500">TVA</div>
                    <div>{profile.vatNumber || "—"}</div>
                </div>
                <div className="col-span-2">
                    <div className="text-xs text-slate-500">Adresse</div>
                    <div className="whitespace-pre-wrap">{profile.address || "—"}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500">Email</div>
                    <div>{profile.email || "—"}</div>
                </div>
            </div>
        </div>
    );
}

export default BillingTab;
