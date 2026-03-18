"use client";

import { PlanningMonthProvider } from "./PlanningMonthContext";
import { StickyHeader } from "./StickyHeader";
import { MonthCalendar } from "./MonthCalendar";

export default function PlanningPage() {
    return (
        <PlanningMonthProvider>
            <div className="flex flex-col h-[calc(100vh-64px)]">
                <StickyHeader />
                <div className="flex-1 overflow-hidden">
                    <MonthCalendar />
                </div>
            </div>
        </PlanningMonthProvider>
    );
}
