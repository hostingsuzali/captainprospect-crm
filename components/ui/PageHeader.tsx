"use client";

import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    actions?: ReactNode;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    className?: string;
    variant?: "default" | "hero";
}

export function PageHeader({
    title,
    subtitle,
    icon,
    actions,
    onRefresh,
    isRefreshing = false,
    className,
    variant = "default",
}: PageHeaderProps) {
    if (variant === "hero") {
        return (
            <div className={cn(
                "relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 text-white",
                className
            )}>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-50" />
                <div className="relative z-10">
                    {icon && (
                        <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-2">
                            {icon}
                        </div>
                    )}
                    <h1 className="text-3xl font-bold mb-2">{title}</h1>
                    {subtitle && (
                        <p className="text-slate-400 max-w-xl">{subtitle}</p>
                    )}
                    {actions && (
                        <div className="mt-6 flex items-center gap-3">{actions}</div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex items-center justify-between", className)}>
            <div>
                <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                {subtitle && (
                    <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
                )}
            </div>
            <div className="flex items-center gap-3">
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw className={cn(
                            "w-4 h-4 text-slate-500",
                            isRefreshing && "animate-spin"
                        )} />
                    </button>
                )}
                {actions}
            </div>
        </div>
    );
}

export default PageHeader;
