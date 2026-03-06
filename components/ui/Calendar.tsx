"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Import react-day-picker base styles (required for layout)
import "react-day-picker/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            locale={fr}
            showOutsideDays={showOutsideDays}
            className={cn("rdp-root p-3", className)}
            classNames={{
                months: "flex flex-col sm:flex-row gap-2",
                month: "flex flex-col gap-2",
                month_caption: "flex justify-center items-center h-9",
                caption_label: "text-sm font-medium text-slate-900",
                nav: "flex items-center gap-1",
                button_previous: "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white h-9 w-9 text-slate-600 hover:bg-slate-50 disabled:opacity-50",
                button_next: "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white h-9 w-9 text-slate-600 hover:bg-slate-50 disabled:opacity-50",
                weekdays: "flex",
                weekday:
                    "text-slate-500 rounded-md w-9 font-normal text-[0.8rem]",
                week: "flex w-full mt-1",
                day: "relative p-0 text-center text-sm focus-within:relative [&:has([aria-selected])]:bg-indigo-50 first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg",
                day_button: cn(
                    "inline-flex items-center justify-center rounded-lg h-9 w-9 font-normal",
                    "hover:bg-slate-100 focus:bg-slate-100 focus:outline-none",
                    "aria-selected:bg-indigo-500 aria-selected:text-white aria-selected:opacity-100",
                    "text-slate-900"
                ),
                selected:
                    "bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 focus:bg-indigo-500",
                today: "bg-indigo-50 text-indigo-600 font-medium",
                outside:
                    "text-slate-400 opacity-75 aria-selected:bg-slate-100 aria-selected:text-slate-500",
                disabled: "text-slate-300 line-through",
                hidden: "invisible",
                ...classNames,
            }}
            {...props}
        />
    );
}
Calendar.displayName = "Calendar";

export { Calendar };
