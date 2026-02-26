"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { GridCellComponent } from "./GridCell";
import { SdrRowHeader } from "./SdrRowHeader";
import { MissionCoveragePanel } from "./MissionCoveragePanel";
import type { CapacityMatrix } from "@/lib/planning/capacityMatrix";

interface PlanningGridProps {
  month: string;
  onCellClick?: (sdrId: string, date: string) => void;
  onSdrSettingsClick?: (sdrId: string) => void;
}

export function PlanningGrid({
  month,
  onCellClick,
  onSdrSettingsClick,
}: PlanningGridProps) {
  const [matrix, setMatrix] = useState<CapacityMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{
    sdrId: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/planning/matrix?month=${month}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setMatrix(json.data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Chargement de la matrice…
      </div>
    );
  }

  if (!matrix) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Aucune donnée
      </div>
    );
  }

  const handleCellClick = (sdrId: string, dateStr: string) => {
    const key = `${sdrId}:${dateStr}`;
    setSelectedCell((prev) =>
      prev?.sdrId === sdrId && prev?.date === dateStr ? null : { sdrId, date: dateStr }
    );
    onCellClick?.(sdrId, dateStr);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MissionCoveragePanel
        missionCoverage={matrix.missionCoverage}
        missionNames={matrix.missionNames}
        missionColors={matrix.missionColors}
        workingDays={matrix.workingDays}
      />
      <div className="flex-1 overflow-auto">
        <div className="inline-flex flex-col min-w-max">
          <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
            <div className="w-40 flex-shrink-0 px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide border-r border-slate-200">
              SDR
            </div>
            <div className="flex gap-1 overflow-x-auto py-2 px-2">
              {matrix.workingDays.map((d, i) => (
                <div
                  key={i}
                  className="w-10 min-w-[2.5rem] text-center text-[10px] font-medium text-slate-600"
                >
                  {format(typeof d === "string" ? new Date(d) : d, "EEE d", { locale: fr })}
                </div>
              ))}
            </div>
          </div>
          {matrix.sdrIds.map((sdrId, si) => (
            <div
              key={sdrId}
              className={cn(
                "flex border-b border-slate-100 hover:bg-slate-50/50 transition-colors",
                si % 2 === 1 && "bg-slate-50/30"
              )}
            >
              <div className="w-40 flex-shrink-0 px-3 py-2 border-r border-slate-200 flex items-center">
                <SdrRowHeader
                  sdrName={matrix.sdrNames[sdrId] ?? sdrId}
                  onSettingsClick={
                    onSdrSettingsClick ? () => onSdrSettingsClick(sdrId) : undefined
                  }
                />
              </div>
              <div className="flex gap-1 py-2 px-2">
                {matrix.cells[si]?.map((cell, di) => {
                  const dateStr =
                    typeof cell.date === "string"
                      ? cell.date.slice(0, 10)
                      : new Date(cell.date).toISOString().slice(0, 10);
                  return (
                    <GridCellComponent
                      key={di}
                      cell={cell}
                      sdrName={matrix.sdrNames[sdrId] ?? sdrId}
                      onClick={() => handleCellClick(sdrId, dateStr)}
                      isSelected={
                        selectedCell?.sdrId === sdrId && selectedCell?.date === dateStr
                      }
                    />
                  );
                }) ?? null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
