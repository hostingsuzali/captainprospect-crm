"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
    message?: string;
    className?: string;
    size?: "sm" | "md" | "lg";
}

export function LoadingState({
    message = "Chargement...",
    className,
    size = "md",
}: LoadingStateProps) {
    const sizes = {
        sm: "w-5 h-5",
        md: "w-8 h-8",
        lg: "w-12 h-12",
    };

    return (
        <div className={cn(
            "flex items-center justify-center py-20",
            className
        )}>
            <div className="flex flex-col items-center gap-3">
                <Loader2 className={cn(
                    "text-indigo-500 animate-spin",
                    sizes[size]
                )} />
                <p className="text-sm text-slate-500">{message}</p>
            </div>
        </div>
    );
}

export default LoadingState;
