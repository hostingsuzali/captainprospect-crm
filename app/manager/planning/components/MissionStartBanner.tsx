"use client";

import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MissionStartBannerProps {
  missionName: string;
  startDate: string;
  onSchedule?: () => void;
  className?: string;
}

export function MissionStartBanner({
  missionName,
  startDate,
  onSchedule,
  className,
}: MissionStartBannerProps) {
  const date = new Date(startDate + "T12:00:00");
  const dateStr = format(date, "d MMMM yyyy", { locale: fr });

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-900",
        className
      )}
    >
      <Calendar className="w-5 h-5 flex-shrink-0 text-blue-600" />
      <p className="flex-1 text-sm font-medium">
        {missionName} démarre le {dateStr}
      </p>
      {onSchedule && (
        <button
          type="button"
          onClick={onSchedule}
          className="text-sm font-medium text-blue-700 hover:text-blue-900 underline"
        >
          Planifier
        </button>
      )}
    </div>
  );
}
