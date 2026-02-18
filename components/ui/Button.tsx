"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = "primary",
            size = "md",
            isLoading = false,
            disabled,
            children,
            ...props
        },
        ref
    ) => {
        const baseStyles =
            "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed";

        const variants = {
            primary:
                "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white hover:from-indigo-400 hover:to-indigo-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/30",
            secondary:
                "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400",
            success:
                "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30",
            danger:
                "bg-gradient-to-br from-red-500 to-red-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-500/30",
            ghost: "bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100",
        };

        const sizes = {
            sm: "px-3 py-2 text-sm",
            md: "px-4 py-2.5 text-sm",
            lg: "px-6 py-3 text-base",
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && (
                    <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                )}
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";

export default Button;
