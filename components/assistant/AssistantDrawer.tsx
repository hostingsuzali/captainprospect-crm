"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    Bot,
    ChevronDown,
    Copy,
    Check,
    MessageSquarePlus,
    Send,
    Sparkles,
    User,
    X,
    Clock,
    Trash2,
} from "lucide-react";
import { Drawer, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getAssistantQuickPrompts } from "@/lib/assistant/context";

type ChatRole = "user" | "assistant";

interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;
    createdAt: string;
}

interface AssistantDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    role?: string;
    pathname?: string;
}

interface ConversationItem {
    id: string;
    title: string;
    updatedAt: string;
    summary?: string | null;
    messageCount: number;
}

function makeMessage(role: ChatRole, content: string): ChatMessage {
    return {
        id: typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        role,
        content,
        createdAt: new Date().toISOString(),
    };
}

function formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `il y a ${days}j`;
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function AssistantDrawer({
    isOpen,
    onClose,
    role,
    pathname,
}: AssistantDrawerProps) {
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [provider, setProvider] = useState<string | null>(null);
    const [promptVersion, setPromptVersion] = useState<string | null>(null);
    const [showConversationPicker, setShowConversationPicker] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [sessionId] = useState(() =>
        typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `s-${Date.now()}`
    );

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const conversationPickerRef = useRef<HTMLDivElement>(null);
    const prompts = useMemo(() => getAssistantQuickPrompts(pathname, role), [pathname, role]);

    const activeConversation = useMemo(
        () => conversations.find((c) => c.id === activeConversationId),
        [conversations, activeConversationId]
    );

    // ── Data loading ──────────────────────────────────────────────────────────

    const loadConversations = async (conversationId?: string) => {
        setIsLoadingHistory(true);
        try {
            const query = conversationId
                ? `?conversationId=${encodeURIComponent(conversationId)}`
                : "";
            const res = await fetch(`/api/assistant/conversations${query}`);
            const json = await res.json();
            if (!json.success) return null;

            setConversations(json.data.sessions ?? []);
            setActiveConversationId(json.data.activeConversationId ?? null);
            setMessages(
                (json.data.messages ?? []).map(
                    (m: { role: ChatRole; content: string; createdAt: string }) => ({
                        id:
                            typeof crypto !== "undefined" && crypto.randomUUID
                                ? crypto.randomUUID()
                                : `${Date.now()}-${Math.random()}`,
                        role: m.role,
                        content: m.content,
                        createdAt: m.createdAt,
                    })
                )
            );
        } catch {
            // Ignore history loading issues and keep local state.
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        void loadConversations();
    }, [isOpen]);

    const createConversation = async (): Promise<string | null> => {
        try {
            const res = await fetch("/api/assistant/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "new" }),
            });
            const json = await res.json();
            if (!json.success) return null;
            setActiveConversationId(json.data.conversationId);
            setMessages([]);
            setShowConversationPicker(false);
            await loadConversations(json.data.conversationId);
            inputRef.current?.focus();
            return json.data.conversationId as string;
        } catch {
            return null;
        }
    };

    const switchConversation = async (conversationId: string) => {
        if (conversationId === activeConversationId) {
            setShowConversationPicker(false);
            return;
        }
        try {
            const res = await fetch("/api/assistant/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "setActive", conversationId }),
            });
            const json = await res.json();
            if (!json.success) return;
            setActiveConversationId(conversationId);
            setMessages(
                (json.data.messages ?? []).map(
                    (m: { role: ChatRole; content: string; createdAt: string }) => ({
                        id:
                            typeof crypto !== "undefined" && crypto.randomUUID
                                ? crypto.randomUUID()
                                : `${Date.now()}-${Math.random()}`,
                        role: m.role,
                        content: m.content,
                        createdAt: m.createdAt,
                    })
                )
            );
            setShowConversationPicker(false);
        } catch {
            // Ignore switch errors.
        }
    };

    // ── Focus & scroll ────────────────────────────────────────────────────────

    useEffect(() => {
        if (!isOpen) return;
        const t = window.setTimeout(() => inputRef.current?.focus(), 120);
        return () => window.clearTimeout(t);
    }, [isOpen, activeConversationId]);

    useEffect(() => {
        if (!scrollerRef.current) return;
        scrollerRef.current.scrollTo({
            top: scrollerRef.current.scrollHeight,
            behavior: messages.length > 1 ? "smooth" : "auto",
        });
    }, [messages, isSending, isOpen]);

    // Close conversation picker on outside click
    useEffect(() => {
        if (!showConversationPicker) return;
        const handler = (e: MouseEvent) => {
            if (conversationPickerRef.current && !conversationPickerRef.current.contains(e.target as Node)) {
                setShowConversationPicker(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showConversationPicker]);

    // Auto-resize textarea
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, []);

    // ── Messaging ───────���─────────────────────��───────────────────────────────

    const sendMessage = async (contentFromPrompt?: string) => {
        const messageText = (contentFromPrompt ?? input).trim();
        if (!messageText || isSending) return;

        let conversationIdToUse = activeConversationId;
        if (!conversationIdToUse) {
            conversationIdToUse = await createConversation();
        }

        const userMessage = makeMessage("user", messageText);
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput("");
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
        }
        setIsSending(true);

        try {
            const res = await fetch("/api/assistant/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: nextMessages.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                    context: {
                        role,
                        pathname,
                    },
                    sessionId,
                    conversationId: conversationIdToUse ?? undefined,
                }),
            });
            const json = await res.json();
            if (!json.success) {
                throw new Error(json.error || "Assistant request failed");
            }

            setProvider(json.data.provider ?? null);
            setPromptVersion(json.data.promptVersion ?? null);
            setMessages((prev) => [...prev, makeMessage("assistant", json.data.answer)]);
            if (json.data.conversationId) {
                setActiveConversationId(json.data.conversationId);
            }
            await loadConversations(json.data.conversationId ?? conversationIdToUse ?? undefined);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Une erreur est survenue pendant la réponse IA.";
            setMessages((prev) => [
                ...prev,
                makeMessage(
                    "assistant",
                    `Je rencontre un problème technique pour le moment (${message}). Réessayez dans quelques secondes.`
                ),
            ]);
        } finally {
            setIsSending(false);
        }
    };

    const copyMessage = async (msg: ChatMessage) => {
        try {
            await navigator.clipboard.writeText(msg.content);
            setCopiedMessageId(msg.id);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch {
            // Ignore clipboard failures.
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title=""
            size="lg"
            side="right"
            showCloseButton={false}
            className="top-3 bottom-3 right-3 rounded-[30px] border border-[#E8EBF0] shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
        >
            <style>{`
                @keyframes cpMessageIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes cpTypingDot {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                    40% { transform: translateY(-4px); opacity: 1; }
                }
                @keyframes cpPulseGlow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(124, 92, 252, 0.15); }
                    50% { box-shadow: 0 0 0 6px rgba(124, 92, 252, 0); }
                }
                @keyframes cpFadeInScale {
                    from { opacity: 0; transform: scale(0.95) translateY(-4px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>

            <div className="flex h-full flex-col -mx-6 -mt-4">
                {/* ── Unified Header ─────────────────────────────────────── */}
                <header className="flex items-center gap-3 px-5 py-3.5 border-b border-[#E8EBF0] bg-gradient-to-r from-[#FAFAFF] to-white shrink-0">
                    {/* Logo + title area */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C5CFC] to-[#6347E0] flex items-center justify-center shadow-md shrink-0"
                            style={{ animation: "cpPulseGlow 3s ease-in-out infinite" }}
                        >
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold text-[#12122A] leading-tight truncate">
                                Assistant CRM
                            </h2>
                            <div className="flex items-center gap-1.5">
                                {provider && (
                                    <span className="text-[10px] font-semibold uppercase text-[#8B8BA7] bg-[#F3F4F8] px-1.5 py-0.5 rounded">
                                        {provider}
                                    </span>
                                )}
                                <span className="text-[10px] text-[#8B8BA7]">
                                    {promptVersion || "Guide intelligent"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Conversation switcher (integrated dropdown) */}
                    <div className="relative" ref={conversationPickerRef}>
                        <button
                            type="button"
                            onClick={() => setShowConversationPicker(!showConversationPicker)}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150",
                                "border border-[#E8EBF0] hover:border-[#C5C8D4] hover:bg-[#F5F6FA]",
                                showConversationPicker
                                    ? "bg-[#F3F0FF] border-[#D4C8FF] text-[#5B4FE8]"
                                    : "bg-white text-[#5A5A7A]"
                            )}
                            aria-expanded={showConversationPicker}
                            aria-haspopup="listbox"
                            aria-label="Choisir une conversation"
                        >
                            <Clock className="w-3 h-3" />
                            <span className="max-w-[100px] truncate">
                                {activeConversation?.title || "Conversations"}
                            </span>
                            <ChevronDown className={cn(
                                "w-3 h-3 transition-transform duration-200",
                                showConversationPicker && "rotate-180"
                            )} />
                        </button>

                        {/* Conversation dropdown */}
                        {showConversationPicker && (
                            <div
                                className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-[#E0E3EA] rounded-xl shadow-[0_12px_40px_rgba(15,23,42,0.12)] z-50 overflow-hidden"
                                style={{ animation: "cpFadeInScale 150ms cubic-bezier(0.16, 1, 0.3, 1)" }}
                                role="listbox"
                                aria-label="Liste des conversations"
                            >
                                <div className="px-3 py-2.5 border-b border-[#F0F1F5] flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B8BA7]">
                                        Conversations
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void createConversation()}
                                        className="flex items-center gap-1 text-[11px] font-semibold text-[#7C5CFC] hover:text-[#5B4FE8] transition-colors px-2 py-1 rounded-md hover:bg-[#F3F0FF]"
                                    >
                                        <MessageSquarePlus className="w-3 h-3" />
                                        Nouvelle
                                    </button>
                                </div>
                                <div className="max-h-64 overflow-y-auto py-1">
                                    {conversations.length === 0 ? (
                                        <p className="px-4 py-6 text-center text-xs text-[#8B8BA7]">
                                            Aucune conversation
                                        </p>
                                    ) : (
                                        conversations.map((conv) => (
                                            <button
                                                key={conv.id}
                                                type="button"
                                                role="option"
                                                aria-selected={conv.id === activeConversationId}
                                                onClick={() => void switchConversation(conv.id)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors",
                                                    conv.id === activeConversationId
                                                        ? "bg-[#F3F0FF]"
                                                        : "hover:bg-[#F9FAFC]"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                                                    conv.id === activeConversationId
                                                        ? "bg-[#7C5CFC]"
                                                        : "bg-[#D8DEEA]"
                                                )} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "text-[12px] font-medium truncate leading-tight",
                                                        conv.id === activeConversationId
                                                            ? "text-[#5B4FE8]"
                                                            : "text-[#12122A]"
                                                    )}>
                                                        {conv.title}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-[#8B8BA7]">
                                                            {formatRelativeTime(conv.updatedAt)}
                                                        </span>
                                                        <span className="text-[10px] text-[#B0B3C4]">
                                                            {conv.messageCount} msg
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* New conversation + close buttons */}
                    <div className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => void createConversation()}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8B8BA7] hover:bg-[#F3F0FF] hover:text-[#7C5CFC] transition-all duration-150"
                            title="Nouvelle conversation"
                            aria-label="Créer une nouvelle conversation"
                        >
                            <MessageSquarePlus className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8B8BA7] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-all duration-150"
                            aria-label="Fermer l'assistant"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* ── Messages Area (takes all available space) ──────────── */}
                <div
                    ref={scrollerRef}
                    className="flex-1 overflow-y-auto px-5 py-4 scroll-smooth"
                    role="log"
                    aria-label="Messages de la conversation"
                    aria-live="polite"
                >
                    {isLoadingHistory && (
                        <div className="flex items-center justify-center py-8">
                            <div className="flex items-center gap-2 text-[12px] text-[#8B8BA7]">
                                <div className="w-4 h-4 rounded-full border-2 border-[#7C5CFC] border-t-transparent animate-spin" />
                                Chargement...
                            </div>
                        </div>
                    )}

                    {/* Empty state — welcome + quick prompts */}
                    {!isLoadingHistory && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] px-4">
                            <div
                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C5CFC]/10 to-[#7C5CFC]/5 border border-[#7C5CFC]/10 flex items-center justify-center mb-5"
                            >
                                <Bot className="w-7 h-7 text-[#7C5CFC]" />
                            </div>
                            <h3 className="text-base font-bold text-[#12122A] mb-1.5 text-center">
                                Comment puis-je vous aider ?
                            </h3>
                            <p className="text-[13px] text-[#6A6A8A] text-center max-w-[280px] mb-6 leading-relaxed">
                                Posez vos questions sur vos données CRM, missions, contacts ou performance.
                            </p>
                            <div className="w-full max-w-sm space-y-2">
                                {prompts.map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        onClick={() => sendMessage(prompt)}
                                        className={cn(
                                            "w-full text-left rounded-xl border border-[#E8EBF0] bg-white px-4 py-3 text-[13px] text-[#4A4A6A]",
                                            "hover:border-[#7C5CFC]/30 hover:bg-[#FAFAFF] hover:text-[#12122A] hover:shadow-sm",
                                            "transition-all duration-150 group"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Sparkles className="w-3.5 h-3.5 text-[#B0B3C4] group-hover:text-[#7C5CFC] transition-colors shrink-0" />
                                            <span className="line-clamp-2">{prompt}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    {messages.length > 0 && (
                        <div className="space-y-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex gap-2.5 group",
                                        msg.role === "user" ? "justify-end" : "justify-start"
                                    )}
                                    style={{
                                        animation: "cpMessageIn 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                                    }}
                                >
                                    {msg.role === "assistant" && (
                                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#EEF2FF] to-[#E8EAFF] text-[#5B4FE8] ring-1 ring-[#E0E3FF]">
                                            <Bot className="h-3.5 w-3.5" />
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-1 max-w-[82%]">
                                        <div
                                            className={cn(
                                                "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed",
                                                msg.role === "user"
                                                    ? "bg-gradient-to-r from-[#7C5CFC] to-[#6347E0] text-white rounded-br-md"
                                                    : "bg-[#F4F6FA] text-[#12122A] border border-[#E8EBF0] rounded-bl-md"
                                            )}
                                        >
                                            {msg.content}
                                        </div>
                                        {/* Message actions */}
                                        <div className={cn(
                                            "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150",
                                            msg.role === "user" ? "justify-end" : "justify-start"
                                        )}>
                                            <button
                                                type="button"
                                                onClick={() => copyMessage(msg)}
                                                className="flex items-center gap-1 text-[10px] text-[#8B8BA7] hover:text-[#5B4FE8] transition-colors px-1.5 py-0.5 rounded hover:bg-[#F3F0FF]"
                                                aria-label="Copier ce message"
                                            >
                                                {copiedMessageId === msg.id ? (
                                                    <>
                                                        <Check className="w-3 h-3 text-emerald-500" />
                                                        <span className="text-emerald-500">Copié</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3 h-3" />
                                                        Copier
                                                    </>
                                                )}
                                            </button>
                                            <span className="text-[10px] text-[#C5C8D4]">
                                                {new Date(msg.createdAt).toLocaleTimeString("fr-FR", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                    {msg.role === "user" && (
                                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF1F6] text-[#5A5A7A] ring-1 ring-[#E0E3EA]">
                                            <User className="h-3.5 w-3.5" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Typing indicator */}
                            {isSending && (
                                <div
                                    className="flex items-start gap-2.5"
                                    style={{ animation: "cpMessageIn 200ms cubic-bezier(0.16, 1, 0.3, 1)" }}
                                >
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#EEF2FF] to-[#E8EAFF] text-[#5B4FE8] ring-1 ring-[#E0E3FF]">
                                        <Bot className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="rounded-2xl rounded-bl-md bg-[#F4F6FA] border border-[#E8EBF0] px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[12px] text-[#8B8BA7]">Réflexion en cours</span>
                                            <div className="flex items-center gap-[3px] ml-1">
                                                <span className="h-[5px] w-[5px] rounded-full bg-[#7C5CFC]" style={{ animation: "cpTypingDot 1s infinite" }} />
                                                <span className="h-[5px] w-[5px] rounded-full bg-[#7C5CFC]" style={{ animation: "cpTypingDot 1s 150ms infinite" }} />
                                                <span className="h-[5px] w-[5px] rounded-full bg-[#7C5CFC]" style={{ animation: "cpTypingDot 1s 300ms infinite" }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Input Area (sticky bottom, unified with content) ──── */}
                <div className="shrink-0 border-t border-[#E8EBF0] bg-white px-4 py-3">
                    <div className="rounded-xl border border-[#E8EBF0] bg-[#FAFBFD] focus-within:border-[#7C5CFC] focus-within:ring-2 focus-within:ring-[#7C5CFC]/10 transition-all duration-200 overflow-hidden">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    void sendMessage();
                                }
                            }}
                            placeholder="Posez votre question CRM..."
                            rows={1}
                            aria-label="Message à l'assistant"
                            className="w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-[13px] text-[#12122A] placeholder:text-[#B0B3C4] outline-none"
                            style={{ minHeight: "40px", maxHeight: "160px" }}
                        />
                        <div className="flex items-center justify-between px-3 pb-2.5">
                            <p className="text-[10px] text-[#B0B3C4] select-none">
                                <kbd className="font-mono text-[9px] bg-[#F0F1F5] px-1 py-0.5 rounded border border-[#E8EBF0]">Enter</kbd>
                                {" "}envoyer
                                <span className="mx-1.5 text-[#D8DEEA]">|</span>
                                <kbd className="font-mono text-[9px] bg-[#F0F1F5] px-1 py-0.5 rounded border border-[#E8EBF0]">Shift+Enter</kbd>
                                {" "}nouvelle ligne
                            </p>
                            <button
                                type="button"
                                onClick={() => sendMessage()}
                                disabled={isSending || !input.trim()}
                                aria-label="Envoyer le message"
                                className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200",
                                    input.trim() && !isSending
                                        ? "bg-[#7C5CFC] text-white hover:bg-[#6347E0] shadow-sm hover:shadow-md active:scale-95"
                                        : "bg-[#F0F1F5] text-[#C5C8D4] cursor-not-allowed"
                                )}
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Drawer>
    );
}
