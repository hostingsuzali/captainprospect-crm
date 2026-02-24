"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
    value: number;
    max: number;
    className?: string;
    showLabel?: boolean;
    height?: "sm" | "md" | "lg";
    variant?: "default" | "shimmer";
}

export function ProgressBar({
    value,
    max,
    className,
    showLabel = false,
    height = "md",
    variant = "shimmer",
}: ProgressBarProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(t);
    }, []);

    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const heightClass = height === "sm" ? "h-1.5" : height === "lg" ? "h-4" : "h-2.5";

    return (
        <div className={cn("w-full", className)}>
            <div className={cn(heightClass, "w-full bg-[#E8EBF0]/60 rounded-full overflow-hidden backdrop-blur-sm")}>
                <div
                    className={cn(
                        "h-full rounded-full relative",
                        "bg-gradient-to-r from-[#6C3AFF] via-[#7C5CFC] to-[#A78BFA]",
                        variant === "shimmer" && mounted && "progress-shimmer"
                    )}
                    style={{
                        width: mounted ? `${pct}%` : "0%",
                        transition: "width 900ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                />
            </div>
            {showLabel && (
                <div className="flex justify-between mt-1.5 text-xs text-[#6B7194]">
                    <span>{value}</span>
                    <span>{max}</span>
                </div>
            )}
        </div>
    );
}

export default ProgressBar;
