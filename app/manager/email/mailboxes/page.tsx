"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
    Mail,
    Plus,
    Settings,
    Trash2,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Loader2,
    ExternalLink,
    Shield,
    Activity,
    Server,
    ArrowRight,
    X,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// ============================================
// TYPES
// ============================================

interface Mailbox {
    id: string;
    provider: "GMAIL" | "OUTLOOK" | "CUSTOM";
    email: string;
    displayName: string | null;
    type: string;
    syncStatus: string;
    warmupStatus: string;
    healthScore: number;
    dailySendLimit: number;
    sentToday: number;
    lastSyncAt: string | null;
    lastError: string | null;
    isActive: boolean;
    createdAt: string;
    _count: {
        threads: number;
        emails: number;
    };
}

// ============================================
// ADD MAILBOX MODAL
// ============================================

interface AddMailboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

function AddMailboxModal({ isOpen, onClose, onSuccess }: AddMailboxModalProps) {
    const [step, setStep] = useState<'select' | 'imap'>('select');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imapForm, setImapForm] = useState({
        email: '',
        password: '',
        displayName: '',
        imapHost: '',
        imapPort: '993',
        smtpHost: '',
        smtpPort: '587',
    });

    const providers = [
        {
            id: 'gmail',
            name: 'Gmail',
            description: 'Connexion sécurisée via Google OAuth',
            color: 'from-red-500 to-orange-500',
            bgColor: 'bg-red-50 hover:bg-red-100',
            borderColor: 'border-red-200',
        },
        {
            id: 'outlook',
            name: 'Outlook / Microsoft 365',
            description: 'Connexion sécurisée via Microsoft OAuth',
            color: 'from-blue-500 to-cyan-500',
            bgColor: 'bg-blue-50 hover:bg-blue-100',
            borderColor: 'border-blue-200',
        },
        {
            id: 'imap',
            name: 'IMAP / SMTP',
            description: 'Configuration manuelle pour tout fournisseur',
            color: 'from-slate-500 to-slate-600',
            bgColor: 'bg-slate-50 hover:bg-slate-100',
            borderColor: 'border-slate-200',
        },
    ];

    const handleProviderSelect = (providerId: string) => {
        if (providerId === 'gmail') {
            window.location.href = '/api/email/oauth/gmail/connect';
        } else if (providerId === 'outlook') {
            window.location.href = '/api/email/oauth/outlook/connect';
        } else if (providerId === 'imap') {
            setStep('imap');
        }
    };

    const handleImapSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/email/mailboxes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: 'CUSTOM',
                    email: imapForm.email,
                    displayName: imapForm.displayName || imapForm.email.split('@')[0],
                    password: imapForm.password,
                    imapHost: imapForm.imapHost,
                    imapPort: parseInt(imapForm.imapPort),
                    smtpHost: imapForm.smtpHost,
                    smtpPort: parseInt(imapForm.smtpPort),
                }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Erreur lors de la connexion');
            }

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de la connexion');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg">
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            {step === 'imap' && (
                                <button
                                    onClick={() => setStep('select')}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <ArrowRight className="w-4 h-4 rotate-180 text-slate-500" />
                                </button>
                            )}
                            <h2 className="text-lg font-semibold text-slate-900">
                                {step === 'select' ? 'Ajouter une boîte mail' : 'Configuration IMAP/SMTP'}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        {step === 'select' ? (
                            <div className="space-y-3">
                                {providers.map((provider) => (
                                    <button
                                        key={provider.id}
                                        onClick={() => handleProviderSelect(provider.id)}
                                        className={cn(
                                            "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                                            provider.bgColor,
                                            provider.borderColor,
                                            "hover:shadow-md"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg",
                                            provider.color
                                        )}>
                                            {provider.id === 'imap' ? (
                                                <Server className="w-6 h-6 text-white" />
                                            ) : (
                                                <Mail className="w-6 h-6 text-white" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-900">{provider.name}</h3>
                                            <p className="text-sm text-slate-500">{provider.description}</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-slate-400" />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <form onSubmit={handleImapSubmit} className="space-y-4">
                                {error && (
                                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-700">{error}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Adresse email *
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={imapForm.email}
                                            onChange={(e) => setImapForm({ ...imapForm, email: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                                            placeholder="vous@example.com"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Nom d'affichage
                                        </label>
                                        <input
                                            type="text"
                                            value={imapForm.displayName}
                                            onChange={(e) => setImapForm({ ...imapForm, displayName: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                                            placeholder="John Doe"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Mot de passe / App Password *
                                        </label>
                                        <input
                                            type="password"
                                            required
                                            value={imapForm.password}
                                            onChange={(e) => setImapForm({ ...imapForm, password: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                                            placeholder="••••••••"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Serveur IMAP *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={imapForm.imapHost}
                                            onChange={(e) => setImapForm({ ...imapForm, imapHost: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                                            placeholder="imap.example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Port IMAP *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={imapForm.imapPort}
                                            onChange={(e) => setImapForm({ ...imapForm, imapPort: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                                            placeholder="993"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Serveur SMTP *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={imapForm.smtpHost}
                                            onChange={(e) => setImapForm({ ...imapForm, smtpHost: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                                            placeholder="smtp.example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Port SMTP *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={imapForm.smtpPort}
                                            onChange={(e) => setImapForm({ ...imapForm, smtpPort: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                                            placeholder="587"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        disabled={isLoading}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors disabled:opacity-50"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-medium text-sm hover:from-indigo-400 hover:to-indigo-500 transition-all disabled:opacity-50"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Connexion...
                                            </>
                                        ) : (
                                            'Connecter'
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

// ============================================
// MAILBOXES PAGE
// ============================================

export default function MailboxesPage() {
    const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [syncingMailboxes, setSyncingMailboxes] = useState<Set<string>>(new Set());
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Fetch mailboxes
    useEffect(() => {
        const fetchMailboxes = async () => {
            try {
                const res = await fetch("/api/email/mailboxes?includeShared=true");
                const json = await res.json();
                if (json.success) {
                    setMailboxes(json.data);
                }
            } catch (error) {
                console.error("Failed to fetch mailboxes:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMailboxes();
    }, []);

    // Sync mailbox
    const handleSync = async (mailboxId: string) => {
        setSyncingMailboxes(prev => new Set([...prev, mailboxId]));
        try {
            const res = await fetch(`/api/email/mailboxes/${mailboxId}/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ maxThreads: 100 }),
            });
            const json = await res.json();

            if (json.success) {
                // Refresh mailboxes list
                const refreshRes = await fetch("/api/email/mailboxes?includeShared=true");
                const refreshJson = await refreshRes.json();
                if (refreshJson.success) {
                    setMailboxes(refreshJson.data);
                }
            }
        } catch (error) {
            console.error("Sync failed:", error);
        } finally {
            setSyncingMailboxes(prev => {
                const next = new Set(prev);
                next.delete(mailboxId);
                return next;
            });
        }
    };

    // Delete mailbox
    const handleDelete = async (mailboxId: string) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer cette boîte mail ?")) return;

        try {
            await fetch(`/api/email/mailboxes/${mailboxId}`, { method: "DELETE" });
            setMailboxes(prev => prev.filter(m => m.id !== mailboxId));
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };

    const getProviderIcon = (provider: string) => {
        switch (provider) {
            case "GMAIL":
                return "/icons/gmail.svg";
            case "OUTLOOK":
                return "/icons/outlook.svg";
            default:
                return null;
        }
    };

    const getProviderColor = (provider: string) => {
        switch (provider) {
            case "GMAIL":
                return "#EA4335";
            case "OUTLOOK":
                return "#0078D4";
            default:
                return "#6366F1";
        }
    };

    const getSyncStatusBadge = (status: string) => {
        switch (status) {
            case "SYNCED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle className="w-3 h-3" />
                        Synchronisé
                    </span>
                );
            case "SYNCING":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        En cours
                    </span>
                );
            case "ERROR":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                        <AlertCircle className="w-3 h-3" />
                        Erreur
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                        En attente
                    </span>
                );
        }
    };

    const handleAddSuccess = () => {
        // Refresh mailboxes list
        const fetchMailboxes = async () => {
            try {
                const res = await fetch("/api/email/mailboxes?includeShared=true");
                const json = await res.json();
                if (json.success) {
                    setMailboxes(json.data);
                }
            } catch (error) {
                console.error("Failed to fetch mailboxes:", error);
            }
        };
        fetchMailboxes();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Boîtes mail</h1>
                    <p className="text-sm text-slate-500">Gérez vos connexions email</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-indigo-400 hover:to-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Ajouter une boîte mail
                </button>
            </div>

            {/* Add Mailbox Modal */}
            <AddMailboxModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={handleAddSuccess}
            />

            {/* Mailboxes Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
            ) : mailboxes.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                            <Mail className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                            Aucune boîte mail connectée
                        </h3>
                        <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                            Connectez votre première boîte mail pour commencer à gérer vos emails depuis Suzalink.
                        </p>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-indigo-400 hover:to-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Connecter une boîte mail
                        </button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mailboxes.map((mailbox) => (
                        <Card key={mailbox.id} className="overflow-hidden">
                            <CardContent className="p-0">
                                {/* Header with provider color */}
                                <div
                                    className="h-2"
                                    style={{ backgroundColor: getProviderColor(mailbox.provider) }}
                                />

                                <div className="p-4">
                                    {/* Mailbox info */}
                                    <div className="flex items-start gap-3 mb-4">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold"
                                            style={{ backgroundColor: getProviderColor(mailbox.provider) }}
                                        >
                                            {mailbox.email[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 truncate">
                                                {mailbox.displayName || mailbox.email}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">
                                                {mailbox.email}
                                            </p>
                                        </div>
                                        {getSyncStatusBadge(mailbox.syncStatus)}
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <div className="p-2 bg-slate-50 rounded-lg text-center">
                                            <p className="text-lg font-semibold text-slate-900">
                                                {mailbox._count.threads}
                                            </p>
                                            <p className="text-xs text-slate-500">Threads</p>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-lg text-center">
                                            <p className="text-lg font-semibold text-slate-900">
                                                {mailbox.sentToday}/{mailbox.dailySendLimit}
                                            </p>
                                            <p className="text-xs text-slate-500">Envoyés</p>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-lg text-center">
                                            <p className={cn(
                                                "text-lg font-semibold",
                                                mailbox.healthScore >= 80 ? "text-emerald-600" :
                                                    mailbox.healthScore >= 50 ? "text-amber-600" : "text-red-600"
                                            )}>
                                                {mailbox.healthScore}%
                                            </p>
                                            <p className="text-xs text-slate-500">Santé</p>
                                        </div>
                                    </div>

                                    {/* Error message */}
                                    {mailbox.lastError && (
                                        <div className="p-2 mb-4 bg-red-50 border border-red-100 rounded-lg">
                                            <p className="text-xs text-red-600 truncate">
                                                {mailbox.lastError}
                                            </p>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleSync(mailbox.id)}
                                            disabled={syncingMailboxes.has(mailbox.id)}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                                        >
                                            {syncingMailboxes.has(mailbox.id) ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="w-4 h-4" />
                                            )}
                                            Sync
                                        </button>
                                        <a
                                            href={`/manager/email/mailboxes/${mailbox.id}`}
                                            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                            title="Paramètres"
                                        >
                                            <Settings className="w-4 h-4" />
                                        </a>
                                        <button
                                            onClick={() => handleDelete(mailbox.id)}
                                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
