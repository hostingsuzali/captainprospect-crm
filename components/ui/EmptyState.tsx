"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
    variant?: "card" | "inline";
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
    variant = "card",
}: EmptyStateProps) {
    if (variant === "inline") {
        return (
            <div className={cn("text-center py-12", className)}>
                <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">{title}</p>
                {description && (
                    <p className="text-xs text-slate-400 mt-1">{description}</p>
                )}
                {action && <div className="mt-4">{action}</div>}
            </div>
        );
    }

    return (
        <div className={cn(
            "text-center py-16 bg-white rounded-2xl border border-slate-200",
            className
        )}>
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Icon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                    {description}
                </p>
            )}
            {action}
        </div>
    );
}

export default EmptyState;
