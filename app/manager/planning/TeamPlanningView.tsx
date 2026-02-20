"use client";

import { ScheduleBlockCard } from "./ScheduleBlockCard";
import type { ScheduleBlockForCard } from "./ScheduleBlockCard";
import { normalizeDate, getMissionColor, calcHours, WEEKLY_CAPACITY } from "./planning-utils";
import { cn } from "@/lib/utils";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface TeamPlanningViewProps {
    team: TeamMember[];
    blocks: ScheduleBlockForCard[];
    weekDates: Date[];
    conflictMap?: Record<string, { missionName?: string }>;
    onBlockClick: (block: ScheduleBlockForCard) => void;
}

export function TeamPlanningView({
    team,
    blocks,
    weekDates,
    conflictMap = {},
    onBlockClick,
}: TeamPlanningViewProps) {
    const missionColors: Record<string, { bg: string; border: string; text: string }> = {};
    const missionIds = [...new Set(blocks.map((b) => b.missionId))];
    missionIds.forEach((id, i) => {
        missionColors[id] = getMissionColor(id);
    });

    const hoursBySdr: Record<string, number> = {};
    team.forEach((t) => {
        hoursBySdr[t.id] = 0;
    });
    blocks.forEach((b) => {
        if (hoursBySdr[b.sdrId] !== undefined) {
            hoursBySdr[b.sdrId] += calcHours(b.startTime, b.endTime);
        }
    });

    return (
        <div className="overflow-x-auto">
            <table className="border-collapse table-fixed w-[900px] max-w-full">
                <colgroup>
                    <col className="w-[200px]" />
                    {weekDates.map((_, i) => (
                        <col key={i} className="w-[140px]" />
                    ))}
                </colgroup>
                <thead>
                    <tr className="border-b border-slate-200">
                        <th className="text-left p-3 w-[200px] bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                            Équipe
                        </th>
                        {weekDates.map((d, i) => {
                            const isToday =
                                d.toDateString() === new Date().toDateString();
                            return (
                                <th
                                    key={i}
                                    className={cn(
                                        "p-3 text-center text-xs font-semibold uppercase w-[140px]",
                                        isToday
                                            ? "text-indigo-600 border-b-2 border-b-indigo-500 bg-indigo-50/30"
                                            : "text-slate-500 bg-slate-50"
                                    )}
                                >
                                    <div>{DAYS[i]}</div>
                                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                                        {d.getDate()}
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {team.map((member) => {
                        const weeklyHours = hoursBySdr[member.id] ?? 0;
                        const isOver = weeklyHours > WEEKLY_CAPACITY;
                        const capacityPct = Math.min(
                            100,
                            Math.round((weeklyHours / WEEKLY_CAPACITY) * 100)
                        );

                        return (
                            <tr
                                key={member.id}
                                className="border-b border-slate-100 hover:bg-slate-50/50"
                            >
                                <td className="p-3 align-top">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0",
                                                member.role === "SDR"
                                                    ? "bg-indigo-500"
                                                    : "bg-emerald-500"
                                            )}
                                        >
                                            {member.name
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")
                                                .slice(0, 2)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900 text-sm">
                                                {member.name}
                                            </p>
                                            <span
                                                className={cn(
                                                    "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                                                    member.role === "SDR"
                                                        ? "bg-indigo-100 text-indigo-700"
                                                        : "bg-emerald-100 text-emerald-700"
                                                )}
                                            >
                                                {member.role === "SDR" ? "SDR" : "BD"}
                                            </span>
                                            <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden w-20">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full",
                                                        isOver
                                                            ? "bg-red-500"
                                                            : capacityPct > 80
                                                              ? "bg-amber-500"
                                                              : "bg-emerald-500"
                                                    )}
                                                    style={{ width: `${capacityPct}%` }}
                                                />
                                            </div>
                                            <p
                                                className={cn(
                                                    "text-[10px] font-medium mt-0.5",
                                                    isOver ? "text-red-600" : "text-slate-500"
                                                )}
                                            >
                                                {weeklyHours}h/{WEEKLY_CAPACITY}h
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                {weekDates.map((date, dayIndex) => {
                                    const dateStr = normalizeDate(date);
                                    const dayBlocks = blocks.filter(
                                        (b) =>
                                            b.sdrId === member.id &&
                                            normalizeDate(b.date) === dateStr
                                    );

                                    return (
                                        <td
                                            key={dayIndex}
                                            className={cn(
                                                "p-2 align-top min-h-[80px]",
                                                date.toDateString() ===
                                                    new Date().toDateString() && "bg-indigo-50/20"
                                            )}
                                        >
                                            <div className="space-y-2">
                                                {dayBlocks.map((block) => (
                                                    <ScheduleBlockCard
                                                        key={block.id}
                                                        block={block}
                                                        isSuggested={
                                                            block.suggestionStatus === "SUGGESTED"
                                                        }
                                                        hasConflict={!!conflictMap[block.id]}
                                                        conflictTooltip={
                                                            conflictMap[block.id]?.missionName
                                                                ? `Conflit: déjà suggéré pour ${conflictMap[block.id].missionName}`
                                                                : undefined
                                                        }
                                                        missionColor={missionColors[block.missionId]}
                                                        onClick={() => onBlockClick(block)}
                                                    />
                                                ))}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
