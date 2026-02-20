"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui";
import { Card, Button } from "@/components/ui";
import { Loader2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { WeekNavigation } from "./WeekNavigation";
import { MissionPlanningView } from "./MissionPlanningView";
import { TeamPlanningView } from "./TeamPlanningView";
import { BlockPopover } from "./BlockPopover";
import { CapacityFooter, computeSdrHours } from "./CapacityFooter";
import { detectConflicts } from "@/lib/planning/conflictDetection";
import type { ScheduleBlockForCard } from "./ScheduleBlockCard";

type ViewMode = "mission" | "team";

function getMonday(d: Date): Date {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function weekStartToParam(d: Date): string {
    return d.toISOString().slice(0, 10);
}

interface MissionPlanForView {
    id: string;
    status: string;
    mission: { id: string; name: string; channel: string };
    frequency: number;
    preferredDays: string[];
    timePreference: string;
}

interface WeeklyData {
    blocks: ScheduleBlockForCard[];
    missionPlans: MissionPlanForView[];
    team: Array<{ id: string; name: string; email: string; role: string }>;
}

export default function PlanningPage() {
    const searchParams = useSearchParams();
    const { success, error: showError } = useToast();

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));
    const [activeView, setActiveView] = useState<ViewMode>("mission");
    const [data, setData] = useState<WeeklyData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedBlock, setSelectedBlock] = useState<ScheduleBlockForCard | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [isCopying, setIsCopying] = useState(false);

    const fetchWeekly = useCallback(async () => {
        setIsLoading(true);
        try {
            const weekStart = weekStartToParam(currentWeekStart);
            const res = await fetch(`/api/planning/weekly?weekStart=${weekStart}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data);
            } else {
                showError("Erreur", json.error || "Impossible de charger le planning");
            }
        } catch {
            showError("Erreur", "Impossible de charger le planning");
        } finally {
            setIsLoading(false);
        }
    }, [currentWeekStart, showError]);

    useEffect(() => {
        fetchWeekly();
    }, [fetchWeekly]);

    const weekDates = [
        new Date(currentWeekStart),
        new Date(currentWeekStart.getTime() + 24 * 60 * 60 * 1000),
        new Date(currentWeekStart.getTime() + 24 * 60 * 60 * 1000 * 2),
        new Date(currentWeekStart.getTime() + 24 * 60 * 60 * 1000 * 3),
        new Date(currentWeekStart.getTime() + 24 * 60 * 60 * 1000 * 4),
    ];

    const navigateWeek = (dir: "prev" | "next") => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + (dir === "prev" ? -7 : 7));
        setCurrentWeekStart(d);
    };

    const goToToday = () => {
        setCurrentWeekStart(getMonday(new Date()));
    };

    const handleBlockClick = (block: ScheduleBlockForCard) => {
        setSelectedBlock(block);
    };

    const handleConfirm = async (blockId: string) => {
        setIsConfirming(true);
        try {
            const res = await fetch(`/api/schedule-blocks/${blockId}/confirm`, {
                method: "PATCH",
            });
            const json = await res.json();
            if (json.success) {
                success("Créneau confirmé", "");
                setSelectedBlock(null);
                fetchWeekly();
            } else {
                showError("Erreur", json.error || "Impossible de confirmer");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setIsConfirming(false);
        }
    };

    const handleReject = async (blockId: string) => {
        setIsRejecting(true);
        try {
            const res = await fetch(`/api/schedule-blocks/${blockId}/reject`, {
                method: "PATCH",
            });
            const json = await res.json();
            if (json.success) {
                success("Créneau rejeté", "");
                setSelectedBlock(null);
                fetchWeekly();
            } else {
                showError("Erreur", json.error || "Impossible de rejeter");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setIsRejecting(false);
        }
    };

    const handleCancelBlock = async (blockId: string) => {
        try {
            const res = await fetch(`/api/planning/${blockId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "CANCELLED" }),
            });
            const json = await res.json();
            if (json.success) {
                success("Créneau annulé", "");
                setSelectedBlock(null);
                fetchWeekly();
            } else {
                showError("Erreur", json.error || "Impossible d'annuler");
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        }
    };

    const handleBulkConfirm = async (missionPlanId: string) => {
        try {
            const res = await fetch("/api/schedule-blocks/bulk-confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    missionPlanId,
                    weekStart: weekStartToParam(currentWeekStart),
                }),
            });
            const json = await res.json();
            if (json.success) {
                success("Créneaux confirmés", "");
                fetchWeekly();
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        }
    };

    const handleBulkReject = async (missionPlanId: string) => {
        try {
            const res = await fetch("/api/schedule-blocks/bulk-reject", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    missionPlanId,
                    weekStart: weekStartToParam(currentWeekStart),
                }),
            });
            const json = await res.json();
            if (json.success) {
                success("Créneaux rejetés", "");
                fetchWeekly();
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        }
    };

    const handleCopyWeek = async () => {
        setIsCopying(true);
        const next = new Date(currentWeekStart);
        next.setDate(next.getDate() + 7);
        try {
            const res = await fetch("/api/planning/copy-week", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceStartDate: weekStartToParam(currentWeekStart),
                    targetStartDate: weekStartToParam(next),
                }),
            });
            const json = await res.json();
            if (json.success) {
                success("Semaine copiée", `${json.data?.created ?? 0} créneaux copiés`);
                setCurrentWeekStart(next);
                fetchWeekly();
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setIsCopying(false);
        }
    };

    const missionCount = data?.missionPlans?.length ?? 0;
    const teamCount = data?.team?.length ?? 0;
    const sdrHours = data?.blocks ? computeSdrHours(data.blocks) : [];
    const conflictMap = data?.blocks ? detectConflicts(data.blocks) : {};

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Planning</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {missionCount} mission{missionCount !== 1 ? "s" : ""} actives · {teamCount} SDR
                        {teamCount !== 1 ? "s" : ""}
                    </p>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyWeek}
                    disabled={isCopying}
                    className="gap-2"
                >
                    <Copy className="w-4 h-4" />
                    Copier → semaine suivante
                </Button>
            </div>

            <Card className="!p-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveView("mission")}
                            className={cn(
                                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                                activeView === "mission"
                                    ? "bg-indigo-500 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            Par mission
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveView("team")}
                            className={cn(
                                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                                activeView === "team"
                                    ? "bg-indigo-500 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            Par équipe
                        </button>
                    </div>
                    <WeekNavigation
                        weekStart={currentWeekStart}
                        onPrev={() => navigateWeek("prev")}
                        onNext={() => navigateWeek("next")}
                        onToday={goToToday}
                    />
                </div>
            </Card>

            <Card className="overflow-hidden p-0">
                {activeView === "mission" && data && (
                    <MissionPlanningView
                        missionPlans={data.missionPlans}
                        blocks={data.blocks}
                        weekDates={weekDates}
                        conflictMap={conflictMap}
                        onBlockClick={handleBlockClick}
                        onBulkConfirm={handleBulkConfirm}
                        onBulkReject={handleBulkReject}
                    />
                )}
                {activeView === "team" && data && (
                    <TeamPlanningView
                        team={data.team}
                        blocks={data.blocks}
                        weekDates={weekDates}
                        conflictMap={conflictMap}
                        onBlockClick={handleBlockClick}
                    />
                )}
                {data && data.blocks.length > 0 && (
                    <CapacityFooter sdrHours={sdrHours} />
                )}
            </Card>

            <BlockPopover
                block={selectedBlock}
                onClose={() => setSelectedBlock(null)}
                onConfirm={handleConfirm}
                onReject={handleReject}
                onCancelBlock={handleCancelBlock}
                isConfirming={isConfirming}
                isRejecting={isRejecting}
            />
        </div>
    );
}
