"use client";

import { Ghost } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhantomBlockBannerProps {
  count: number;
  onViewPhantoms?: () => void;
  onDeletePhantoms?: () => void;
  className?: string;
}

export function PhantomBlockBanner({
  count,
  onViewPhantoms,
  onDeletePhantoms,
  className,
}: PhantomBlockBannerProps) {
  if (count === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 bg-slate-100 text-slate-800",
        className
      )}
    >
      <Ghost className="w-5 h-5 flex-shrink-0 text-slate-500" />
      <p className="flex-1 text-sm font-medium">
        {count} bloc(s) fantôme(s) — hors fenêtre mission
      </p>
      <div className="flex gap-2">
        {onViewPhantoms && (
          <button
            type="button"
            onClick={onViewPhantoms}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 underline"
          >
            Voir
          </button>
        )}
        {onDeletePhantoms && (
          <button
            type="button"
            onClick={onDeletePhantoms}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}
