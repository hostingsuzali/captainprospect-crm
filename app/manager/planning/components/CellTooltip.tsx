"use client";

import type { GridCell } from "@/lib/planning/capacityMatrix";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CellTooltipProps {
  cell: GridCell;
  sdrName: string;
  content: React.ReactNode;
}

export function CellTooltip({ cell, sdrName, content }: CellTooltipProps) {
  const date = typeof cell.date === "string" ? new Date(cell.date) : cell.date;
  const dateStr = format(date, "EEEE d MMMM", { locale: fr });
  const blocksSummary = cell.assignedBlocks
    .map((b) => `${b.missionName} ${b.timeStart}-${b.timeEnd} (${b.fraction.toFixed(1)}j)`)
    .join("\n");
  const capacityInfo = cell.isAbsent
    ? "Absent"
    : cell.isNonWorking
      ? "Non travaillé"
      : `${cell.totalAssigned.toFixed(1)}/${cell.capacity}j`;

  return (
    <div className="min-w-[200px] space-y-2 text-left">
      <div className="font-medium text-slate-900">{sdrName}</div>
      <div className="text-xs text-slate-600">{dateStr}</div>
      <div className="text-sm">
        <span className="text-slate-500">Capacité :</span> {capacityInfo}
      </div>
      {cell.assignedBlocks.length > 0 && (
        <div className="border-t border-slate-200 pt-2">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Blocs
          </div>
          <div className="text-xs text-slate-700 whitespace-pre-line">
            {blocksSummary}
          </div>
        </div>
      )}
      {cell.cellState === "CONFLICT" && (
        <div className="text-xs text-red-600 font-medium">Chevauchement horaire</div>
      )}
      {cell.cellState === "OVERLOADED" && (
        <div className="text-xs text-amber-600 font-medium">Surcapacité</div>
      )}
      {content}
    </div>
  );
}
