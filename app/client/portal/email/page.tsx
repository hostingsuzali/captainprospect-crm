"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
    PageHeader,
    Card,
    Button,
    EmptyState,
    useToast,
    ConfirmModal,
} from "@/components/ui";
import {
    Mail,
    Loader2,
    CheckCircle2,
    Send,
    Server,
    Eye,
    EyeOff,
    AlertCircle,
    RefreshCw,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MailboxInfo {
    id: string;
    email: string;
    displayName: string | null;
    provider: string;
    syncStatus: string;
    connectedAt: string;
}

interface SentEmail {
    id: string;
    recipient: string;
    subject: string;
    date: string | null;
    status: string;
}

function formatDate(dateString: string | null) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
    });
}

const PROVIDER_COLORS: Record<string, string> = {
    GMAIL: "bg-red-100 text-red-700 border-red-200",
    OUTLOOK: "bg-blue-100 text-blue-700 border-blue-200",
    CUSTOM: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function ClientPortalEmailPage() {
    const toast = useToast();
    const searchParams = useSearchParams();

    const [mailbox, setMailbox] = useState<MailboxInfo | null | undefined>(
        undefined
    );
    const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
    const [isLoadingMailbox, setIsLoadingMailbox] = useState(true);
    const [isLoadingSent, setIsLoadingSent] = useState(true);
    const [showImapForm, setShowImapForm] = useState(false);
    const [imapForm, setImapForm] = useState({
        email: "",
        displayName: "",
        password: "",
        imapHost: "",
        imapPort: "993",
        smtpHost: "",
        smtpPort: "587",
    });
    const [imapLoading, setImapLoading] = useState(false);
    const [imapError, setImapError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchMailbox = useCallback(async () => {
        setIsLoadingMailbox(true);
        try {
            const res = await fetch("/api/client/mailbox");
            const json = await res.json();
            if (json.success) {
                setMailbox(json.data ?? null);
            } else {
                setMailbox(null);
            }
        } catch {
            setMailbox(null);
        } finally {
            setIsLoadingMailbox(false);
        }
    }, []);

    const fetchSentEmails = useCallback(async () => {
        if (!mailbox) {
            setIsLoadingSent(false);
            setSentEmails([]);
            return;
        }
        setIsLoadingSent(true);
        try {
            const res = await fetch("/api/client/sent-emails?limit=50");
            const json = await res.json();
            if (json.success && json.data?.emails) {
                setSentEmails(json.data.emails);
            } else {
                setSentEmails([]);
            }
        } catch {
            setSentEmails([]);
        } finally {
            setIsLoadingSent(false);
        }
    }, [mailbox]);

    useEffect(() => {
        fetchMailbox();
    }, [fetchMailbox]);

    useEffect(() => {
        fetchSentEmails();
    }, [fetchSentEmails]);

    // Handle OAuth return
    useEffect(() => {
        const success = searchParams.get("success");
        const error = searchParams.get("error");
        if (success === "connected" || success === "reconnected") {
            toast.success("Boîte connectée", "Votre boîte email est maintenant connectée.");
            fetchMailbox();
            window.history.replaceState({}, "", "/client/portal/email");
        } else if (error) {
            const messages: Record<string, string> = {
                access_denied: "Connexion annulée",
                state_expired: "Session expirée, veuillez réessayer",
                invalid_state: "Erreur de vérification",
                no_email: "Impossible de récupérer l'adresse email",
                callback_failed: "Erreur lors de la connexion",
            };
            toast.error("Erreur", messages[error] || error);
            window.history.replaceState({}, "", "/client/portal/email");
        }
    }, [searchParams, toast, fetchMailbox]);

    const handleConnectGmail = () => {
        window.location.href =
            "/api/email/oauth/gmail/connect?returnUrl=/client/portal/email";
    };

    const handleConnectOutlook = () => {
        window.location.href =
            "/api/email/oauth/outlook/connect?returnUrl=/client/portal/email";
    };

    const handleImapSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setImapLoading(true);
        setImapError(null);
        try {
            const res = await fetch("/api/email/mailboxes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "CUSTOM",
                    email: imapForm.email.trim(),
                    displayName: imapForm.displayName.trim() || imapForm.email.split("@")[0],
                    password: imapForm.password,
                    imapHost: imapForm.imapHost.trim(),
                    imapPort: parseInt(imapForm.imapPort, 10) || 993,
                    smtpHost: imapForm.smtpHost.trim(),
                    smtpPort: parseInt(imapForm.smtpPort, 10) || 587,
                }),
            });
            const json = await res.json();
            if (!json.success) {
                throw new Error(json.error || "Erreur lors de la connexion");
            }
            toast.success("Boîte connectée", "Votre boîte IMAP/SMTP est maintenant connectée.");
            setShowImapForm(false);
            setImapForm({
                email: "",
                displayName: "",
                password: "",
                imapHost: "",
                imapPort: "993",
                smtpHost: "",
                smtpPort: "587",
            });
            fetchMailbox();
        } catch (err) {
            setImapError(err instanceof Error ? err.message : "Erreur lors de la connexion");
        } finally {
            setImapLoading(false);
        }
    };

    const handleSync = useCallback(async () => {
        if (!mailbox) return;
        setIsSyncing(true);
        try {
            const res = await fetch(`/api/email/mailboxes/${mailbox.id}/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ maxThreads: 100 }),
            });
            const json = await res.json();
            if (json.success) {
                toast.success("Synchronisation", "La boîte a été synchronisée.");
                fetchMailbox();
                fetchSentEmails();
            } else {
                toast.error("Erreur", json.error || "Échec de la synchronisation");
            }
        } catch {
            toast.error("Erreur", "Impossible de lancer la synchronisation");
        } finally {
            setIsSyncing(false);
        }
    }, [mailbox, toast, fetchMailbox, fetchSentEmails]);

    const handleDeleteMailbox = useCallback(async () => {
        if (!mailbox) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/email/mailboxes/${mailbox.id}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (json.success) {
                toast.success("Boîte supprimée", "Votre boîte connectée a été supprimée.");
                setMailbox(null);
                setSentEmails([]);
                setShowDeleteConfirm(false);
            } else {
                toast.error("Erreur", json.error || "Impossible de supprimer la boîte");
            }
        } catch {
            toast.error("Erreur", "Impossible de supprimer la boîte");
        } finally {
            setIsDeleting(false);
        }
    }, [mailbox, toast]);

    const handleEmailChange = (email: string) => {
        const domain = email.split("@")[1]?.toLowerCase();
        const serverMap: Record<string, { imap: string; smtp: string }> = {
            "gmail.com": { imap: "imap.gmail.com", smtp: "smtp.gmail.com" },
            "yahoo.com": { imap: "imap.mail.yahoo.com", smtp: "smtp.mail.yahoo.com" },
            "yahoo.fr": { imap: "imap.mail.yahoo.com", smtp: "smtp.mail.yahoo.com" },
            "outlook.com": { imap: "outlook.office365.com", smtp: "smtp.office365.com" },
            "hotmail.com": { imap: "outlook.office365.com", smtp: "smtp.office365.com" },
            "icloud.com": { imap: "imap.mail.me.com", smtp: "smtp.mail.me.com" },
            "orange.fr": { imap: "imap.orange.fr", smtp: "smtp.orange.fr" },
            "free.fr": { imap: "imap.free.fr", smtp: "smtp.free.fr" },
            "sfr.fr": { imap: "imap.sfr.fr", smtp: "smtp.sfr.fr" },
            "laposte.net": { imap: "imap.laposte.net", smtp: "smtp.laposte.net" },
        };
        const match = domain ? serverMap[domain] : null;
        setImapForm((prev) => ({
            ...prev,
            email,
            ...(match && !prev.imapHost ? { imapHost: match.imap, smtpHost: match.smtp } : {}),
        }));
    };

    const STATUS_BADGES: Record<string, string> = {
        Envoyé: "bg-slate-100 text-slate-700 border-slate-200",
        Ouvert: "bg-blue-50 text-blue-700 border-blue-200",
        Répondu: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };

    return (
        <div className="flex flex-col min-h-full space-y-6">
            <PageHeader
                title="Mon Email"
                subtitle="Connectez votre boîte et consultez les emails envoyés en votre nom"
                icon={
                    <span className="flex items-center gap-2 text-indigo-600">
                        <Mail className="w-5 h-5" />
                    </span>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Connection card */}
                <Card className="lg:col-span-1 border-slate-200">
                    <h2 className="text-sm font-semibold text-slate-700 mb-3">
                        Boîte connectée
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">
                        Votre adresse utilisée pour la prospection
                    </p>

                    {isLoadingMailbox ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                        </div>
                    ) : mailbox ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600">
                                    {mailbox.email[0]?.toUpperCase() ?? "G"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 truncate">
                                        {mailbox.email}
                                    </p>
                                    <span
                                        className={cn(
                                            "inline-block text-xs font-medium px-2 py-0.5 rounded border mt-1",
                                            PROVIDER_COLORS[mailbox.provider] ??
                                                "bg-slate-100 text-slate-700 border-slate-200"
                                        )}
                                    >
                                        {mailbox.provider === "GMAIL"
                                            ? "Gmail"
                                            : mailbox.provider === "OUTLOOK"
                                              ? "Outlook"
                                              : mailbox.provider === "CUSTOM"
                                                ? "IMAP/SMTP"
                                                : mailbox.provider}
                                    </span>
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            </div>
                            <p className="text-xs text-slate-500">
                                Connectée le{" "}
                                {new Date(mailbox.connectedAt).toLocaleDateString(
                                    "fr-FR",
                                    {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    }
                                )}
                            </p>
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSync}
                                    disabled={isSyncing}
                                    className="gap-2"
                                >
                                    {isSyncing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4" />
                                    )}
                                    {isSyncing ? "Synchronisation…" : "Synchroniser"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={isSyncing}
                                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Supprimer la boîte
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <EmptyState
                                icon={Mail}
                                title="Aucune boîte connectée"
                                description="Connectez votre boîte Gmail, Outlook ou IMAP/SMTP pour permettre à l'équipe d'envoyer des emails en votre nom."
                                variant="inline"
                            />
                            {showImapForm ? (
                                <form onSubmit={handleImapSubmit} className="space-y-3">
                                    {imapError && (
                                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs text-red-700">{imapError}</p>
                                        </div>
                                    )}
                                    <input
                                        type="email"
                                        required
                                        value={imapForm.email}
                                        onChange={(e) => handleEmailChange(e.target.value)}
                                        placeholder="Adresse email"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                    <input
                                        type="text"
                                        value={imapForm.displayName}
                                        onChange={(e) => setImapForm((p) => ({ ...p, displayName: e.target.value }))}
                                        placeholder="Nom d'affichage"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={imapForm.password}
                                            onChange={(e) => setImapForm((p) => ({ ...p, password: e.target.value }))}
                                            placeholder="Mot de passe / App Password"
                                            className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            required
                                            value={imapForm.imapHost}
                                            onChange={(e) => setImapForm((p) => ({ ...p, imapHost: e.target.value }))}
                                            placeholder="Serveur IMAP"
                                            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                        <input
                                            type="text"
                                            required
                                            value={imapForm.imapPort}
                                            onChange={(e) => setImapForm((p) => ({ ...p, imapPort: e.target.value }))}
                                            placeholder="Port IMAP"
                                            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                        <input
                                            type="text"
                                            required
                                            value={imapForm.smtpHost}
                                            onChange={(e) => setImapForm((p) => ({ ...p, smtpHost: e.target.value }))}
                                            placeholder="Serveur SMTP"
                                            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                        <input
                                            type="text"
                                            required
                                            value={imapForm.smtpPort}
                                            onChange={(e) => setImapForm((p) => ({ ...p, smtpPort: e.target.value }))}
                                            placeholder="Port SMTP"
                                            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        Pour Gmail, utilisez un mot de passe d&apos;application
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => {
                                                setShowImapForm(false);
                                                setImapError(null);
                                            }}
                                            className="flex-1"
                                        >
                                            Annuler
                                        </Button>
                                        <Button type="submit" disabled={imapLoading} className="flex-1 gap-2">
                                            {imapLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                            Connecter
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <Button
                                        onClick={handleConnectGmail}
                                        className="w-full justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
                                            />
                                        </svg>
                                        Connecter Gmail
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleConnectOutlook}
                                        className="w-full justify-center gap-2"
                                    >
                                        <img src="/icons/outlook.svg" alt="" className="w-4 h-4" aria-hidden />
                                        Connecter Outlook
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowImapForm(true)}
                                        className="w-full justify-center gap-2"
                                    >
                                        <Server className="w-4 h-4" />
                                        IMAP / SMTP
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                {/* Sent emails table */}
                <Card className="lg:col-span-2 border-slate-200">
                    <h2 className="text-sm font-semibold text-slate-700 mb-1">
                        Emails envoyés en mon nom
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">
                        Emails envoyés par l'équipe depuis votre boîte
                    </p>

                    {!mailbox ? (
                        <EmptyState
                            icon={Send}
                            title="Connectez votre boîte"
                            description="Connectez d'abord votre boîte email pour voir les emails envoyés en votre nom."
                            variant="inline"
                        />
                    ) : isLoadingSent ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                        </div>
                    ) : sentEmails.length === 0 ? (
                        <EmptyState
                            icon={Send}
                            title="Aucun email envoyé"
                            description="Les emails envoyés par l'équipe apparaîtront ici."
                            variant="inline"
                        />
                    ) : (
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Destinataire
                                        </th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Objet
                                        </th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Statut
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sentEmails.map((e) => (
                                        <tr
                                            key={e.id}
                                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                                        >
                                            <td className="py-3 px-4 text-sm text-slate-900 truncate max-w-[180px]">
                                                {e.recipient}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-700 truncate max-w-[220px]">
                                                {e.subject || "—"}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-500 whitespace-nowrap">
                                                {formatDate(e.date)}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span
                                                    className={cn(
                                                        "inline-block text-xs font-medium px-2 py-1 rounded border",
                                                        STATUS_BADGES[e.status] ??
                                                            "bg-slate-100 text-slate-700"
                                                    )}
                                                >
                                                    {e.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => !isDeleting && setShowDeleteConfirm(false)}
                onConfirm={handleDeleteMailbox}
                title="Supprimer la boîte connectée"
                message="Votre boîte email sera déconnectée. Vous pourrez en connecter une autre à tout moment. Continuer ?"
                confirmText="Supprimer"
                cancelText="Annuler"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
