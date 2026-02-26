"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { MissionCoverageCell } from "@/lib/planning/capacityMatrix";

interface MissionCoveragePanelProps {
  missionCoverage: MissionCoverageCell[][];
  missionNames: Record<string, string>;
  missionColors: Record<string, string>;
  workingDays: (Date | string)[];
}

export function MissionCoveragePanel({
  missionCoverage,
  missionNames,
  missionColors,
  workingDays,
}: MissionCoveragePanelProps) {
  return (
    <div className="border-b border-slate-200 bg-slate-50/50">
      <div className="flex">
        <div className="w-40 flex-shrink-0 px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
          Couverture
        </div>
        <div className="flex-1 flex gap-1 overflow-x-auto py-2 pr-2">
          {workingDays.map((d, di) => (
            <div
              key={di}
              className="w-10 min-w-[2.5rem] text-center text-[10px] text-slate-500"
            >
              {format(typeof d === "string" ? new Date(d) : d, "d", { locale: fr })}
            </div>
          ))}
        </div>
      </div>
      {missionCoverage.map((row, mi) => (
        <div key={row[0]?.missionId ?? mi} className="flex border-t border-slate-100">
          <div className="w-40 flex-shrink-0 px-3 py-1.5 flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: missionColors[row[0]?.missionId ?? ""] ?? "#6366f1" }}
            />
            <span className="text-sm font-medium text-slate-800 truncate">
              {missionNames[row[0]?.missionId ?? ""] ?? "Mission"}
            </span>
          </div>
          <div className="flex-1 flex gap-1 overflow-x-auto py-1.5 pr-2">
            {row.map((c, ci) => (
              <div
                key={ci}
                className={cn(
                  "w-10 min-w-[2.5rem] h-6 flex items-center justify-center text-xs font-medium rounded",
                  c.isPreStart || c.isPostEnd
                    ? "bg-slate-100 text-slate-400"
                    : c.sdrCount >= c.targetCount
                      ? "bg-emerald-500/20 text-emerald-700"
                      : c.sdrCount > 0
                        ? "bg-amber-500/20 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                )}
              >
                {c.isPreStart || c.isPostEnd ? "—" : `${c.sdrCount}/${c.targetCount}`}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
