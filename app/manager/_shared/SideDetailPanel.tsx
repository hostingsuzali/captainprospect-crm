"use client";

import { useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SideDetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    fullPageHref?: string;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
    /** Offset from top matching the sticky header height (in px). Default 0. */
    topOffset?: number;
    /** Width on lg+ breakpoint in px. Default 420. */
    widthPx?: number;
}

export function SideDetailPanel({
    isOpen,
    onClose,
    title,
    subtitle,
    fullPageHref,
    headerRight,
    children,
    topOffset = 0,
    widthPx = 420,
}: SideDetailPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                const target = document.activeElement as HTMLElement | null;
                if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
                if (target?.isContentEditable) return;
                onClose();
            }
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);

    return (
        <>
            {/* Overlay only on mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-30 lg:hidden"
                    aria-hidden="true"
                    onClick={onClose}
                />
            )}

            <aside
                ref={panelRef}
                role="complementary"
                aria-hidden={!isOpen}
                className={cn(
                    "fixed lg:absolute right-0 bottom-0 lg:bottom-auto bg-white border-l border-slate-200 shadow-xl lg:shadow-lg z-40",
                    "flex flex-col",
                    "transform transition-transform duration-200 ease-out",
                    "h-[85vh] lg:h-auto lg:min-h-[calc(100vh-var(--panel-top,0px))]",
                    "rounded-t-2xl lg:rounded-none",
                    "w-full",
                    isOpen ? "translate-y-0 lg:translate-x-0" : "translate-y-full lg:translate-y-0 lg:translate-x-full pointer-events-none"
                )}
                style={{
                    top: `var(--panel-top, ${topOffset}px)`,
                    width: `min(100%, ${widthPx}px)`,
                    ["--panel-top" as string]: `${topOffset}px`,
                }}
            >
                <header className="sticky top-0 bg-white border-b border-slate-200 z-10">
                    <div className="flex items-start justify-between gap-3 px-5 py-4">
                        <div className="flex-1 min-w-0">
                            {title && (
                                <div className="text-base font-semibold text-slate-900 truncate">
                                    {title}
                                </div>
                            )}
                            {subtitle && (
                                <div className="text-xs text-slate-500 mt-0.5 truncate">
                                    {subtitle}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {headerRight}
                            {fullPageHref && (
                                <Link
                                    href={fullPageHref}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                                    title="Ouvrir en pleine page"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </Link>
                            )}
                            <button
                                onClick={onClose}
                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                                aria-label="Fermer le panneau"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto">{children}</div>
            </aside>
        </>
    );
}

export default SideDetailPanel;
