"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useCommsRealtime } from "@/hooks/useCommsRealtime";
import { useToast } from "@/components/ui";
import type { CommsRealtimePayload } from "@/lib/comms/events";
import {
    MessageSquare,
    Plus,
    Search,
    RefreshCw,
    Target,
    Building2,
    FileText,
    Users,
    MessageCircle,
    Megaphone,
    Inbox,
    Clock,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Mail,
    PanelLeftClose,
    PanelLeft,
    Loader2,
    AlertCircle,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { CommsPageHeader } from "@/components/comms/CommsPageHeader";
import { ThreadList } from "@/components/comms/ThreadList";
import { ThreadView } from "@/components/comms/ThreadView";
import { NewThreadModal } from "@/components/comms/NewThreadModal";
import { SearchPanel } from "@/components/comms/SearchPanel";
import type {
    CommsThreadListItem,
    CommsThreadView,
    CommsMessageView,
    CommsInboxStats,
    CommsInboxFilters,
    CommsChannelType,
    CommsThreadStatus,
    CreateThreadRequest,
} from "@/lib/comms/types";

function getInitials(name: string): string {
    return name.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}
function buildOptimisticMessage(tempId: string, content: string, currentUserId: string, currentUserName: string, currentUserRole: string): CommsMessageView {
    return {
        id: tempId, threadId: "", type: "TEXT", content,
        author: { id: currentUserId, name: currentUserName, role: currentUserRole, initials: getInitials(currentUserName) },
        mentions: [], attachments: [], readBy: [], reactions: [], isEdited: false, isDeleted: false, isOwnMessage: true,
        createdAt: new Date().toISOString(), isOptimistic: true,
    };
}
function buildMessageFromPayload(payload: CommsRealtimePayload, threadId: string, currentUserId: string): CommsMessageView | null {
    if (payload.type !== "message_created" || !payload.messageId || !payload.content || !payload.createdAt) return null;
    const authorId = payload.userId ?? "";
    const authorName = payload.userName ?? "Utilisateur";
    return {
        id: payload.messageId, threadId, type: "TEXT", content: payload.content,
        author: { id: authorId, name: authorName, role: "", initials: getInitials(authorName) },
        mentions: [], attachments: [], readBy: [], reactions: [], isEdited: false, isDeleted: false,
        isOwnMessage: authorId === currentUserId, createdAt: payload.createdAt,
    };
}

// ============================================
// STAT CARD COMPONENT
// ============================================

function StatCard({
    icon: Icon,
    label,
    value,
    subValue,
    trend,
    color,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    subValue?: string;
    trend?: { value: number; isPositive: boolean };
    color: "indigo" | "emerald" | "amber" | "rose" | "blue" | "purple";
}) {
    const colors = {
        indigo: "from-indigo-500 to-indigo-600",
        emerald: "from-emerald-500 to-emerald-600",
        amber: "from-amber-500 to-amber-600",
        rose: "from-rose-500 to-rose-600",
        blue: "from-blue-500 to-blue-600",
        purple: "from-purple-500 to-purple-600",
    };

    return (
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-5 group hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
                    <p className="text-3xl font-bold text-slate-900">{value}</p>
                    {subValue && (
                        <p className="text-sm text-slate-400 mt-1">{subValue}</p>
                    )}
                    {trend && (
                        <div className={cn(
                            "flex items-center gap-1 mt-2 text-sm font-medium",
                            trend.isPositive ? "text-emerald-600" : "text-rose-600"
                        )}>
                            {trend.isPositive ? (
                                <ArrowUpRight className="w-4 h-4" />
                            ) : (
                                <ArrowDownRight className="w-4 h-4" />
                            )}
                            <span>{trend.value}%</span>
                        </div>
                    )}
                </div>
                <div className={cn(
                    "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                    colors[color]
                )}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
            <div className={cn(
                "absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-10 bg-gradient-to-br",
                colors[color]
            )} />
        </div>
    );
}

// ============================================
// FILTER OPTIONS
// ============================================

const FILTER_OPTIONS: {
    type: CommsChannelType | "all";
    label: string;
    icon: typeof Target;
}[] = [
        { type: "all", label: "Tous", icon: MessageSquare },
        { type: "MISSION", label: "Missions", icon: Target },
        { type: "CLIENT", label: "Clients", icon: Building2 },
        { type: "CAMPAIGN", label: "Campagnes", icon: FileText },
        { type: "GROUP", label: "Groupes", icon: Users },
        { type: "DIRECT", label: "Directs", icon: MessageCircle },
        { type: "BROADCAST", label: "Annonces", icon: Megaphone },
    ];

// ============================================
// CUSTOM HOOK FOR DEBOUNCED VALUE
// ============================================

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function SDRCommsPage() {
    const { data: session } = useSession();
    const { error, success } = useToast();

    const [threads, setThreads] = useState<CommsThreadListItem[]>([]);
    const [selectedThread, setSelectedThread] = useState<CommsThreadView | null>(null);
    const [stats, setStats] = useState<CommsInboxStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingThread, setIsLoadingThread] = useState(false);
    const [showNewThreadModal, setShowNewThreadModal] = useState(false);
    const [showSearchPanel, setShowSearchPanel] = useState(false);
    const [isListCollapsed, setIsListCollapsed] = useState(false);
    const [focusMode, setFocusMode] = useState(false);

    // Filters
    const [filters, setFilters] = useState<CommsInboxFilters>({});
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 400);
    const selectedThreadIdRef = useRef<string | null>(null);
    selectedThreadIdRef.current = selectedThread?.id ?? null;

    // Typing indicators per thread - support multiple users
    const [typingByThread, setTypingByThread] = useState<Record<string, string[]>>({});
    const typingTimeoutRef = useRef<Record<string, Record<string, ReturnType<typeof setTimeout>>>>({});

    // Fetch threads
    const fetchThreads = useCallback(async (refresh = false) => {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const params = new URLSearchParams();
            if (filters.type) params.set("type", filters.type);
            if (filters.status) params.set("status", filters.status);
            if (filters.unreadOnly) params.set("unreadOnly", "true");
            if (debouncedSearchQuery) params.set("search", debouncedSearchQuery);

            const res = await fetch(`/api/comms/threads?${params}`);
            if (res.ok) {
                const data = await res.json();
                setThreads(data.threads || []);
            } else {
                error("Erreur", "Impossible de charger les discussions");
            }
        } catch (error) {
            console.error("Error fetching threads:", error);
            error("Erreur", "Impossible de charger les discussions");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [filters, debouncedSearchQuery, error]);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch("/api/comms/inbox/stats");
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    }, []);

    // Fetch thread details
    const fetchThreadDetails = useCallback(async (threadId: string) => {
        setIsLoadingThread(true);
        try {
            const res = await fetch(`/api/comms/threads/${threadId}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedThread(data);
            } else {
                error("Erreur", "Impossible de charger la discussion");
            }
        } catch (error) {
            console.error("Error fetching thread:", error);
            error("Erreur", "Impossible de charger la discussion");
        } finally {
            setIsLoadingThread(false);
        }
    }, [error]);

    const statsRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedFetchStats = useCallback(() => {
        if (statsRefreshRef.current) clearTimeout(statsRefreshRef.current);
        statsRefreshRef.current = setTimeout(() => { statsRefreshRef.current = null; void fetchStats(); }, 500);
    }, [fetchStats]);

    const handleRealtimeEvent = useCallback(
        (payload: CommsRealtimePayload) => {
            let tid = payload.threadId;
            if (!tid && (payload.type === "typing_start" || payload.type === "typing_stop") && payload.userId && selectedThread?.participants?.some((p) => p.userId === payload.userId)) {
                tid = selectedThread.id;
            }
            const userName = payload.userName;

            if (payload.type === "typing_start" && tid && userName) {
                if (!typingTimeoutRef.current[tid]) typingTimeoutRef.current[tid] = {};
                if (typingTimeoutRef.current[tid][userName]) clearTimeout(typingTimeoutRef.current[tid][userName]);
                setTypingByThread((prev) => {
                    const current = prev[tid] || [];
                    if (!current.includes(userName)) return { ...prev, [tid]: [...current, userName] };
                    return prev;
                });
                typingTimeoutRef.current[tid][userName] = setTimeout(() => {
                    setTypingByThread((prev) => ({ ...prev, [tid]: (prev[tid] || []).filter(n => n !== userName) }));
                    delete typingTimeoutRef.current[tid][userName];
                }, 5000);
            } else if (payload.type === "typing_stop" && tid && userName) {
                setTypingByThread((prev) => ({ ...prev, [tid]: (prev[tid] || []).filter(n => n !== userName) }));
                if (typingTimeoutRef.current[tid]?.[userName]) {
                    clearTimeout(typingTimeoutRef.current[tid][userName]);
                    delete typingTimeoutRef.current[tid][userName];
                }
            }

            if (!tid) return;
            const currentUserId = session?.user?.id ?? "";

            switch (payload.type) {
                case "message_created": {
                    const msg = buildMessageFromPayload(payload, tid, currentUserId);
                    if (msg) {
                        setSelectedThread((prev) => {
                            if (prev?.id !== tid) return prev;
                            if (prev.messages.some((m) => m.id === msg.id)) return prev;
                            return { ...prev, messages: [...prev.messages, msg] };
                        });
                        setThreads((prev) =>
                            prev.map((t) =>
                                t.id === tid
                                    ? { ...t, lastMessage: { content: payload.content ?? msg.content, authorName: payload.userName ?? msg.author.name, createdAt: payload.createdAt ?? msg.createdAt } }
                                    : t
                            )
                        );
                    }
                    debouncedFetchStats();
                    return;
                }
                case "message_updated":
                    setSelectedThread((prev) => {
                        if (!prev || prev.id !== tid || !payload.messageId) return prev;
                        return { ...prev, messages: prev.messages.map((m) => (m.id === payload.messageId ? { ...m, content: payload.content ?? m.content } : m)) };
                    });
                    debouncedFetchStats();
                    return;
                case "message_deleted":
                    setSelectedThread((prev) => (!prev || prev.id !== tid || !payload.messageId ? prev : { ...prev, messages: prev.messages.filter((m) => m.id !== payload.messageId) }));
                    debouncedFetchStats();
                    return;
                case "thread_status_updated":
                    if (payload.status) {
                        setSelectedThread((prev) => (prev?.id === tid ? { ...prev, status: payload.status as CommsThreadStatus } : prev));
                        setThreads((prev) => prev.map((t) => (t.id === tid ? { ...t, status: payload.status as CommsThreadStatus } : t)));
                    }
                    debouncedFetchStats();
                    return;
                default:
                    break;
            }
        },
        [session?.user?.id, debouncedFetchStats, selectedThread]
    );

    const getRecipientIdsForThread = useCallback(
        (threadId: string) => {
            if (selectedThread?.id !== threadId) return [];
            return selectedThread.participants
                .filter((p) => p.userId !== session?.user?.id)
                .map((p) => p.userId);
        },
        [selectedThread?.id, selectedThread?.participants, session?.user?.id]
    );

    const {
        onlineUsers,
        startTyping,
        stopTyping,
    } = useCommsRealtime({
        enabled: !!session?.user?.id,
        userId: session?.user?.id,
        onEvent: handleRealtimeEvent,
        getRecipientIdsForThread,
    });

    const handleTyping = useCallback((isTyping: boolean) => {
        if (!session?.user?.name || !selectedThread?.id) return;
        if (isTyping) startTyping(selectedThread.id, session.user.name);
        else stopTyping(selectedThread.id, session.user.name);
    }, [selectedThread?.id, session?.user?.name, startTyping, stopTyping]);

    const isRecipientOnline = useMemo(() => {
        if (!selectedThread) return false;
        return selectedThread.participants.some(
            (p) => p.userId !== session?.user?.id && onlineUsers.has(p.userId)
        );
    }, [selectedThread, session?.user?.id, onlineUsers]);

    // Initial load
    useEffect(() => {
        fetchThreads();
        fetchStats();
    }, [fetchThreads, fetchStats]);

    const handleSelectThread = useCallback(
        (thread: CommsThreadListItem) => {
            const minimalThread: CommsThreadView = { ...thread, participants: [], messages: [] };
            setSelectedThread(minimalThread);
            setIsLoadingThread(true);
            fetch(`/api/comms/threads/${thread.id}`)
                .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed"))))
                .then((data: CommsThreadView) => setSelectedThread((prev) => (prev?.id === thread.id ? data : prev)))
                .catch(() => { error("Erreur", "Impossible de charger la discussion"); setSelectedThread((prev) => (prev?.id === thread.id ? null : prev)); })
                .finally(() => setIsLoadingThread(false));
        },
        [error]
    );

    // Handle close thread panel
    const handleCloseThread = () => {
        setSelectedThread(null);
        fetchThreads(true);
    };

    const handleStatusChange = useCallback(
        async (status: CommsThreadStatus) => {
            const thread = selectedThread;
            if (!thread) return;
            setSelectedThread((prev) => (prev?.id === thread.id ? { ...prev, status } : prev));
            setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, status } : t)));
            try {
                const res = await fetch(`/api/comms/threads/${thread.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status }),
                });
                if (res.ok) {
                    success("Succès", status === "RESOLVED" ? "Discussion résolue" : "Discussion archivée");
                    void fetchStats();
                } else {
                    setSelectedThread((prev) => (prev?.id === thread.id ? { ...prev, status: thread.status } : prev));
                    setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, status: thread.status } : t)));
                    error("Erreur", "Impossible de modifier le statut");
                }
            } catch (err) {
                setSelectedThread((prev) => (prev?.id === thread.id ? { ...prev, status: thread.status } : prev));
                setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, status: thread.status } : t)));
                error("Erreur", "Impossible de modifier le statut");
            }
        },
        [selectedThread, success, error, fetchStats]
    );

    const handleSendMessage = useCallback(
        async (content: string, opts?: { mentionIds?: string[]; files?: File[] }) => {
            const thread = selectedThread;
            if (!thread || !session?.user?.id) return;
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const optimisticMsg = buildOptimisticMessage(
                tempId, content, session.user.id, session.user.name ?? "Vous", (session.user as { role?: string }).role ?? ""
            );
            optimisticMsg.threadId = thread.id;
            setSelectedThread((prev) => (prev?.id === thread.id ? { ...prev, messages: [...prev.messages, optimisticMsg] } : prev));

            try {
                const hasFiles = !!opts?.files?.length;
                const res = hasFiles
                    ? await fetch(`/api/comms/threads/${thread.id}/messages`, {
                        method: "POST",
                        body: (() => {
                            const form = new FormData();
                            form.set("content", content);
                            if (opts?.mentionIds?.length) form.set("mentionIds", JSON.stringify(opts.mentionIds));
                            opts?.files?.forEach((f) => form.append("files", f));
                            return form;
                        })(),
                    })
                    : await fetch(`/api/comms/threads/${thread.id}/messages`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content, mentionIds: opts?.mentionIds ?? [] }),
                    });
                const json = await res.json().catch(() => ({}));

                if (res.ok && json.id) {
                    setSelectedThread((prev) => {
                        if (!prev || prev.id !== thread.id) return prev;
                        return { ...prev, messages: prev.messages.map((m) => (m.id === tempId ? { ...m, id: json.id, createdAt: json.createdAt ?? new Date().toISOString(), isOptimistic: undefined } : m)) };
                    });
                    void fetchStats();
                } else {
                    setSelectedThread((prev) => (prev?.id === thread.id ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempId) } : prev));
                    error("Erreur", json?.error ?? "Impossible d'envoyer le message");
                }
            } catch (err) {
                setSelectedThread((prev) => (prev?.id === thread.id ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempId) } : prev));
                error("Erreur", "Impossible d'envoyer le message");
            }
        },
        [selectedThread?.id, session?.user, error]
    );

    // Handle create thread
    const handleCreateThread = async (request: CreateThreadRequest) => {
        try {
            const res = await fetch("/api/comms/threads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(request),
            });

            if (res.ok) {
                const { id } = await res.json();
                success("Succès", "Discussion créée");
                fetchThreads(true);
                fetchStats();
                fetchThreadDetails(id);
            } else {
                error("Erreur", "Impossible de créer la discussion");
            }
        } catch (error) {
            console.error("Error creating thread:", error);
            error("Erreur", "Impossible de créer la discussion");
        }
    };

    // Handle filter change
    const handleFilterChange = (type: CommsChannelType | "all") => {
        setFilters((prev) => ({
            ...prev,
            type: type === "all" ? undefined : type,
        }));
    };

    // Calculate stats from data
    const totalUnread = stats?.totalUnread || 0;
    const openThreads = useMemo(() => threads.filter(t => t.status === "OPEN").length, [threads]);

    // Format typing indicator text
    const getTypingText = (threadId: string) => {
        const users = typingByThread[threadId] || [];
        if (users.length === 0) return undefined;
        if (users.length === 1) return users[0];
        if (users.length === 2) return `${users[0]} et ${users[1]}`;
        return `${users[0]} et ${users.length - 1} autres`;
    };

    return (
        <div className="flex flex-col min-h-[calc(100vh-8rem)] pb-10 bg-slate-100 dark:bg-slate-900">
            {!focusMode && (
            <>
            <div className="shrink-0 space-y-4">
                <CommsPageHeader
                title="Communications"
                subtitle="Discussions avec l'équipe et les missions"
                slimTitle="Communications — Messages"
                icon={<MessageSquare className="w-6 h-6 text-white" />}
                collapsible={true}
                actions={
                    <>
                        <button
                            onClick={() => fetchThreads(true)}
                            disabled={isRefreshing}
                            className={cn(
                                "p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
                            )}
                            title="Actualiser"
                        >
                            <RefreshCw className={cn("w-4 h-4 text-slate-500", isRefreshing && "animate-spin")} />
                        </button>
                        <button
                            onClick={() => setShowSearchPanel(true)}
                            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                            title="Recherche avancée"
                        >
                            <Search className="w-4 h-4 text-slate-500" />
                        </button>
                        <Button
                            onClick={() => setShowNewThreadModal(true)}
                            className="h-9 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-sm font-medium shadow-lg shadow-indigo-500/25"
                        >
                            <Plus className="w-4 h-4 mr-1.5" />
                            Nouveau message
                        </Button>
                    </>
                }
            />
            </div>

            {/* Stats Cards */}
            <div className="shrink-0 grid grid-cols-4 gap-5 mt-4">
                <StatCard
                    icon={Inbox}
                    label="Non lus"
                    value={totalUnread}
                    subValue="messages"
                    color="indigo"
                />
                <StatCard
                    icon={MessageSquare}
                    label="Discussions ouvertes"
                    value={openThreads}
                    subValue="en cours"
                    color="emerald"
                />
                <StatCard
                    icon={MessageCircle}
                    label="Directs"
                    value={stats?.unreadByType?.DIRECT || 0}
                    subValue="non lus"
                    color="blue"
                />
                <StatCard
                    icon={Target}
                    label="Missions"
                    value={stats?.unreadByType?.MISSION || 0}
                    subValue="non lus"
                    color="amber"
                />
            </div>
            </>
            )}

            {/* Main Content - stretches to fill; when focusMode, list hidden and chat full width */}
            <div className={cn("flex-1 min-h-0 flex flex-col", focusMode ? "mt-0" : "mt-4")}>
            <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Thread List Panel - hidden in focus mode */}
                <div className={cn(
                    "transition-all duration-300 flex flex-col min-h-0",
                    focusMode ? "hidden" : isListCollapsed ? "col-span-1" : "col-span-4"
                )}>
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1 min-h-0 flex flex-col">
                        {/* List Header */}
                        <div className={cn(
                            "border-b border-slate-200 p-4",
                            isListCollapsed && "p-2 flex items-center justify-center"
                        )}>
                            {!isListCollapsed ? (
                                <>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <h2 className="font-semibold text-slate-900">Messages</h2>
                                            {totalUnread > 0 && (
                                                <span className="px-2 py-0.5 text-xs font-medium text-white bg-indigo-500 rounded-full">
                                                    {totalUnread}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setIsListCollapsed(true)}
                                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                            title="Réduire le panneau"
                                        >
                                            <PanelLeftClose className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Search */}
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Rechercher..."
                                            className="pl-9 h-9 text-sm bg-slate-50 border-slate-200 focus:bg-white"
                                        />
                                    </div>

                                    {/* Filter Pills */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {FILTER_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.type}
                                                onClick={() => handleFilterChange(opt.type)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                                                    (filters.type === opt.type || (opt.type === "all" && !filters.type))
                                                        ? "bg-indigo-100 text-indigo-700 shadow-sm"
                                                        : "text-slate-600 hover:bg-slate-100"
                                                )}
                                            >
                                                <opt.icon className="w-3.5 h-3.5" />
                                                {opt.label}
                                                {stats && opt.type !== "all" && stats.unreadByType[opt.type as CommsChannelType] > 0 && (
                                                    <span className="px-1.5 py-0.5 text-[10px] bg-indigo-500 text-white rounded-full">
                                                        {stats.unreadByType[opt.type as CommsChannelType]}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Active filter indicator */}
                                    {(filters.type || debouncedSearchQuery) && (
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="text-xs text-slate-500">
                                                {threads.length} résultat{threads.length !== 1 ? "s" : ""}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setFilters({});
                                                    setSearchQuery("");
                                                }}
                                                className="text-xs text-indigo-600 hover:text-indigo-700"
                                            >
                                                Effacer les filtres
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <button
                                        onClick={() => setIsListCollapsed(false)}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Développer le panneau"
                                    >
                                        <PanelLeft className="w-5 h-5" />
                                    </button>
                                    {totalUnread > 0 && (
                                        <span className="px-2 py-0.5 text-xs font-medium text-white bg-indigo-500 rounded-full">
                                            {totalUnread}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Thread List */}
                        <div className={cn(
                            "flex-1 overflow-y-auto",
                            isListCollapsed && "hidden"
                        )}>
                            {isLoading ? (
                                <div className="space-y-2 p-4">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div
                                            key={i}
                                            className="animate-pulse bg-slate-100 rounded-xl h-20"
                                        />
                                    ))}
                                </div>
                            ) : threads.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full py-12">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                                        <MessageSquare className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                        {debouncedSearchQuery || filters.type ? "Aucun résultat" : "Aucune discussion"}
                                    </h3>
                                    <p className="text-sm text-slate-500 text-center max-w-xs">
                                        {debouncedSearchQuery || filters.type
                                            ? "Essayez de modifier vos filtres"
                                            : "Envoyez un premier message pour commencer"
                                        }
                                    </p>
                                </div>
                            ) : (
                                <ThreadList
                                    threads={threads}
                                    selectedId={selectedThread?.id}
                                    onSelect={handleSelectThread}
                                    currentUserId={session?.user?.id}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Thread View Panel - full width in focus mode */}
                <div className={cn(
                    "transition-all duration-300 flex flex-col min-h-0",
                    focusMode ? "col-span-12" : isListCollapsed ? "col-span-11" : "col-span-8"
                )}>
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1 min-h-0 flex flex-col">
                        {isLoadingThread ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                                    <p className="text-sm text-slate-500">Chargement...</p>
                                </div>
                            </div>
                        ) : selectedThread ? (
                            <ThreadView
                                thread={selectedThread}
                                onClose={handleCloseThread}
                                onStatusChange={handleStatusChange}
                                onSendMessage={handleSendMessage}
                                onReactionToggle={() => selectedThread && fetchThreadDetails(selectedThread.id)}
                                currentUserId={session?.user?.id || ""}
                                typingUserName={getTypingText(selectedThread.id)}
                                focusMode={focusMode}
                                onFocusModeChange={setFocusMode}
                                isRecipientOnline={isRecipientOnline}
                                onTyping={handleTyping}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center mx-auto mb-5">
                                        <Mail className="w-10 h-10 text-indigo-500" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                                        Sélectionnez une discussion
                                    </h3>
                                    <p className="text-sm text-slate-500 max-w-sm">
                                        Choisissez une conversation dans la liste pour commencer
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            </div>

            {/* New thread modal */}
            <NewThreadModal
                isOpen={showNewThreadModal}
                onClose={() => setShowNewThreadModal(false)}
                onSubmit={handleCreateThread}
                userRole={session?.user?.role || ""}
            />

            {/* Search panel */}
            <SearchPanel
                isOpen={showSearchPanel}
                onClose={() => setShowSearchPanel(false)}
                onResultClick={(threadId) => {
                    fetchThreadDetails(threadId);
                    setShowSearchPanel(false);
                }}
            />
        </div>
    );
}
