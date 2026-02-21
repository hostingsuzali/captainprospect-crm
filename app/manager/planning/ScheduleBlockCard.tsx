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
            title={hasConflict ? conflictTooltip : ""}
            className={cn(
                "w-full text-left rounded-xl p-3 transition-all duration-300 relative overflow-hidden group border",
                isSuggested
                    ? "bg-slate-50 border-dashed border-slate-300 hover:bg-slate-100 opacity-90"
                    : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5"
            )}
        >
            {/* Top decorative gradient line */}
            {!isSuggested && (
                <div className={cn("absolute top-0 left-0 right-0 h-1 opacity-80", color.bg)} />
            )}

            {/* Conflict Warning Glow */}
            {hasConflict && (
                <div className="absolute top-0 right-0 p-1">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                </div>
            )}

            <div className="flex items-start gap-3">
                <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105",
                    color.bg,
                    isSuggested && "opacity-60 grayscale"
                )}>
                    <Icon className={cn("w-4 h-4", color.text)} />
                </div>
                <div className="flex-1 min-w-0 pr-1">
                    <p className={cn(
                        "text-xs font-bold truncate tracking-tight mb-0.5",
                        isSuggested ? "text-slate-500" : "text-slate-800"
                    )}>
                        {block.mission.name || "Mission"}
                    </p>
                    <p className={cn(
                        "text-[11px] truncate mb-1.5",
                        isSuggested ? "text-slate-400" : "text-slate-500 font-medium"
                    )}>
                        {block.sdr.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="flex items-center gap-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-semibold">
                            {block.startTime} — {block.endTime}
                        </span>
                        <span className={cn("font-bold px-1.5 py-0.5 rounded-md shadow-sm", color.bg, color.text)}>
                            {hours}h
                        </span>
                    </div>
                </div>
            </div>
            {hasConflict && (
                <div className="mt-2 text-[10px] font-medium text-red-600 bg-red-50 p-1.5 rounded-md border border-red-100 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 line-clamp-2" />
                    <span>Conflit : ce créneau chevauche un autre.</span>
                </div>
            )}
        </button>
    );
}
