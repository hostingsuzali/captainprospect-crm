"use client";

import { useState } from "react";
import { LayoutGrid, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

import { PlanningMonthProvider } from "./PlanningMonthContext";
import { StickyHeader } from "./StickyHeader";
import { MissionPanel } from "./MissionPanel";
import { TeamPanel } from "./TeamPanel";
import { ConflictDrawer } from "./ConflictDrawer";
import { AssignModal } from "./AssignModal";
import { MonthCalendar } from "./MonthCalendar";

export default function PlanningPage() {
    return (
        <PlanningMonthProvider>
            <PlanningPageContent />
        </PlanningMonthProvider>
    );
}

type TabKey = "allocation" | "calendrier";

function PlanningPageContent() {
    const [activeTab, setActiveTab] = useState<TabKey>("allocation");

    return (
        <div className="flex flex-col h-[calc(100vh-64px)]">
            <StickyHeader />

            <div className="bg-white border-b border-slate-200 px-6">
                <div className="flex items-center gap-1 -mb-px">
                    <TabButton
                        active={activeTab === "allocation"}
                        onClick={() => setActiveTab("allocation")}
                        icon={<LayoutGrid className="w-4 h-4" />}
                        label="Allocation"
                    />
                    <TabButton
                        active={activeTab === "calendrier"}
                        onClick={() => setActiveTab("calendrier")}
                        icon={<CalendarDays className="w-4 h-4" />}
                        label="Calendrier"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {activeTab === "allocation" && <AllocationTab />}
                {activeTab === "calendrier" && <MonthCalendar />}
            </div>

            <ConflictDrawer />
            <AssignModal />
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                active
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
        >
            {icon}
            {label}
        </button>
    );
}

function AllocationTab() {
    return (
        <div className="h-full flex flex-col xl:flex-row">
            <div className="xl:w-[55%] w-full border-r border-slate-200 h-full overflow-hidden">
                <MissionPanel />
            </div>
            <div className="xl:w-[45%] w-full h-full overflow-hidden">
                <TeamPanel />
            </div>
        </div>
    );
}
