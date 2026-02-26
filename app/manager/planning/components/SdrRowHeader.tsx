"use client";

import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SdrRowHeaderProps {
  sdrName: string;
  summary?: string;
  onSettingsClick?: () => void;
  className?: string;
}

export function SdrRowHeader({
  sdrName,
  summary,
  onSettingsClick,
  className,
}: SdrRowHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 min-w-0 pr-2",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-slate-900 text-sm">
          {sdrName}
        </div>
        {summary && (
          <div className="truncate text-xs text-slate-500">{summary}</div>
        )}
      </div>
      {onSettingsClick && (
        <button
          type="button"
          onClick={onSettingsClick}
          className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Paramètres dispo"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
