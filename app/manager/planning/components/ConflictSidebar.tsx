"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

interface ConflictItem {
  id: string;
  type: string;
  severity: "P0" | "P1" | "P2";
  message: string;
  suggestedAction: string | null;
  sdrId: string | null;
  missionId: string | null;
}

interface ConflictSidebarProps {
  conflicts: ConflictItem[];
  onResolve?: (conflictId: string) => void;
  onClose?: () => void;
  className?: string;
}

const SEVERITY_CONFIG = {
  P0: {
    icon: AlertTriangle,
    label: "Critique",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    iconCls: "text-red-500",
  },
  P1: {
    icon: AlertCircle,
    label: "Attention",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    iconCls: "text-amber-500",
  },
  P2: {
    icon: Info,
    label: "Info",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    iconCls: "text-blue-500",
  },
};

export function ConflictSidebar({
  conflicts,
  onResolve,
  onClose,
  className,
}: ConflictSidebarProps) {
  return (
    <div
      className={cn(
        "flex flex-col h-full border-l border-slate-200 bg-white overflow-hidden",
        className
      )}
    >
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Conflits</h3>
        {conflicts.length > 0 && (
          <span className="text-xs font-medium text-slate-500">
            {conflicts.length} conflit{conflicts.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {conflicts.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            Aucun conflit
          </p>
        ) : (
          conflicts.map((c) => {
            const config = SEVERITY_CONFIG[c.severity];
            const Icon = config.icon;
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-lg border p-3 space-y-2",
                  config.bg,
                  config.border
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", config.iconCls)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", config.text)}>
                      {c.message}
                    </p>
                    {c.suggestedAction && (
                      <p className="text-xs text-slate-600 mt-1">
                        → {c.suggestedAction}
                      </p>
                    )}
                  </div>
                </div>
                {onResolve && (
                  <button
                    type="button"
                    onClick={() => onResolve(c.id)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Marquer résolu
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
