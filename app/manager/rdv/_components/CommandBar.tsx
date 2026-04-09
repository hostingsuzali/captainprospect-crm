"use client";

import { memo, useState } from "react";
import type { Meeting } from "../_types";
import type { MeetingFiltersState } from "../_hooks/useMeetingFilters";
import type { ViewMode, DatePreset } from "../_types";
import { SearchInput } from "./shared/SearchInput";
import { downloadCSV } from "../_lib/csv-export";
import { List, CalendarDays, Download, Plus, Upload } from "lucide-react";
import { AddRdvModal } from "./modals/AddRdvModal";
import { ImportRdvModal } from "./modals/ImportRdvModal";

interface CommandBarProps {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  filters: MeetingFiltersState;
  meetings: Meeting[];
  onRefresh?: () => void;
}

export const CommandBar = memo(function CommandBar({ view, setView, filters, meetings, onRefresh }: CommandBarProps) {
  const { search, setSearch, datePreset, setDatePreset, filterSummary } = filters;
  const [addRdvOpen, setAddRdvOpen] = useState(false);
  const [importRdvOpen, setImportRdvOpen] = useState(false);

  return (
    <div
      style={{
        height: 64, background: "var(--surface)", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", padding: "0 32px", gap: 20,
        flexShrink: 0, zIndex: 30,
      }}
    >
      <h1 className="rdv-serif" style={{ fontSize: 26, color: "var(--ink)", margin: 0, whiteSpace: "nowrap" }}>
        SAS RDV
      </h1>

      <SearchInput initialSearch={search} onDebouncedSearch={setSearch} />

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* View toggle */}
        <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 10, overflow: "hidden", padding: 2 }}>
          {([["list", List], ["calendar", CalendarDays]] as const).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                background: view === v ? "var(--surface)" : "transparent",
                color: view === v ? "var(--accent)" : "var(--ink3)",
                border: "none", padding: "7px 11px", cursor: "pointer",
                display: "flex", alignItems: "center", transition: "all 0.15s",
                borderRadius: 8, boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>

        {/* Date presets */}
        <div style={{ display: "flex", gap: 4 }}>
          {([["today", "Aujourd'hui"], ["7days", "7j"], ["30days", "30j"], ["3months", "3m"]] as [DatePreset, string][]).map(([key, label]) => (
            <button
              key={key}
              className="rdv-btn"
              style={{
                padding: "6px 12px", fontSize: 12, borderRadius: 8,
                background: datePreset === key ? "var(--accentLight)" : "transparent",
                color: datePreset === key ? "var(--accent)" : "var(--ink3)",
                border: "none",
                fontWeight: datePreset === key ? 600 : 400,
              }}
              onClick={() => setDatePreset(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <button className="rdv-btn rdv-btn-ghost" onClick={() => setAddRdvOpen(true)}>
          <Plus size={14} /> Ajouter un RDV
        </button>
        <button className="rdv-btn rdv-btn-ghost" onClick={() => setImportRdvOpen(true)}>
          <Upload size={14} /> Importer des RDV
        </button>
        <button className="rdv-btn rdv-btn-ghost" onClick={() => downloadCSV(meetings, filterSummary)}>
          <Download size={14} /> Exporter
        </button>
      </div>

      <AddRdvModal
        isOpen={addRdvOpen}
        onClose={() => setAddRdvOpen(false)}
        onSuccess={() => onRefresh?.()}
      />
      <ImportRdvModal
        isOpen={importRdvOpen}
        onClose={() => setImportRdvOpen(false)}
        onSuccess={() => onRefresh?.()}
      />
    </div>
  );
});
