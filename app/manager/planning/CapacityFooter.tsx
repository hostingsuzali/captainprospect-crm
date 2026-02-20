"use client";

import { cn } from "@/lib/utils";
import { calcHours, WEEKLY_CAPACITY } from "./planning-utils";

interface SdrHours {
    sdrId: string;
    name: string;
    hours: number;
}

interface CapacityFooterProps {
    sdrHours: SdrHours[];
}

export function CapacityFooter({ sdrHours }: CapacityFooterProps) {
    return (
        <div className="sticky bottom-0 left-0 right-0 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                Capacité équipe cette semaine
            </p>
            <div className="flex flex-wrap gap-4">
                {sdrHours.map(({ sdrId, name, hours }) => {
                    const isOver = hours > WEEKLY_CAPACITY;
                    const isZero = hours === 0;
                    return (
                        <span
                            key={sdrId}
                            className={cn(
                                "text-sm font-medium",
                                isOver && "text-red-600",
                                isZero && "text-slate-400"
                            )}
                        >
                            {name}{" "}
                            <span className={cn(isOver && "font-semibold")}>
                                {hours}h/{WEEKLY_CAPACITY}h
                            </span>
                            {isOver && (
                                <span className="ml-1 text-xs text-red-600">Surcharge</span>
                            )}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

export function computeSdrHours(
    blocks: Array<{ sdrId: string; sdr: { name: string }; startTime: string; endTime: string }>
): SdrHours[] {
    const bySdr: Record<string, { name: string; hours: number }> = {};
    for (const b of blocks) {
        if (!bySdr[b.sdrId]) {
            bySdr[b.sdrId] = { name: b.sdr.name, hours: 0 };
        }
        bySdr[b.sdrId].hours += calcHours(b.startTime, b.endTime);
    }
    return Object.entries(bySdr).map(([sdrId, { name, hours }]) => ({
        sdrId,
        name,
        hours: Math.round(hours * 10) / 10,
    }));
}
