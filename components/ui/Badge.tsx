import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";
import type { CompletenessStatus } from "@/lib/types";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: "default" | "primary" | "success" | "warning" | "danger" | "outline";
    status?: CompletenessStatus;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = "default", status, children, ...props }, ref) => {
        // If status is provided, use status-based styling
        const statusVariants: Record<CompletenessStatus, string> = {
            INCOMPLETE: "bg-red-50 text-red-700 border-red-200",
            PARTIAL: "bg-amber-50 text-amber-700 border-amber-200",
            ACTIONABLE: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };

        const variants = {
            default: "bg-slate-100 text-slate-700 border-slate-200",
            primary: "bg-indigo-50 text-indigo-700 border-indigo-200",
            success: "bg-emerald-50 text-emerald-700 border-emerald-200",
            warning: "bg-amber-50 text-amber-700 border-amber-200",
            danger: "bg-red-50 text-red-700 border-red-200",
            outline: "bg-transparent text-slate-600 border-slate-300",
        };

        const variantStyle = status ? statusVariants[status] : variants[variant];

        return (
            <span
                ref={ref}
                className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border",
                    variantStyle,
                    className
                )}
                {...props}
            >
                {status && (
                    <span
                        className={cn("w-1.5 h-1.5 rounded-full", {
                            "bg-red-400": status === "INCOMPLETE",
                            "bg-amber-400": status === "PARTIAL",
                            "bg-emerald-400": status === "ACTIONABLE",
                        })}
                    />
                )}
                {children}
            </span>
        );
    }
);

Badge.displayName = "Badge";

export default Badge;
