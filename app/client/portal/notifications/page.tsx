"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Bell,
    Check,
    CheckCheck,
    Info,
    AlertTriangle,
    XCircle,
    CheckCircle2,
    RefreshCw,
    Inbox,
    Clock,
    ChevronRight,
    Loader2,
    ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

// ============================================
// TYPES
// ============================================

interface Notification {
    id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    link: string | null;
    isRead: boolean;
    createdAt: string;
}

type FilterType = "all" | "unread";

// ============================================
// NOTIFICATION CARD
// ============================================

function NotificationCard({
    notification,
    onMarkRead,
    onNavigate,
}: {
    notification: Notification;
    onMarkRead: (id: string) => void;
    onNavigate: (link: string) => void;
}) {
    const typeConfig = {
        success: {
            icon: CheckCircle2,
            color: "text-emerald-500",
            bg: "bg-emerald-50",
        },
        warning: {
            icon: AlertTriangle,
            color: "text-amber-500",
            bg: "bg-amber-50",
        },
        error: {
            icon: XCircle,
            color: "text-red-500",
            bg: "bg-red-50",
        },
        info: {
            icon: Info,
            color: "text-blue-500",
            bg: "bg-blue-50",
        },
    };

    const config = typeConfig[notification.type];
    const Icon = config.icon;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "À l'instant";
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        if (diffDays < 7) return `Il y a ${diffDays}j`;
        return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    };

    return (
        <div
            className={cn(
                "group relative bg-white rounded-xl border transition-all duration-200 hover:shadow-md",
                notification.isRead
                    ? "border-slate-200"
                    : "border-slate-300 bg-gradient-to-r from-indigo-50/50 to-white"
            )}
        >
            <div className="flex items-start gap-4 p-4">
                <div
                    className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        config.bg
                    )}
                >
                    <Icon className={cn("w-5 h-5", config.color)} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h3
                                className={cn(
                                    "text-sm font-semibold truncate",
                                    notification.isRead ? "text-slate-700" : "text-slate-900"
                                )}
                            >
                                {notification.title}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                                {notification.message}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(notification.createdAt)}
                                </span>
                                {!notification.isRead && (
                                    <span className="px-2 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700 rounded-full">
                                        Nouveau
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notification.isRead && (
                                <button
                                    onClick={() => onMarkRead(notification.id)}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Marquer comme lu"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                            )}
                            {notification.link && (
                                <button
                                    onClick={() => onNavigate(notification.link!)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Voir"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {!notification.isRead && (
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0 mt-1" />
                )}
            </div>
        </div>
    );
}

// ============================================
// MAIN PAGE
// ============================================

export default function ClientPortalNotificationsPage() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterType>("all");

    const loadNotifications = useCallback(async (refresh = false) => {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const res = await fetch("/api/notifications");
            const json = await res.json();
            if (json.success) {
                setNotifications(json.data.notifications);
            }
        } catch (error) {
            console.error("Failed to load notifications", error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    const filteredNotifications = useMemo(() => {
        if (filter === "unread") return notifications.filter((n) => !n.isRead);
        return notifications;
    }, [notifications, filter]);

    const unreadCount = useMemo(
        () => notifications.filter((n) => !n.isRead).length,
        [notifications]
    );

    const markAsRead = async (id: string) => {
        try {
            await fetch(`/api/notifications/${id}`, { method: "PATCH" });
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
            );
        } catch (error) {
            console.error("Failed to mark as read", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch("/api/notifications", { method: "PATCH" });
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        } catch (error) {
            console.error("Failed to mark all as read", error);
        }
    };

    const navigateTo = (link: string) => {
        router.push(link);
    };

    return (
        <div className="min-h-full bg-[#F4F6F9] p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-bold text-[#12122A] tracking-tight">
                        Notifications
                    </h1>
                    <p className="text-[13px] text-[#8B8BA7] mt-0.5">
                        Alertes et actualités de vos missions
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/client/portal">
                        <Button variant="outline" size="sm" className="gap-2">
                            <ArrowRight className="w-4 h-4 rotate-180" />
                            Retour au tableau de bord
                        </Button>
                    </Link>
                    <button
                        onClick={() => loadNotifications(true)}
                        className={cn(
                            "w-8 h-8 rounded-lg border border-[#E8EBF0] flex items-center justify-center text-[#8B8BA7] hover:text-[#12122A] hover:border-[#C5C8D4] transition-colors duration-150 bg-white",
                            isRefreshing && "animate-spin"
                        )}
                        title="Actualiser"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    {unreadCount > 0 && (
                        <Button
                            onClick={markAllAsRead}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                        >
                            <CheckCheck className="w-4 h-4" />
                            Tout marquer comme lu
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => setFilter("all")}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        filter === "all"
                            ? "bg-[#EEF2FF] text-[#7C5CFC]"
                            : "text-[#8B8BA7] hover:bg-white hover:border border-transparent border-[#E8EBF0]"
                    )}
                >
                    <Bell className="w-3.5 h-3.5" />
                    Toutes
                </button>
                <button
                    onClick={() => setFilter("unread")}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        filter === "unread"
                            ? "bg-[#EEF2FF] text-[#7C5CFC]"
                            : "text-[#8B8BA7] hover:bg-white hover:border border-transparent border-[#E8EBF0]"
                    )}
                >
                    <Inbox className="w-3.5 h-3.5" />
                    Non lues
                    {unreadCount > 0 && (
                        <span className="ml-0.5 px-1.5 py-0.5 text-xs font-medium bg-[#7C5CFC] text-white rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8EBF0] overflow-hidden">
                <div className="p-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-[#7C5CFC] animate-spin mb-3" />
                            <p className="text-sm text-[#8B8BA7]">
                                Chargement des notifications...
                            </p>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-16 h-16 rounded-2xl bg-[#F4F6F9] flex items-center justify-center mb-4">
                                <Bell className="w-8 h-8 text-[#8B8BA7]" />
                            </div>
                            <h3 className="text-lg font-semibold text-[#12122A] mb-2">
                                {filter === "unread"
                                    ? "Aucune notification non lue"
                                    : "Aucune notification"}
                            </h3>
                            <p className="text-sm text-[#8B8BA7] text-center max-w-sm">
                                {filter === "unread"
                                    ? "Vous avez tout lu."
                                    : "Les alertes (nouveau RDV, opportunité, message, fichier) apparaîtront ici."}
                            </p>
                            <Link href="/client/portal" className="mt-4">
                                <Button variant="primary" size="sm">
                                    Retour à l&apos;accueil
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredNotifications.map((notification) => (
                                <NotificationCard
                                    key={notification.id}
                                    notification={notification}
                                    onMarkRead={markAsRead}
                                    onNavigate={navigateTo}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
