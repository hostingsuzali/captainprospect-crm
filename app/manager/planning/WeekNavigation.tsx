"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";

interface WeekNavigationProps {
    weekStart: Date;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
}

export function WeekNavigation({ weekStart, onPrev, onNext, onToday }: WeekNavigationProps) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 4);

    const formatRange = () => {
        const start = weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        const end = weekEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
        return `${start} – ${end}`;
    };

    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                    <button
                        type="button"
                        onClick={onPrev}
                        className="p-2 hover:bg-slate-50 border-r border-slate-200 text-slate-600"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={onNext}
                        className="p-2 hover:bg-slate-50 text-slate-600"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    <span className="font-semibold text-slate-900">{formatRange()}</span>
                </div>
            </div>
            <Button variant="secondary" size="sm" onClick={onToday}>
                Aujourd&apos;hui
            </Button>
        </div>
    );
}
