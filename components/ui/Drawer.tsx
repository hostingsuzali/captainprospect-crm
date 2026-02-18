"use client";

import { useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// DRAWER COMPONENT
// ============================================

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl" | "full";
    side?: "right" | "left";
    showCloseButton?: boolean;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
    className?: string;
    footer?: React.ReactNode;
}

const SIZES = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[95vw]",
};

export function Drawer({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = "lg",
    side = "right",
    showCloseButton = true,
    closeOnOverlay = true,
    closeOnEscape = true,
    className,
    footer,
}: DrawerProps) {
    const drawerRef = useRef<HTMLDivElement>(null);

    // Handle ESC key
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape" && closeOnEscape) {
                onClose();
            }
        },
        [closeOnEscape, onClose]
    );

    // Lock body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            document.addEventListener("keydown", handleKeyDown);
        } else {
            document.body.style.overflow = "";
        }

        return () => {
            document.body.style.overflow = "";
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, handleKeyDown]);

    // Focus trap
    useEffect(() => {
        if (isOpen && drawerRef.current) {
            drawerRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleOverlayClickClose = () => {
        if (closeOnOverlay) onClose();
    };

    return (
        <div className="fixed inset-0 z-40 flex">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in cursor-pointer transition-opacity duration-300"
                onClick={handleOverlayClickClose}
                aria-hidden="true"
            />

            {/* Drawer panel */}
            <div
                ref={drawerRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                className={cn(
                    "fixed top-0 bottom-0 w-full flex flex-col bg-white shadow-2xl shadow-black/10 z-[41]",
                    side === "right"
                        ? "right-0 animate-slide-in-right"
                        : "left-0 animate-slide-in-left",
                    SIZES[size],
                    className
                )}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                        <div className="flex-1 min-w-0 pr-4">
                            {title && (
                                <h2 className="text-lg font-bold text-slate-900 truncate leading-tight">
                                    {title}
                                </h2>
                            )}
                            {description && (
                                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                    {description}
                                </p>
                            )}
                        </div>
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="p-2 -m-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-150 flex-shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 drawer-scrollbar">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="px-6 py-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================
// DRAWER SECTION (for organizing content)
// ============================================

interface DrawerSectionProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
}

export function DrawerSection({ title, children, className }: DrawerSectionProps) {
    return (
        <div className={cn("space-y-4", className)}>
            {title && (
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
}

// ============================================
// DRAWER FIELD (for displaying info)
// ============================================

interface DrawerFieldProps {
    label: string;
    value: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
}

export function DrawerField({ label, value, icon, className }: DrawerFieldProps) {
    return (
        <div className={cn("flex items-start gap-3", className)}>
            {icon && (
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    {icon}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <div className="text-slate-900 mt-0.5">
                    {value || <span className="text-slate-400 italic">Non renseigné</span>}
                </div>
            </div>
        </div>
    );
}

export default Drawer;
