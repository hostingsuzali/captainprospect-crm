"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayDetailSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sdrName: string;
  date: string;
  blocks?: Array<{
    missionName: string;
    startTime: string;
    endTime: string;
    blockId: string;
    isConfirmed: boolean;
  }>;
  onAddBlock?: () => void;
  onRemoveBlock?: (blockId: string) => void;
  className?: string;
}

export function DayDetailSidebar({
  isOpen,
  onClose,
  sdrName,
  date,
  blocks = [],
  onAddBlock,
  onRemoveBlock,
  className,
}: DayDetailSidebarProps) {
  if (!isOpen) return null;

  const dateObj = new Date(date + "T12:00:00");
  const dateStr = format(dateObj, "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div
      className={cn(
        "flex flex-col h-full border-l border-slate-200 bg-white w-80 overflow-hidden",
        className
      )}
    >
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 truncate flex-1">
          {sdrName}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className="text-sm text-slate-600">{dateStr}</p>
        <div>
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Blocs
          </h4>
          {blocks.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun bloc</p>
          ) : (
            <ul className="space-y-2">
              {blocks.map((b) => (
                <li
                  key={b.blockId}
                  className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {b.missionName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {b.startTime} – {b.endTime}
                      {b.isConfirmed ? " · Confirmé" : " · Proposé"}
                    </p>
                  </div>
                  {onRemoveBlock && (
                    <button
                      type="button"
                      onClick={() => onRemoveBlock(b.blockId)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Supprimer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {onAddBlock && (
          <button
            type="button"
            onClick={onAddBlock}
            className="w-full py-2 px-3 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            + Ajouter un bloc
          </button>
        )}
      </div>
    </div>
  );
}
