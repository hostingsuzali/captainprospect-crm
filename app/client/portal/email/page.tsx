"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
    Button,
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

    const PROVIDER_GRADIENTS: Record<string, string> = {
        GMAIL: "from-red-500 to-orange-500",
        OUTLOOK: "from-blue-500 to-cyan-500",
        CUSTOM: "from-slate-500 to-slate-600",
    };

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-6">
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4" style={{ animation: "dashFadeUp 0.4s ease both" }}>
                <div>
                    <h1 className="text-2xl md:text-[28px] font-bold text-[#12122A] tracking-tight leading-tight">
                        Mon <span className="gradient-text">Email</span>
                    </h1>
                    <p className="text-sm text-[#6B7194] mt-1.5 max-w-xl">
                        Connectez votre boîte et consultez les emails envoyés en votre nom par l&apos;équipe
                    </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7C5CFC] to-[#A78BFA] flex items-center justify-center shadow-lg shadow-[#7C5CFC]/25 shrink-0">
                    <Mail className="w-6 h-6 text-white" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Connection card */}
                <div className="premium-card lg:col-span-1 overflow-hidden" style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "60ms" }}>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C5CFC] to-[#A78BFA] flex items-center justify-center shadow-sm shadow-[#7C5CFC]/20">
                            <Mail className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="text-sm font-semibold text-[#12122A] uppercase tracking-wider">
                            Boîte connectée
                        </h2>
                    </div>
                    <p className="text-xs text-[#6B7194] mb-5">
                        Votre adresse utilisée pour la prospection
                    </p>

                    {isLoadingMailbox ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-8 h-8 text-[#7C5CFC] animate-spin" />
                            <p className="text-xs text-[#6B7194]">Chargement…</p>
                        </div>
                    ) : mailbox ? (
                        <div className="space-y-4">
                            <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-[#F8F7FF] to-[#F0EEFF] border border-[#E8E5FF] group">
                                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-[#7C5CFC]/5 -translate-y-1/2 translate-x-1/2" />
                                <div className="flex items-center gap-3 relative">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-md",
                                        "bg-gradient-to-br",
                                        PROVIDER_GRADIENTS[mailbox.provider] ?? "from-indigo-500 to-violet-500"
                                    )}>
                                        {mailbox.email[0]?.toUpperCase() ?? "G"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-[#12122A] truncate">
                                            {mailbox.email}
                                        </p>
                                        <span
                                            className={cn(
                                                "inline-block text-[11px] font-medium px-2 py-[2px] rounded-md mt-1.5 border",
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
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0 drop-shadow-sm" />
                                </div>
                                <p className="text-[11px] text-[#6B7194] mt-3 pt-3 border-t border-[#E8E5FF]/50">
                                    Connectée le{" "}
                                    {new Date(mailbox.connectedAt).toLocaleDateString("fr-FR", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSync}
                                    disabled={isSyncing}
                                    className="gap-2 border-[#E8EBF0] hover:border-[#7C5CFC]/30 hover:bg-[#7C5CFC]/5 hover:text-[#7C5CFC] transition-all"
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
                                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Supprimer
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="text-center py-2">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F4F6F9] to-[#E8EBF0] flex items-center justify-center mx-auto mb-3">
                                    <Mail className="w-6 h-6 text-[#A0A3BD]" />
                                </div>
                                <p className="text-sm font-semibold text-[#12122A]">Aucune boîte connectée</p>
                                <p className="text-xs text-[#6B7194] mt-1 max-w-[240px] mx-auto">
                                    Connectez Gmail, Outlook ou IMAP/SMTP pour que l&apos;équipe envoie les emails en votre nom
                                </p>
                            </div>
                            {showImapForm ? (
                                <form onSubmit={handleImapSubmit} className="space-y-4">
                                    {imapError && (
                                        <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs text-red-700">{imapError}</p>
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-[#6B7194]">Adresse email</label>
                                        <input
                                            type="email"
                                            required
                                            value={imapForm.email}
                                            onChange={(e) => handleEmailChange(e.target.value)}
                                            placeholder="vous@exemple.com"
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8EBF0] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/20 focus:border-[#7C5CFC] transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-[#6B7194]">Nom d&apos;affichage</label>
                                        <input
                                            type="text"
                                            value={imapForm.displayName}
                                            onChange={(e) => setImapForm((p) => ({ ...p, displayName: e.target.value }))}
                                            placeholder="Jean Dupont"
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8EBF0] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/20 focus:border-[#7C5CFC] transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-[#6B7194]">Mot de passe / App Password</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                value={imapForm.password}
                                                onChange={(e) => setImapForm((p) => ({ ...p, password: e.target.value }))}
                                                placeholder="••••••••"
                                                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E8EBF0] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/20 focus:border-[#7C5CFC] transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A3BD] hover:text-[#6B7194] transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-[#A0A3BD]">Pour Gmail, utilisez un mot de passe d&apos;application</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium text-[#6B7194]">IMAP</label>
                                            <input
                                                type="text"
                                                required
                                                value={imapForm.imapHost}
                                                onChange={(e) => setImapForm((p) => ({ ...p, imapHost: e.target.value }))}
                                                placeholder="imap.gmail.com"
                                                className="w-full px-3 py-2 rounded-lg border border-[#E8EBF0] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/20 focus:border-[#7C5CFC]"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-medium text-[#6B7194]">Port IMAP</label>
                                            <input
                                                type="text"
                                                required
                                                value={imapForm.imapPort}
                                                onChange={(e) => setImapForm((p) => ({ ...p, imapPort: e.target.value }))}
                                                placeholder="993"
                                                className="w-full px-3 py-2 rounded-lg border border-[#E8EBF0] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/20 focus:border-[#7C5CFC]"
                                            />
                                        </div>
                                        <div className="space-y-1.5 col-span-2">
                                            <label className="text-[11px] font-medium text-[#6B7194]">SMTP</label>
                                            <div className="grid grid-cols-[1fr_80px] gap-2">
                                                <input
                                                    type="text"
                                                    required
                                                    value={imapForm.smtpHost}
                                                    onChange={(e) => setImapForm((p) => ({ ...p, smtpHost: e.target.value }))}
                                                    placeholder="smtp.gmail.com"
                                                    className="px-3 py-2 rounded-lg border border-[#E8EBF0] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/20 focus:border-[#7C5CFC]"
                                                />
                                                <input
                                                    type="text"
                                                    required
                                                    value={imapForm.smtpPort}
                                                    onChange={(e) => setImapForm((p) => ({ ...p, smtpPort: e.target.value }))}
                                                    placeholder="587"
                                                    className="px-3 py-2 rounded-lg border border-[#E8EBF0] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/20 focus:border-[#7C5CFC]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => { setShowImapForm(false); setImapError(null); }}
                                            className="flex-1 border border-[#E8EBF0] hover:bg-slate-50"
                                        >
                                            Annuler
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={imapLoading}
                                            className="flex-1 gap-2 bg-gradient-to-r from-[#7C5CFC] to-[#A78BFA] text-white hover:opacity-95 shadow-md shadow-[#7C5CFC]/25"
                                        >
                                            {imapLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                            Connecter
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={handleConnectGmail}
                                        className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-[#E8EBF0] bg-white hover:border-red-200 hover:bg-red-50/50 transition-all duration-200 group"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
                                            </svg>
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <p className="font-semibold text-[#12122A]">Gmail</p>
                                            <p className="text-[11px] text-[#6B7194]">Connexion sécurisée via Google</p>
                                        </div>
                                        <span className="text-[#A0A3BD] group-hover:text-red-500 text-sm font-medium">→</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConnectOutlook}
                                        className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-[#E8EBF0] bg-white hover:border-blue-200 hover:bg-blue-50/50 transition-all duration-200 group"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                                            <img src="/icons/outlook.svg" alt="" className="w-5 h-5 text-white brightness-0 invert" aria-hidden />
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <p className="font-semibold text-[#12122A]">Outlook / Microsoft 365</p>
                                            <p className="text-[11px] text-[#6B7194]">Connexion sécurisée via Microsoft</p>
                                        </div>
                                        <span className="text-[#A0A3BD] group-hover:text-blue-500 text-sm font-medium">→</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowImapForm(true)}
                                        className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-[#E8EBF0] bg-slate-50/50 hover:border-[#7C5CFC]/40 hover:bg-[#7C5CFC]/5 transition-all duration-200 group"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center group-hover:bg-[#7C5CFC]/20 transition-colors">
                                            <Server className="w-5 h-5 text-slate-500 group-hover:text-[#7C5CFC]" />
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <p className="font-semibold text-[#12122A]">IMAP / SMTP</p>
                                            <p className="text-[11px] text-[#6B7194]">Configuration manuelle</p>
                                        </div>
                                        <span className="text-[#A0A3BD] group-hover:text-[#7C5CFC] text-sm font-medium">→</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sent emails table */}
                <div className="premium-card lg:col-span-2 overflow-hidden" style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "100ms" }}>
                    <div className="flex items-center gap-2.5 px-6 pt-5 pb-4 border-b border-[#E8EBF0]">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C5CFC] to-[#A78BFA] flex items-center justify-center shadow-sm shadow-[#7C5CFC]/20">
                            <Send className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-[#12122A] uppercase tracking-wider">
                                Emails envoyés en mon nom
                            </h2>
                            <p className="text-[11px] text-[#6B7194] mt-0.5">
                                Emails envoyés par l&apos;équipe depuis votre boîte
                            </p>
                        </div>
                    </div>

                    <div className="p-6">
                        {!mailbox ? (
                            <div className="text-center py-14">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F4F6F9] to-[#E8EBF0] flex items-center justify-center mx-auto mb-4">
                                    <Send className="w-7 h-7 text-[#A0A3BD]" />
                                </div>
                                <p className="text-sm font-semibold text-[#12122A]">Connectez votre boîte</p>
                                <p className="text-xs text-[#6B7194] mt-1 max-w-[280px] mx-auto">
                                    Connectez d&apos;abord votre boîte email pour voir les emails envoyés en votre nom
                                </p>
                            </div>
                        ) : isLoadingSent ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <Loader2 className="w-8 h-8 text-[#7C5CFC] animate-spin" />
                                <p className="text-xs text-[#6B7194]">Chargement des emails…</p>
                            </div>
                        ) : sentEmails.length === 0 ? (
                            <div className="text-center py-14">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F4F6F9] to-[#E8EBF0] flex items-center justify-center mx-auto mb-4">
                                    <Send className="w-7 h-7 text-[#A0A3BD]" />
                                </div>
                                <p className="text-sm font-semibold text-[#12122A]">Aucun email envoyé</p>
                                <p className="text-xs text-[#6B7194] mt-1 max-w-[280px] mx-auto">
                                    Les emails envoyés par l&apos;équipe apparaîtront ici
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto -mx-2 sm:mx-0 rounded-xl border border-[#E8EBF0] overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-[#F8F9FC] to-[#F4F6F9]">
                                            <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-[#6B7194] uppercase tracking-wider">
                                                Destinataire
                                            </th>
                                            <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-[#6B7194] uppercase tracking-wider">
                                                Objet
                                            </th>
                                            <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-[#6B7194] uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-[#6B7194] uppercase tracking-wider">
                                                Statut
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sentEmails.map((e, idx) => (
                                            <tr
                                                key={e.id}
                                                className={cn(
                                                    "border-b border-[#F0F1F5] last:border-0 transition-colors duration-150",
                                                    idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]/50",
                                                    "hover:bg-[#7C5CFC]/5"
                                                )}
                                            >
                                                <td className="py-3.5 px-4 text-sm font-medium text-[#12122A] truncate max-w-[180px]">
                                                    {e.recipient}
                                                </td>
                                                <td className="py-3.5 px-4 text-sm text-[#6B7194] truncate max-w-[240px]">
                                                    {e.subject || "—"}
                                                </td>
                                                <td className="py-3.5 px-4 text-xs text-[#8B8DAF] whitespace-nowrap font-medium">
                                                    {formatDate(e.date)}
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border",
                                                            STATUS_BADGES[e.status] ??
                                                                "bg-slate-100 text-slate-700 border-slate-200"
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
                    </div>
                </div>
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

            <style jsx global>{`
                @keyframes dashFadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: none; }
                }
            `}</style>
        </div>
    );
}
