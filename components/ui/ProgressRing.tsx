"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
    value: number;
    max: number;
    size?: number;
    strokeWidth?: number;
    className?: string;
    showValue?: boolean;
    variant?: "default" | "glow";
}

export function ProgressRing({
    value,
    max,
    size = 120,
    strokeWidth = 10,
    className,
    showValue = false,
    variant = "glow",
}: ProgressRingProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(t);
    }, []);

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = max > 0 ? Math.min(value / max, 1) : 0;
    const offset = circumference * (1 - (mounted ? pct : 0));
    const gradientId = `progressGradient-${size}`;
    const glowId = `progressGlow-${size}`;

    return (
        <div className={cn("relative inline-flex items-center justify-center", className)}>
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
                aria-label={`${value} sur ${max}`}
                role="img"
            >
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6C3AFF" />
                        <stop offset="50%" stopColor="#7C5CFC" />
                        <stop offset="100%" stopColor="#B794F6" />
                    </linearGradient>
                    {variant === "glow" && (
                        <filter id={glowId}>
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    )}
                </defs>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#E8EBF0"
                    strokeWidth={strokeWidth}
                    opacity={0.6}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    filter={variant === "glow" ? `url(#${glowId})` : undefined}
                    style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)" }}
                />
            </svg>
            {showValue && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-[#12122A] tabular-nums">{value}</span>
                    <span className="text-[10px] text-[#6B7194] -mt-0.5">sur {max}</span>
                </div>
            )}
        </div>
    );
}

export default ProgressRing;
