"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ProposalRow {
  date: string;
  missionName: string;
  originalSdrId: string;
  originalSdrName?: string;
  proposedSdrId: string | null;
  proposedSdrName?: string | null;
  proposedTime: { start: string; end: string } | null;
  status: "AUTO_RESOLVED" | "OVERLOAD_WARNING" | "UNRESOLVED";
  overloadDelta?: number;
}

interface ProposalViewProps {
  cause: string;
  affectedDays: number;
  rows: ProposalRow[];
  summary: {
    autoResolved: number;
    overloadWarns: number;
    unresolved: number;
  };
  onApply?: () => void;
  onDismiss?: () => void;
  applying?: boolean;
  className?: string;
}

const STATUS_CONFIG = {
  AUTO_RESOLVED: {
    label: "Résolu",
    cls: "bg-emerald-100 text-emerald-800",
  },
  OVERLOAD_WARNING: {
    label: "Surcharge",
    cls: "bg-amber-100 text-amber-800",
  },
  UNRESOLVED: {
    label: "Non résolu",
    cls: "bg-red-100 text-red-800",
  },
};

export function ProposalView({
  cause,
  affectedDays,
  rows,
  summary,
  onApply,
  onDismiss,
  applying = false,
  className,
}: ProposalViewProps) {
  return (
    <div
      className={cn(
        "flex flex-col border border-slate-200 rounded-lg bg-white overflow-hidden",
        className
      )}
    >
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-900">Proposition de rééquilibrage</h3>
        <p className="text-xs text-slate-600 mt-0.5">{cause} · {affectedDays} jour(s)</p>
        <div className="flex gap-3 mt-2 text-xs text-slate-600">
          <span>{summary.autoResolved} résolus</span>
          <span>{summary.overloadWarns} surcharge(s)</span>
          <span>{summary.unresolved} non résolus</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto max-h-64">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Date</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Mission</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Origine</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Nouveau SDR</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const config = STATUS_CONFIG[r.status];
              return (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2 text-slate-700">
                    {format(new Date(r.date + "T12:00:00"), "d MMM", { locale: fr })}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.missionName}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {r.originalSdrName ?? r.originalSdrId}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.proposedSdrName ?? r.proposedSdrId ?? "—"}
                    {r.proposedTime && (
                      <span className="text-xs text-slate-500 ml-1">
                        {r.proposedTime.start}-{r.proposedTime.end}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                        config.cls
                      )}
                    >
                      {config.label}
                      {r.overloadDelta != null && ` +${r.overloadDelta}j`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(onApply || onDismiss) && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 flex gap-2">
          {onApply && summary.unresolved === 0 && (
            <button
              type="button"
              onClick={onApply}
              disabled={applying}
              className="flex-1 py-2 px-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {applying ? "Application…" : "Appliquer"}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Fermer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
