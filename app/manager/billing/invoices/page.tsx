"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import {
    Plus,
    FileText,
    RefreshCw,
    Search,
    Loader2,
    FileX2,
    Receipt,
    ArrowRight,
    Filter,
    Banknote,
} from "lucide-react";
import { Button, Badge, Input, Select } from "@/components/ui";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Invoice {
    id: string;
    invoiceNumber: string | null;
    status: "DRAFT" | "VALIDATED" | "SENT" | "PAID" | "CANCELLED" | "PARTIALLY_PAID";
    documentType: "INVOICE" | "CREDIT_NOTE";
    issueDate: string;
    dueDate: string;
    totalTtc: number;
    billingClient: {
        id: string;
        legalName: string;
    };
    _count: {
        items: number;
        payments: number;
        creditNotes: number;
    };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; borderColor: string }> = {
    DRAFT: { label: "Brouillon", color: "text-slate-600", bg: "bg-slate-100", dot: "bg-slate-400", borderColor: "border-slate-200" },
    VALIDATED: { label: "Validée", color: "text-indigo-700", bg: "bg-indigo-50", dot: "bg-indigo-500", borderColor: "border-indigo-200" },
    SENT: { label: "Envoyée", color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500", borderColor: "border-amber-200" },
    PAID: { label: "Payée", color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500", borderColor: "border-emerald-200" },
    CANCELLED: { label: "Annulée", color: "text-red-700", bg: "bg-red-50", dot: "bg-red-500", borderColor: "border-red-200" },
    PARTIALLY_PAID: { label: "Part. payée", color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500", borderColor: "border-amber-200" },
};

export default function InvoicesPage() {
    const { success, error: showError } = useToast();
    const router = useRouter();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== "all") params.set("status", statusFilter);
            if (searchQuery) params.set("search", searchQuery);
            const res = await fetch(`/api/billing/invoices?${params.toString()}`);
            const json = await res.json();
            if (json.success) setInvoices(json.data);
            else showError("Erreur", json.error);
        } catch {
            showError("Erreur", "Impossible de charger les factures");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchInvoices(); }, [statusFilter]);

    const handleSyncPayments = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch("/api/billing/payments/sync", { method: "POST" });
            const json = await res.json();
            if (json.success) { success("Synchronisation", json.message); fetchInvoices(); }
            else showError("Erreur", json.error);
        } catch {
            showError("Erreur", "Impossible de synchroniser les paiements");
        } finally {
            setIsSyncing(false);
        }
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

    const total = invoices.reduce((sum, inv) => sum + Number(inv.totalTtc), 0);
    const counts = {
        draft: invoices.filter((i) => i.status === "DRAFT").length,
        pending: invoices.filter((i) => ["VALIDATED", "SENT"].includes(i.status)).length,
        paid: invoices.filter((i) => i.status === "PAID").length,
    };

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Factures & Avoirs</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {invoices.length} document(s) - Conforme Factur-X EN16931
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={handleSyncPayments} disabled={isSyncing}>
                        {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Sync Qonto
                    </Button>
                    <Link href="/manager/billing/invoices/new">
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvelle facture
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Brouillons</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">{counts.draft}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <p className="text-xs font-medium text-amber-500 uppercase tracking-wider">En attente</p>
                    <p className="text-xl font-bold text-amber-900 mt-1">{counts.pending}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <p className="text-xs font-medium text-emerald-500 uppercase tracking-wider">Payées</p>
                    <p className="text-xl font-bold text-emerald-900 mt-1">{counts.paid}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Rechercher par numéro ou client..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchInvoices()}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200"
                    />
                </div>
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                    {[
                        { value: "all", label: "Tous" },
                        { value: "DRAFT", label: "Brouillon" },
                        { value: "VALIDATED", label: "Validée" },
                        { value: "SENT", label: "Envoyée" },
                        { value: "PAID", label: "Payée" },
                        { value: "CANCELLED", label: "Annulée" },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setStatusFilter(opt.value)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
                                statusFilter === opt.value
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-3" />
                        <p className="text-sm text-slate-500">Chargement...</p>
                    </div>
                </div>
            ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <Receipt className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Aucune facture</h3>
                    <p className="text-sm text-slate-500 mb-6">Créez votre première facture pour commencer</p>
                    <Link href="/manager/billing/invoices/new">
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Créer une facture
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
                    {invoices.map((invoice) => {
                        const isCredit = invoice.documentType === "CREDIT_NOTE";
                        const sc = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.DRAFT;
                        const isOverdue = new Date(invoice.dueDate) < new Date() && !["PAID", "CANCELLED"].includes(invoice.status);

                        return (
                            <button
                                key={invoice.id}
                                onClick={() => router.push(`/manager/billing/invoices/${invoice.id}`)}
                                className={`w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-indigo-50/30 transition-all duration-150 group ${
                                    invoice.status === "CANCELLED" ? "opacity-50" : ""
                                }`}
                            >
                                {/* Icon */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    isCredit ? "bg-red-50" : sc.bg
                                }`}>
                                    {isCredit ? (
                                        <FileX2 className="w-5 h-5 text-red-500" />
                                    ) : (
                                        <FileText className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                                            {invoice.invoiceNumber || "Brouillon"}
                                        </span>
                                        {isCredit && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 uppercase">Avoir</span>
                                        )}
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.color}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                            {sc.label}
                                        </span>
                                        {invoice._count.payments > 0 && !["PAID", "CANCELLED"].includes(invoice.status) && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-600">
                                                <Banknote className="w-3 h-3" />
                                                Paiement
                                            </span>
                                        )}
                                        {invoice._count.creditNotes > 0 && (
                                            <span className="text-[11px] text-slate-500">{invoice._count.creditNotes} avoir(s)</span>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-500 truncate">
                                        {invoice.billingClient.legalName}
                                        <span className="mx-1.5 text-slate-300">|</span>
                                        {format(new Date(invoice.issueDate), "dd MMM yyyy", { locale: fr })}
                                        <span className="mx-1.5 text-slate-300">|</span>
                                        {invoice._count.items} article(s)
                                    </div>
                                </div>

                                {/* Amount + Due */}
                                <div className="text-right flex-shrink-0 ml-4">
                                    <div className={`text-lg font-bold tabular-nums ${isCredit ? "text-red-600" : "text-slate-900"}`}>
                                        {isCredit ? "-" : ""}{formatCurrency(Number(invoice.totalTtc))}
                                    </div>
                                    <div className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-slate-400"}`}>
                                        {isOverdue ? "En retard - " : "Éch. "}
                                        {format(new Date(invoice.dueDate), "dd/MM/yy")}
                                    </div>
                                </div>

                                {/* Chevron */}
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
