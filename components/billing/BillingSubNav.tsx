"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    FileText,
    Users,
    Tag,
    CalendarDays,
    Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
    { href: "/manager/billing", label: "Accueil", icon: LayoutDashboard, exact: true },
    { href: "/manager/billing/invoices", label: "Factures", icon: FileText, exact: false },
    { href: "/manager/billing/clients", label: "Clients", icon: Users, exact: false },
    { href: "/manager/billing/offres", label: "Offres & Tarifs", icon: Tag, exact: false },
    { href: "/manager/billing/engagements", label: "Engagements", icon: CalendarDays, exact: false },
    { href: "/manager/billing/settings", label: "Paramètres", icon: Settings, exact: false },
];

export function BillingSubNav() {
    const pathname = usePathname();

    return (
        <nav className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto">
            {ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                            isActive
                                ? "bg-white text-indigo-700 shadow-sm border border-slate-200/80"
                                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                        )}
                    >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
