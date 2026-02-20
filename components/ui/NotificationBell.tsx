"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, Info, AlertTriangle, XCircle, CheckCircle2, ChevronRight, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface Notification {
    id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    link: string | null;
    isRead: boolean;
    createdAt: string;
}

export function NotificationBell() {
    const { data: session } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Get the correct notifications page based on user role
    const getNotificationsPageUrl = () => {
        const role = session?.user?.role;
        if (role === "CLIENT") {
            return "/client/portal/notifications";
        }
        if (role === "SDR" || role === "BUSINESS_DEVELOPER") {
            return "/sdr/notifications";
        } else if (role === "MANAGER") {
            return "/manager/notifications";
        } else if (role === "DEVELOPER") {
            return "/developer/notifications";
        }
        return "/sdr/notifications"; // Default fallback
    };

    useEffect(() => {
        loadNotifications();
        // Poll every minute
        const interval = setInterval(loadNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadNotifications = async () => {
        try {
            const res = await fetch("/api/notifications");
            const json = await res.json();
            if (json.success) {
                setNotifications(json.data.notifications);
                setUnreadCount(json.data.unreadCount);
            }
        } catch (error) {
            console.error("Failed to load notifications", error);
        }
    };

    const markAsRead = async (id: string, link: string | null) => {
        try {
            await fetch(`/api/notifications/${id}`, { method: "PATCH" });

            // Optimistic update
            setNotifications(notifications.map(n =>
                n.id === id ? { ...n, isRead: true } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));

            if (link) {
                setIsOpen(false);
                router.push(link);
            }
        } catch (error) {
            console.error("Failed to mark as read", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch("/api/notifications", { method: "PATCH" });

            setNotifications(notifications.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error("Failed to mark all as read", error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "À l'instant";
        if (diffMins < 60) return `${diffMins}min`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}j`;
        return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    };

    const getIcon = (type: string) => {
        switch (type) {
            case "success": return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case "warning": return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            case "error": return <XCircle className="w-5 h-5 text-red-500" />;
            default: return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    const displayNotifications = notifications.slice(0, 5);

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "relative w-8 h-8 rounded-lg border border-[#E8EBF0] flex items-center justify-center transition-colors duration-150",
                    isOpen
                        ? "bg-[#EEF2FF] text-[#7C5CFC] border-[#C7D2FE]"
                        : "text-[#8B8BA7] hover:text-[#12122A] hover:border-[#C5C8D4]"
                )}
            >
                <Bell className="w-3.5 h-3.5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#EF4444] rounded-full" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                                    {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                                <Check className="w-3 h-3" />
                                Tout lire
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                    <Bell className="w-7 h-7 text-slate-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-700 mb-1">Aucune notification</p>
                                <p className="text-xs text-slate-500">Vous êtes à jour !</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {displayNotifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        onClick={() => markAsRead(notification.id, notification.link)}
                                        className={cn(
                                            "p-4 hover:bg-slate-50 transition-colors cursor-pointer group",
                                            !notification.isRead && "bg-gradient-to-r from-indigo-50/50 to-white"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                                                notification.type === "success" && "bg-emerald-50",
                                                notification.type === "warning" && "bg-amber-50",
                                                notification.type === "error" && "bg-red-50",
                                                notification.type === "info" && "bg-blue-50"
                                            )}>
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                    "text-sm line-clamp-1",
                                                    !notification.isRead ? "font-semibold text-slate-900" : "font-medium text-slate-700"
                                                )}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1.5">
                                                    {formatDate(notification.createdAt)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {!notification.isRead && (
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                                )}
                                                {notification.link && (
                                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <Link
                            href={getNotificationsPageUrl()}
                            onClick={() => setIsOpen(false)}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                        >
                            Voir toutes les notifications
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

