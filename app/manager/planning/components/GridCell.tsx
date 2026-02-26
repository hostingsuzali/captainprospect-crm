"use client";

import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui";
import { CellTooltip } from "./CellTooltip";
import type { GridCell, CellState } from "@/lib/planning/capacityMatrix";

const CELL_STATE_STYLES: Record<
  CellState,
  { bg: string; border: string; pattern?: string }
> = {
  HEALTHY: { bg: "bg-emerald-500/20", border: "border-emerald-400/60" },
  OVERLOADED: { bg: "bg-amber-500/20", border: "border-amber-400/60" },
  CONFLICT: { bg: "bg-red-500/20", border: "border-red-400/60" },
  ABSENT: {
    bg: "bg-slate-200/80",
    border: "border-slate-300",
    pattern: "bg-[repeating-linear-gradient(-45deg,transparent,transparent_4px,rgba(0,0,0,0.05)_4px,rgba(0,0,0,0.05)_8px)]",
  },
  NON_WORKING: { bg: "bg-slate-100", border: "border-slate-200" },
  PRE_MISSION: { bg: "bg-slate-50", border: "border-slate-200" },
  POST_MISSION: { bg: "bg-slate-50", border: "border-slate-200" },
  UNASSIGNED: {
    bg: "bg-slate-50",
    border: "border-slate-200 border-dashed",
  },
};

interface GridCellProps {
  cell: GridCell;
  sdrName: string;
  onClick?: () => void;
  isSelected?: boolean;
}

export function GridCellComponent({
  cell,
  sdrName,
  onClick,
  isSelected,
}: GridCellProps) {
  const styles = CELL_STATE_STYLES[cell.cellState];
  const showBlocks = cell.assignedBlocks.length > 0;
  const firstBlock = cell.assignedBlocks[0];

  return (
    <Tooltip
      content={
        <CellTooltip cell={cell} sdrName={sdrName} content={null} />
      }
      position="top"
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-10 h-8 min-w-[2.5rem] flex items-center justify-center text-xs font-medium rounded border transition-colors",
          styles.bg,
          styles.border,
          styles.pattern,
          onClick && "cursor-pointer hover:ring-2 hover:ring-indigo-400/50",
          isSelected && "ring-2 ring-indigo-500"
        )}
      >
        {cell.isAbsent && (
          <span className="text-slate-500 text-[10px]">ABS</span>
        )}
        {!cell.isAbsent && cell.cellState === "NON_WORKING" && (
          <span className="text-slate-400">—</span>
        )}
        {!cell.isAbsent && cell.cellState !== "NON_WORKING" && showBlocks && (
          <div
            className="w-2 h-2 rounded-sm flex-shrink-0"
            style={{ backgroundColor: firstBlock?.missionColor ?? "#6366f1" }}
            title={firstBlock?.missionName}
          />
        )}
        {!cell.isAbsent &&
          cell.cellState !== "NON_WORKING" &&
          !showBlocks &&
          cell.cellState !== "ABSENT" && (
            <span className="text-slate-400 text-[10px]">0</span>
          )}
      </button>
    </Tooltip>
  );
}
