"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { HTMLAttributes, ReactNode } from "react";

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
    label: string;
    value: string | number;
    icon: LucideIcon;
    iconBg?: string;
    iconColor?: string;
    subtitle?: ReactNode;
    className?: string;
    trend?: {
        value: string;
        isPositive: boolean;
    };
}

export function StatCard({
    label,
    value,
    icon: Icon,
    iconBg = "bg-indigo-100",
    iconColor = "text-indigo-600",
    subtitle,
    className,
    trend,
    ...props
}: StatCardProps) {
    return (
        <div
            className={cn(
                "bg-white border border-slate-200 rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:border-slate-300",
                className
            )}
            {...props}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-slate-500 font-medium">{label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
                    {subtitle && (
                        <div className="mt-2 text-sm">{subtitle}</div>
                    )}
                    {trend && (
                        <div className={cn(
                            "flex items-center gap-1.5 mt-2 text-sm",
                            trend.isPositive ? "text-emerald-600" : "text-red-600"
                        )}>
                            <span>{trend.isPositive ? "↑" : "↓"}</span>
                            <span>{trend.value}</span>
                        </div>
                    )}
                </div>
                <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    iconBg
                )}>
                    <Icon className={cn("w-6 h-6", iconColor)} />
                </div>
            </div>
        </div>
    );
}

export default StatCard;
