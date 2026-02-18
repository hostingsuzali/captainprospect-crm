"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface Tab {
    id: string;
    label: string;
    icon?: ReactNode;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    className?: string;
    variant?: "underline" | "pills";
}

export function Tabs({
    tabs,
    activeTab,
    onTabChange,
    className,
    variant = "underline",
}: TabsProps) {
    if (variant === "pills") {
        return (
            <div className={cn(
                "flex bg-slate-100 border border-slate-200 rounded-xl p-1",
                className
            )}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                            activeTab === tab.id
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-600 hover:text-slate-900"
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className={cn("flex border-b border-slate-200", className)}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                        activeTab === tab.id
                            ? "text-indigo-600 border-indigo-600"
                            : "text-slate-500 border-transparent hover:text-slate-700"
                    )}
                >
                    {tab.icon}
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export default Tabs;
