"use client";

import { Phone, Mail, Linkedin, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { calcHours, getMissionColor } from "./planning-utils";

const CHANNEL_ICONS: Record<string, typeof Phone> = {
    CALL: Phone,
    EMAIL: Mail,
    LINKEDIN: Linkedin,
};

export interface ScheduleBlockForCard {
    id: string;
    sdrId: string;
    missionId: string;
    date: string | Date;
    startTime: string;
    endTime: string;
    notes?: string | null;
    status: string;
    suggestionStatus?: string | null;
    missionPlanId?: string | null;
    sdr: { id: string; name: string; email?: string; role?: string };
    mission: {
        id: string;
        name: string;
        channel?: string;
        client?: { name: string };
    };
}

interface ScheduleBlockCardProps {
    block: ScheduleBlockForCard;
    isSuggested?: boolean;
    hasConflict?: boolean;
    conflictTooltip?: string;
    missionColor?: { bg: string; border: string; text: string };
    onClick: () => void;
}

export function ScheduleBlockCard({
    block,
    isSuggested = false,
    hasConflict = false,
    conflictTooltip,
    missionColor,
    onClick,
}: ScheduleBlockCardProps) {
    const channel = block.mission?.channel || "CALL";
    const Icon = CHANNEL_ICONS[channel] || Phone;
    const color = missionColor ?? getMissionColor(block.missionId);
    const hours = calcHours(block.startTime, block.endTime);

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "w-full text-left rounded-lg border p-2 transition-all hover:opacity-90",
                isSuggested
                    ? "bg-slate-100 border-dashed border-slate-300 opacity-90"
                    : "bg-indigo-50 border-indigo-200",
                !isSuggested && "border-solid",
                hasConflict && "border-l-4 border-l-red-500"
            )}
        >
            <div className="flex items-start gap-2">
                {hasConflict && (
                    <span title={conflictTooltip} className="shrink-0 text-amber-600">
                        <AlertTriangle className="w-4 h-4" />
                    </span>
                )}
                <div className={cn("w-6 h-6 rounded flex items-center justify-center flex-shrink-0", color.bg)}>
                    <Icon className={cn("w-3.5 h-3.5", color.text)} />
                </div>
                <div className="flex-1 min-w-0">
                    <p
                        className={cn(
                            "text-xs font-semibold truncate",
                            isSuggested ? "text-slate-600" : "text-indigo-700"
                        )}
                    >
                        {block.sdr.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span>
                            {block.startTime} – {block.endTime}
                        </span>
                        <span className={cn("font-medium px-1 py-0.5 rounded", color.bg, color.text)}>
                            {hours}h
                        </span>
                    </div>
                </div>
            </div>
        </button>
    );
}
