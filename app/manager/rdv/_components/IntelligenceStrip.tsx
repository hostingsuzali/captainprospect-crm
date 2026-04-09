"use client";

import { memo } from "react";
import type { Aggregates } from "../_types";
import type { StatusFilter, DatePreset } from "../_types";
import { Skeleton } from "./shared/Skeleton";
import { AnimatedNumber } from "./shared/AnimatedNumber";

interface IntelligenceStripProps {
  aggregates: Aggregates | null;
  loading: boolean;
  statusFilter: StatusFilter;
  datePreset: DatePreset;
  onSetStatusFilter: (v: StatusFilter) => void;
  onSetDatePreset: (v: DatePreset) => void;
}

export const IntelligenceStrip = memo(function IntelligenceStrip({
  aggregates,
  loading,
  statusFilter,
  datePreset,
  onSetStatusFilter,
  onSetDatePreset,
}: IntelligenceStripProps) {
  const cards: { label: string; value: number; color: string; suffix?: string; active: boolean; interactive?: boolean; onClick: () => void }[] = [
    {
      label: "Total RDV",
      value: aggregates?.totalCount ?? 0,
      color: "var(--accent)",
      active: statusFilter === "all",
      interactive: true,
      onClick: () => onSetStatusFilter("all"),
    },
    {
      label: "À venir",
      value: aggregates?.upcomingCount ?? 0,
      color: "var(--green)",
      active: statusFilter === "upcoming",
      interactive: true,
      onClick: () => onSetStatusFilter(statusFilter === "upcoming" ? "all" : "upcoming"),
    },
    {
      label: "Taux de conversion",
      value: aggregates?.conversionRate ?? 0,
      color: "var(--blue)",
      suffix: "%",
      active: false,
      interactive: false,
      onClick: () => {},
    },
    {
      label: "Moy. par SDR",
      value: aggregates?.avgPerSdr ?? 0,
      color: "var(--amber)",
      active: false,
      interactive: false,
      onClick: () => {},
    },
    {
      label: "Cette semaine",
      value: aggregates?.meetingsThisWeek ?? 0,
      color: "var(--accent)",
      active: datePreset === "7days",
      interactive: true,
      onClick: () => onSetDatePreset("7days"),
    },
  ];

  return (
    <div style={{ display: "flex", gap: 16, padding: "20px 32px", flexShrink: 0, overflowX: "auto" }}>
      {loading
        ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ flex: 1, minWidth: 200 }}>
              <Skeleton w="100%" h={100} r={16} />
            </div>
          ))
        : cards.map((card) => (
            <div
              key={card.label}
              className={`rdv-metric-card ${card.active ? "active" : ""}`}
              style={{
                flex: 1, minWidth: 200,
                cursor: card.interactive !== false ? "pointer" : "default",
                ...(card.interactive === false ? { pointerEvents: "none" as const } : {}),
              }}
              onClick={card.interactive !== false ? card.onClick : undefined}
            >
              <div style={{ position: "absolute", left: 0, top: 16, bottom: 16, width: 4, borderRadius: "0 3px 3px 0", background: card.color }} />
              <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                <AnimatedNumber value={card.value} />
                {card.suffix || ""}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 6, fontWeight: 500 }}>{card.label}</div>
            </div>
          ))}
    </div>
  );
});
