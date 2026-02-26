"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RebalanceBannerProps {
  message: string;
  onViewProposal?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function RebalanceBanner({
  message,
  onViewProposal,
  onDismiss,
  className,
}: RebalanceBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900",
        className
      )}
    >
      <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <div className="flex gap-2">
        {onViewProposal && (
          <button
            type="button"
            onClick={onViewProposal}
            className="text-sm font-medium text-amber-800 hover:text-amber-900 underline"
          >
            Voir la proposition
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm font-medium text-amber-700 hover:text-amber-900"
          >
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}
