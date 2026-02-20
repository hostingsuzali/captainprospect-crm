"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScheduleBlockCard } from "./ScheduleBlockCard";
import type { ScheduleBlockForCard } from "./ScheduleBlockCard";
import { normalizeDate } from "./planning-utils";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

interface MissionPlanRow {
    id: string;
    status: string;
    mission: { id: string; name: string; channel: string };
    frequency: number;
    preferredDays: string[];
    timePreference: string;
}

interface MissionPlanningViewProps {
    missionPlans: MissionPlanRow[];
    blocks: ScheduleBlockForCard[];
    weekDates: Date[];
    conflictMap?: Record<string, { missionName?: string }>;
    onBlockClick: (block: ScheduleBlockForCard) => void;
    onBulkConfirm?: (missionPlanId: string) => void;
    onBulkReject?: (missionPlanId: string) => void;
}

function getPlanStatusBadge(plan: MissionPlanRow, blocksForPlan: ScheduleBlockForCard[]) {
    if (plan.status === "DRAFT" && blocksForPlan.length === 0) {
        return { label: "Brouillon", className: "bg-slate-100 text-slate-600" };
    }
    const hasSuggested = blocksForPlan.some((b) => b.suggestionStatus === "SUGGESTED");
    if (hasSuggested) {
        return { label: "À confirmer", className: "bg-amber-100 text-amber-700" };
    }
    return { label: "Planifié", className: "bg-emerald-100 text-emerald-700" };
}

function getTimeSummary(timePreference: string): string {
    switch (timePreference) {
        case "MORNING":
            return "Matin";
        case "AFTERNOON":
            return "Après-midi";
        case "FULL_DAY":
            return "Journée";
        case "CUSTOM":
            return "Personnalisé";
        default:
            return "";
    }
}

export function MissionPlanningView({
    missionPlans,
    blocks,
    weekDates,
    conflictMap = {},
    onBlockClick,
    onBulkConfirm,
    onBulkReject,
}: MissionPlanningViewProps) {
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
                            Mission
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
                    {missionPlans.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500">
                                Aucune mission avec un plan. Configurez un plan de mission depuis une mission.
                            </td>
                        </tr>
                    ) : (
                        missionPlans.map((plan) => {
                            const blocksForPlan = blocks.filter(
                                (b) => b.missionId === plan.mission.id
                            );
                            const badge = getPlanStatusBadge(plan, blocksForPlan);
                            const hasSuggested = blocksForPlan.some(
                                (b) => b.suggestionStatus === "SUGGESTED"
                            );

                            return (
                                <tr
                                    key={plan.id}
                                    className="border-b border-slate-100 hover:bg-slate-50/50"
                                >
                                    <td className="p-3 align-top">
                                        <div>
                                            <p className="font-semibold text-slate-900 text-[13px]">
                                                {plan.mission.name}
                                            </p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                {plan.frequency}j/sem · {getTimeSummary(plan.timePreference)}
                                            </p>
                                            <span
                                                className={cn(
                                                    "inline-block mt-1.5 px-2 py-0.5 text-[10px] font-medium rounded",
                                                    badge.className
                                                )}
                                            >
                                                {badge.label}
                                            </span>
                                            {hasSuggested && onBulkConfirm && onBulkReject && (
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        type="button"
                                                        className="text-[10px] text-emerald-600 hover:underline"
                                                        onClick={() => onBulkConfirm(plan.id)}
                                                    >
                                                        Tout confirmer
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="text-[10px] text-red-600 hover:underline"
                                                        onClick={() => onBulkReject(plan.id)}
                                                    >
                                                        Tout rejeter
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    {plan.status === "DRAFT" && blocksForPlan.length === 0 ? (
                                        <td colSpan={5} className="p-4">
                                            <div className="border border-dashed border-slate-200 rounded-lg py-8 flex flex-col items-center justify-center text-center">
                                                <p className="text-sm text-slate-500">
                                                    Aucun créneau généré — Configurer le plan
                                                </p>
                                                <Link
                                                    href={`/manager/missions/${plan.mission.id}#plan`}
                                                    className="text-sm text-indigo-600 hover:underline mt-1"
                                                >
                                                    Configurer le plan
                                                </Link>
                                            </div>
                                        </td>
                                    ) : (
                                        weekDates.map((date, dayIndex) => {
                                            const dateStr = normalizeDate(date);
                                            const dayBlocks = blocksForPlan.filter(
                                                (b) =>
                                                    normalizeDate(b.date) === dateStr &&
                                                    b.missionId === plan.mission.id
                                            );

                                            return (
                                                <td
                                                    key={dayIndex}
                                                    className={cn(
                                                        "p-2 align-top min-h-[80px]",
                                                        date.toDateString() === new Date().toDateString() &&
                                                            "bg-indigo-50/20"
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
                                                                hasConflict={
                                                                    !!conflictMap[block.id]
                                                                }
                                                                conflictTooltip={
                                                                    conflictMap[block.id]?.missionName
                                                                        ? `Conflit: déjà suggéré pour ${conflictMap[block.id].missionName}`
                                                                        : undefined
                                                                }
                                                                onClick={() => onBlockClick(block)}
                                                            />
                                                        ))}
                                                    </div>
                                                </td>
                                            );
                                        })
                                    )}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
