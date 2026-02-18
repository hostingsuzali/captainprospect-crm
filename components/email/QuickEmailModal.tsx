"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
    X,
    Send,
    Mail,
    FileText,
    User,
    Building2,
    Loader2,
    ChevronDown,
    ChevronUp,
    Eye,
    Edit3,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    Inbox,
} from "lucide-react";
import { AiEmailDraftDialog } from "@/components/email/AiEmailDraftDialog";

// ============================================
// TYPES
// ============================================

interface Contact {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    title?: string | null;
    company?: {
        id: string;
        name: string;
    };
}

interface Company {
    id: string;
    name: string;
    phone?: string | null;
}

interface Mailbox {
    id: string;
    email: string;
    displayName: string | null;
    provider: string;
}

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    bodyHtml: string;
    category: string;
    variables: string[];
}

interface MissionTemplate {
    id: string;
    template: EmailTemplate;
}

interface QuickEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSent?: () => void;
    contact?: Contact | null;
    company?: Company | null;
    missionId?: string | null;
    missionName?: string | null;
}

// ============================================
// QUICK EMAIL MODAL
// ============================================

export function QuickEmailModal({
    isOpen,
    onClose,
    onSent,
    contact,
    company,
    missionId,
    missionName,
}: QuickEmailModalProps) {
    // State
    const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
    const [selectedMailboxId, setSelectedMailboxId] = useState<string>("");
    const [templates, setTemplates] = useState<MissionTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
    const [recipientEmail, setRecipientEmail] = useState<string>(""); // confirmed recipient (used for send)
    const [recipientInput, setRecipientInput] = useState<string>(""); // current input while typing
    const [subject, setSubject] = useState<string>("");
    const [bodyHtml, setBodyHtml] = useState<string>("");

    const [isLoadingMailboxes, setIsLoadingMailboxes] = useState(false);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showPreview, setShowPreview] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [sentSuccess, setSentSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAiDraftDialog, setShowAiDraftDialog] = useState(false);

    const editorRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const recipientInputRef = useRef<HTMLInputElement>(null);
    const selectedSuggestionRef = useRef(false);

    // Domain suggestions for recipient email
    const EMAIL_DOMAINS = ["@gmail.com", "@outlook.com", "@suzaliconseil.com"] as const;
    const [showDomainSuggestions, setShowDomainSuggestions] = useState(false);

    // ============================================
    // EFFECTS
    // ============================================

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setSentSuccess(false);
            setError(null);
            setIsEditing(false);
            setShowPreview(true);
            setSelectedTemplateId("");
            setSubject("");
            setBodyHtml("");
            setShowDomainSuggestions(false);

            // Set recipient from contact
            if (contact?.email) {
                setRecipientEmail(contact.email);
                setRecipientInput("");
            } else {
                setRecipientEmail("");
                setRecipientInput("");
            }
        }
    }, [isOpen, contact]);

    // Build domain suggestions: always show when focused; suggest full emails when 1+ char (so 2 letters etc.)
    const localPart = recipientInput.includes("@")
        ? recipientInput.slice(0, recipientInput.indexOf("@"))
        : recipientInput.trim();
    const shouldShowSuggestions = showDomainSuggestions;
    const suggestedEmails = shouldShowSuggestions
        ? localPart.length >= 1
            ? EMAIL_DOMAINS.map((d) => localPart + d)
            : []
        : [];

    // Effective recipient for Send: confirmed badge OR current input (completed if partial)
    const effectiveRecipient = recipientEmail
        ? recipientEmail
        : recipientInput.trim()
            ? recipientInput.includes("@")
                ? recipientInput.trim()
                : recipientInput.trim() + EMAIL_DOMAINS[0]
            : "";

    // Fetch mailboxes
    useEffect(() => {
        if (!isOpen) return;

        const fetchMailboxes = async () => {
            setIsLoadingMailboxes(true);
            try {
                const res = await fetch("/api/email/mailboxes");
                const json = await res.json();
                if (json.success) {
                    setMailboxes(json.data || []);
                    if (json.data?.length > 0 && !selectedMailboxId) {
                        setSelectedMailboxId(json.data[0].id);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch mailboxes:", err);
            } finally {
                setIsLoadingMailboxes(false);
            }
        };
        fetchMailboxes();
    }, [isOpen]);

    // Fetch mission templates
    useEffect(() => {
        if (!isOpen || !missionId) return;

        const fetchTemplates = async () => {
            setIsLoadingTemplates(true);
            try {
                const res = await fetch(`/api/missions/${missionId}/templates`);
                const json = await res.json();
                if (json.success) {
                    setTemplates(json.data || []);
                }
            } catch (err) {
                console.error("Failed to fetch templates:", err);
            } finally {
                setIsLoadingTemplates(false);
            }
        };
        fetchTemplates();
    }, [isOpen, missionId]);

    // Apply template when selected
    useEffect(() => {
        if (!selectedTemplateId) return;

        const missionTemplate = templates.find(t => t.template.id === selectedTemplateId);
        if (missionTemplate) {
            const tpl = missionTemplate.template;
            // Apply variable substitution preview
            let subjectWithVars = tpl.subject;
            let bodyWithVars = tpl.bodyHtml;

            const variables: Record<string, string> = {
                firstName: contact?.firstName || '',
                lastName: contact?.lastName || '',
                fullName: [contact?.firstName, contact?.lastName].filter(Boolean).join(' '),
                title: contact?.title || '',
                email: contact?.email || '',
                company: contact?.company?.name || company?.name || '',
                companyName: contact?.company?.name || company?.name || '',
            };

            // Replace variables
            Object.entries(variables).forEach(([key, value]) => {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                subjectWithVars = subjectWithVars.replace(regex, value);
                bodyWithVars = bodyWithVars.replace(regex, value);
            });

            setSubject(subjectWithVars);
            setBodyHtml(bodyWithVars);
        }
    }, [selectedTemplateId, templates, contact, company]);

    // ============================================
    // HANDLERS
    // ============================================

    const handleSend = async () => {
        if (!selectedMailboxId || !effectiveRecipient) {
            setError("Sélectionnez une boîte mail et un destinataire");
            return;
        }

        setIsSending(true);
        setError(null);

        try {
            const res = await fetch("/api/email/quick-send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mailboxId: selectedMailboxId,
                    templateId: selectedTemplateId || undefined,
                    to: [{ email: effectiveRecipient }],
                    contactId: contact?.id,
                    companyId: company?.id || contact?.company?.id,
                    missionId: missionId ?? undefined,
                    customSubject: subject,
                    customBodyHtml: bodyHtml,
                }),
            });

            const json = await res.json();

            if (json.success) {
                setSentSuccess(true);
                setTimeout(() => {
                    onClose();
                    onSent?.();
                }, 1500);
            } else {
                setError(json.error || "Erreur lors de l'envoi");
            }
        } catch (err) {
            console.error("Send error:", err);
            setError("Erreur lors de l'envoi");
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === "Escape") {
            onClose();
        }
    }, [onClose]);

    // On blur: confirm recipient (no Tab needed). Complete with first domain if partial; set as confirmed and show as badge.
    const handleRecipientBlur = () => {
        if (selectedSuggestionRef.current) {
            selectedSuggestionRef.current = false;
            setShowDomainSuggestions(false);
            return;
        }
        const value = recipientInput.trim();
        if (!value) {
            setShowDomainSuggestions(false);
            return;
        }
        const fullEmail = value.includes("@") ? value : value + EMAIL_DOMAINS[0];
        setRecipientEmail(fullEmail);
        setRecipientInput("");
        setShowDomainSuggestions(false);
    };

    const handleSelectSuggestion = (fullEmail: string) => {
        selectedSuggestionRef.current = true;
        setRecipientEmail(fullEmail);
        setRecipientInput("");
        setShowDomainSuggestions(false);
        recipientInputRef.current?.focus();
    };

    const handleRemoveRecipient = () => {
        setRecipientEmail("");
        setRecipientInput("");
    };

    useEffect(() => {
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, handleKeyDown]);

    // ============================================
    // RENDER
    // ============================================

    if (!isOpen) return null;

    const selectedMailbox = mailboxes.find(m => m.id === selectedMailboxId);
    const hasNoMailboxes = !isLoadingMailboxes && mailboxes.length === 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className={cn(
                    "relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden",
                    "transform transition-all duration-300 animate-scale-in",
                    "flex flex-col max-h-[90vh]"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <Send className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Envoi rapide</h2>
                            {missionName && (
                                <p className="text-sm text-white/80">{missionName}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Success State */}
                {sentSuccess ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 animate-bounce">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900 mb-2">Email envoyé !</h3>
                        <p className="text-slate-500">Votre email a été envoyé avec succès</p>
                    </div>
                ) : hasNoMailboxes ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6">
                        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                            <Inbox className="w-8 h-8 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900 mb-2">Aucune boîte mail connectée</h3>
                        <p className="text-slate-500 text-center mb-4">
                            Connectez une boîte mail pour pouvoir envoyer des emails
                        </p>
                        <a
                            href="/manager/email"
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors"
                        >
                            Connecter une boîte mail
                        </a>
                    </div>
                ) : (
                    <>
                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5 email-scrollbar">
                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            {/* Recipient Info */}
                            {(contact || company) && (
                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
                                        {contact ? (
                                            <User className="w-6 h-6 text-indigo-600" />
                                        ) : (
                                            <Building2 className="w-6 h-6 text-indigo-600" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-900 truncate">
                                            {contact
                                                ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Contact'
                                                : company?.name || 'Entreprise'}
                                        </p>
                                        <p className="text-sm text-slate-500 truncate">
                                            {contact?.title && `${contact.title} · `}
                                            {contact?.company?.name || company?.name || ''}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* From (Mailbox Selection) */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <Mail className="w-4 h-4" />
                                    Envoyer depuis
                                </label>
                                {isLoadingMailboxes ? (
                                    <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
                                ) : (
                                    <select
                                        value={selectedMailboxId}
                                        onChange={(e) => setSelectedMailboxId(e.target.value)}
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    >
                                        {mailboxes.map((mb) => (
                                            <option key={mb.id} value={mb.id}>
                                                {mb.displayName ? `${mb.displayName} <${mb.email}>` : mb.email}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* To */}
                            <div className="space-y-2 relative">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <User className="w-4 h-4" />
                                    Destinataire
                                </label>
                                <div className="flex flex-wrap items-center gap-2 min-h-11 px-3 py-2 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
                                    {recipientEmail && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium">
                                            {recipientEmail}
                                            <button
                                                type="button"
                                                onClick={handleRemoveRecipient}
                                                className="p-0.5 rounded hover:bg-slate-500 text-white/90 hover:text-white transition-colors"
                                                title="Supprimer"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    )}
                                    <input
                                        ref={recipientInputRef}
                                        type="text"
                                        value={recipientInput}
                                        onChange={(e) => setRecipientInput(e.target.value)}
                                        onFocus={() => setShowDomainSuggestions(true)}
                                        onBlur={handleRecipientBlur}
                                        placeholder={recipientEmail ? "Ajouter un destinataire" : "email@example.com"}
                                        className="flex-1 min-w-[120px] h-8 bg-transparent text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none"
                                        autoComplete="off"
                                    />
                                </div>
                                {suggestedEmails.length > 0 && (
                                    <div
                                        className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-100">
                                            Suggestions
                                        </p>
                                        {suggestedEmails.map((email) => (
                                            <button
                                                key={email}
                                                type="button"
                                                onMouseDown={() => handleSelectSuggestion(email)}
                                                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                            >
                                                {email}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Template Selection */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <FileText className="w-4 h-4" />
                                    Template
                                    {missionName && (
                                        <span className="text-xs text-slate-400 font-normal">
                                            ({templates.length} disponible{templates.length > 1 ? 's' : ''})
                                        </span>
                                    )}
                                </label>
                                {isLoadingTemplates ? (
                                    <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
                                ) : templates.length === 0 ? (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <p className="text-sm text-amber-700">
                                            Aucun template assigné à cette mission.
                                            {missionId && (
                                                <span className="block mt-1 text-amber-600">
                                                    Ajoutez des templates depuis la page de la mission.
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid gap-2">
                                        {templates.map((mt) => (
                                            <button
                                                key={mt.template.id}
                                                onClick={() => setSelectedTemplateId(mt.template.id)}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                                                    selectedTemplateId === mt.template.id
                                                        ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20"
                                                        : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                                    selectedTemplateId === mt.template.id
                                                        ? "bg-indigo-500 text-white"
                                                        : "bg-slate-100 text-slate-500"
                                                )}>
                                                    <Sparkles className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-slate-900 truncate">
                                                        {mt.template.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 truncate">
                                                        {mt.template.subject}
                                                    </p>
                                                </div>
                                                {selectedTemplateId === mt.template.id && (
                                                    <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Subject */}
                            {(selectedTemplateId || isEditing) && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-slate-700">
                                            Objet
                                        </label>
                                        {!isEditing && (
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                                            >
                                                <Edit3 className="w-3 h-3" />
                                                Modifier
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        readOnly={!isEditing}
                                        className={cn(
                                            "w-full h-11 px-4 border rounded-xl text-slate-900 text-sm transition-all",
                                            isEditing
                                                ? "bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                : "bg-slate-50 border-slate-200 cursor-default"
                                        )}
                                    />
                                </div>
                            )}

                            {/* Body Preview/Edit */}
                            {(selectedTemplateId || isEditing) && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-slate-700">
                                            Contenu
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowAiDraftDialog(true)}
                                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                title="Rédaction assistée par IA"
                                            >
                                                <Sparkles className="w-4 h-4" />
                                                AI
                                            </button>
                                            <button
                                                onClick={() => setShowPreview(!showPreview)}
                                                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                                            >
                                            {showPreview ? (
                                                <>
                                                    <ChevronUp className="w-3 h-3" />
                                                    Réduire
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-3 h-3" />
                                                    Afficher
                                                </>
                                            )}
                                            </button>
                                        </div>
                                    </div>
                                    {showPreview && (
                                        <div className={cn(
                                            "border rounded-xl overflow-hidden transition-all",
                                            isEditing ? "border-indigo-300" : "border-slate-200"
                                        )}>
                                            <div
                                                ref={editorRef}
                                                contentEditable={isEditing}
                                                suppressContentEditableWarning
                                                onInput={(e) => setBodyHtml(e.currentTarget.innerHTML)}
                                                className={cn(
                                                    "min-h-[200px] max-h-[300px] overflow-y-auto p-4 text-sm text-slate-700 email-scrollbar",
                                                    isEditing ? "bg-white focus:outline-none" : "bg-slate-50"
                                                )}
                                                dangerouslySetInnerHTML={{ __html: bodyHtml }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <AiEmailDraftDialog
                            open={showAiDraftDialog}
                            onClose={() => setShowAiDraftDialog(false)}
                            subject={subject}
                            onInsert={(html) => {
                                setBodyHtml((prev) => prev + html);
                                setShowAiDraftDialog(false);
                            }}
                        />

                        {/* Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={onClose}
                                className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={isSending || !selectedMailboxId || !effectiveRecipient || (!selectedTemplateId && !subject)}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl transition-all",
                                    "bg-gradient-to-r from-indigo-600 to-violet-600 text-white",
                                    "hover:from-indigo-500 hover:to-violet-500 hover:shadow-lg hover:shadow-indigo-500/25",
                                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                                )}
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Envoi en cours...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Envoyer
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default QuickEmailModal;
