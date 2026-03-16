"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    Zap,
    Inbox,
    BarChart3,
    Send,
    Plus,
    Mail,
} from "lucide-react";

// ============================================
// EMAIL HUB LAYOUT — Unified Tab Navigation
// Wraps all /manager/emails/* and /sdr/emails/* pages
// ============================================

interface EmailHubTab {
    id: string;
    label: string;
    href: string;
    icon: React.ReactNode;
    badge?: number;
}

interface EmailHubLayoutProps {
    children: React.ReactNode;
    variant?: "manager" | "sdr";
}

const MANAGER_TABS: EmailHubTab[] = [
    {
        id: "dashboard",
        label: "Dashboard",
        href: "/manager/emails",
        icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
        id: "sent",
        label: "Emails envoyés",
        href: "/manager/emails/sent",
        icon: <Send className="w-4 h-4" />,
    },
    {
        id: "contacts",
        label: "Contacts",
        href: "/manager/emails/contacts",
        icon: <Users className="w-4 h-4" />,
    },
    {
        id: "sequences",
        label: "Séquences",
        href: "/manager/emails/sequences",
        icon: <Zap className="w-4 h-4" />,
    },
    {
        id: "mailboxes",
        label: "Boîtes mail",
        href: "/manager/emails/mailboxes",
        icon: <Inbox className="w-4 h-4" />,
    },
    {
        id: "analytics",
        label: "Analytics",
        href: "/manager/emails/analytics",
        icon: <BarChart3 className="w-4 h-4" />,
    },
];

const SDR_TABS: EmailHubTab[] = [
    {
        id: "sends",
        label: "Mes envois",
        href: "/sdr/emails",
        icon: <Send className="w-4 h-4" />,
    },
    {
        id: "sequences",
        label: "Séquences",
        href: "/sdr/emails/sequences",
        icon: <Zap className="w-4 h-4" />,
    },
    {
        id: "templates",
        label: "Templates",
        href: "/sdr/emails/templates",
        icon: <Mail className="w-4 h-4" />,
    },
];

function getActiveTab(pathname: string, tabs: EmailHubTab[]): string {
    // Exact match first
    const exact = tabs.find((t) => t.href === pathname);
    if (exact) return exact.id;

    // Prefix match (longest first)
    const sorted = [...tabs].sort((a, b) => b.href.length - a.href.length);
    const prefix = sorted.find((t) => pathname.startsWith(t.href + "/"));
    if (prefix) return prefix.id;

    return tabs[0]?.id || "";
}

export function EmailHubLayout({ children, variant = "manager" }: EmailHubLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const tabs = variant === "manager" ? MANAGER_TABS : SDR_TABS;
    const activeTab = getActiveTab(pathname, tabs);

    return (
        <div className="flex flex-col h-full">
            {/* ── Header ── */}
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                <div className="px-6 pt-5 pb-0">
                    {/* Title row */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200/50">
                                <Mail className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">
                                    Email Hub
                                </h1>
                                <p className="text-xs text-slate-500">
                                    {variant === "manager"
                                        ? "Gérez vos campagnes, séquences et boîtes mail"
                                        : "Vos emails et séquences"}
                                </p>
                            </div>
                        </div>

                        {/* Quick compose button */}
                        <button
                            onClick={() => {
                                // Navigate to compose or open modal
                                if (variant === "manager") {
                                    router.push("/manager/emails/contacts");
                                }
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-500 hover:to-violet-500 transition-all duration-200 shadow-md shadow-indigo-200/50 hover:shadow-lg hover:shadow-indigo-300/50"
                        >
                            <Plus className="w-4 h-4" />
                            Nouvel envoi
                        </button>
                    </div>

                    {/* Tab navigation */}
                    <div className="flex gap-1">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => router.push(tab.href)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-all duration-200",
                                        isActive
                                            ? "text-indigo-600 border-indigo-600 bg-indigo-50/50"
                                            : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    {tab.icon}
                                    {tab.label}
                                    {tab.badge !== undefined && tab.badge > 0 && (
                                        <span
                                            className={cn(
                                                "ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full min-w-[18px] text-center",
                                                isActive
                                                    ? "bg-indigo-100 text-indigo-700"
                                                    : "bg-slate-200 text-slate-600"
                                            )}
                                        >
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Page content ── */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50">
                {children}
            </div>
        </div>
    );
}

export default EmailHubLayout;
