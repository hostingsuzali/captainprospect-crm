"use client";

import type { MeetingFiltersState } from "../_hooks/useMeetingFilters";
import type { MeetingTypeFilter, MeetingCategoryFilter, OutcomeFilter, ConfirmationFilter, DatePreset } from "../_types";
import { Filter, ChevronLeft } from "lucide-react";
import { FilterSection } from "./shared/FilterSection";
import { FilterChip } from "./shared/FilterChip";
import { hashColor } from "../_lib/formatters";
import {
  statusLabel,
  statusBg,
  statusColor,
  confirmationLabel,
  confirmationBg,
  confirmationColor,
  categoryLabel,
  categoryBg,
  categoryColor,
  meetingTypeLabel,
} from "../_lib/formatters";

interface FilterSidebarProps {
  filters: MeetingFiltersState;
  sidebarOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

export function FilterSidebar({ filters, sidebarOpen, onClose, onOpen }: FilterSidebarProps) {
  const {
    datePreset, setDatePreset, dateFrom, setDateFrom, dateTo, setDateTo,
    clientOptions, selectedClients, setSelectedClients,
    missionOptions, selectedMissions, setSelectedMissions,
    sdrOptions, selectedSdrs, setSelectedSdrs,
    confirmationFilter, setConfirmationFilter,
    statusFilter, setStatusFilter,
    selectedMeetingTypes, setSelectedMeetingTypes,
    selectedMeetingCategories, setSelectedMeetingCategories,
    selectedOutcomes, setSelectedOutcomes,
    activeFilterCount, clearAllFilters,
    search, setSearch,
  } = filters;

  if (!sidebarOpen) {
    return (
      <button
        onClick={onOpen}
        style={{
          position: "absolute", left: 0, top: 16, zIndex: 10,
          background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "none",
          borderRadius: "0 10px 10px 0", padding: "10px 8px", color: "var(--ink3)", cursor: "pointer",
          boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
        }}
      >
        <Filter size={14} />
        {activeFilterCount > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, background: "var(--accent)", color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "grid", placeContent: "center" }}>
            {activeFilterCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className="rdv-scrollbar"
      style={{
        width: 290, flexShrink: 0, borderRight: "1px solid var(--border)",
        background: "var(--surface)", overflowY: "auto", padding: "20px",
        display: "flex", flexDirection: "column", gap: 24,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
          <Filter size={15} />
          Filtres
          {activeFilterCount > 0 && (
            <span style={{ background: "var(--accent)", color: "white", borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
              {activeFilterCount}
            </span>
          )}
        </span>
        <button style={{ background: "none", border: "none", color: "var(--ink3)", cursor: "pointer" }} onClick={onClose}>
          <ChevronLeft size={16} />
        </button>
      </div>

      <FilterSection title="Période">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {([["today", "Aujourd'hui"], ["7days", "7 jours"], ["30days", "30 jours"], ["3months", "3 mois"], ["custom", "Personnalisée"]] as [DatePreset, string][]).map(([key, label]) => (
            <button
              key={key}
              className="rdv-btn"
              style={{
                padding: "5px 12px", fontSize: 12, borderRadius: 8,
                background: datePreset === key ? "var(--accentLight)" : "var(--surface2)",
                color: datePreset === key ? "var(--accent)" : "var(--ink2)",
                border: `1px solid ${datePreset === key ? "var(--accent)" : "transparent"}`,
                fontWeight: datePreset === key ? 600 : 400,
              }}
              onClick={() => setDatePreset(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {datePreset === "custom" && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input type="date" className="rdv-input" style={{ flex: 1, fontSize: 12, padding: "8px 10px" }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" className="rdv-input" style={{ flex: 1, fontSize: 12, padding: "8px 10px" }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        )}
      </FilterSection>

      <FilterSection title="Clients">
        {clientOptions.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--ink3)", padding: "4px 0" }}>Aucun client</div>
        ) : (
          <>
            <button
              style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
              onClick={() => {
                if (selectedClients.size === clientOptions.length) setSelectedClients(new Set());
                else setSelectedClients(new Set(clientOptions.map((c) => c.id)));
              }}
            >
              {selectedClients.size === clientOptions.length ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
            {clientOptions.map((c) => (
              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink2)", cursor: "pointer", padding: "5px 0" }}>
                <input type="checkbox" className="rdv-checkbox" checked={selectedClients.has(c.id)} onChange={() => {
                  setSelectedClients((prev) => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; });
                }} />
                <span style={{ flex: 1 }}>{c.name}</span>
              </label>
            ))}
          </>
        )}
      </FilterSection>

      <FilterSection title="Missions">
        {missionOptions.map((m) => (
          <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink2)", cursor: "pointer", padding: "5px 0" }}>
            <input type="checkbox" className="rdv-checkbox" checked={selectedMissions.has(m.id)} onChange={() => {
              setSelectedMissions((prev) => { const next = new Set(prev); if (next.has(m.id)) next.delete(m.id); else next.add(m.id); return next; });
            }} />
            <span style={{ flex: 1 }}>{m.name}</span>
          </label>
        ))}
      </FilterSection>

      <FilterSection title="SDRs">
        {sdrOptions.map((s) => (
          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink2)", cursor: "pointer", padding: "5px 0" }}>
            <input type="checkbox" className="rdv-checkbox" checked={selectedSdrs.has(s.id)} onChange={() => {
              setSelectedSdrs((prev) => { const next = new Set(prev); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; });
            }} />
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: hashColor(s.name), display: "grid", placeContent: "center", fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0 }}>
              {s.name.charAt(0)}
            </div>
            <span style={{ flex: 1 }}>{s.name}</span>
          </label>
        ))}
      </FilterSection>

      <FilterSection title="Confirmation">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "PENDING", "CONFIRMED", "CANCELLED"] as ConfirmationFilter[]).map((key) => (
            <button
              key={key}
              className="rdv-pill"
              style={{
                cursor: "pointer", padding: "5px 14px",
                background: confirmationFilter === key ? confirmationBg(key) : "var(--surface2)",
                color: confirmationFilter === key ? confirmationColor(key) : "var(--ink3)",
                border: `1px solid ${confirmationFilter === key ? confirmationColor(key) : "transparent"}`,
              }}
              onClick={() => setConfirmationFilter(key)}
            >
              {confirmationLabel(key)}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Statut">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([["all", "Tous"], ["upcoming", "À venir"], ["past", "Passés"], ["cancelled", "Annulés"]] as const).map(([key, label]) => (
            <button
              key={key}
              className="rdv-pill"
              style={{
                cursor: "pointer", padding: "5px 14px",
                background: statusFilter === key ? statusBg(key === "all" ? "upcoming" : key) : "var(--surface2)",
                color: statusFilter === key ? statusColor(key === "all" ? "upcoming" : key) : "var(--ink3)",
                border: `1px solid ${statusFilter === key ? statusColor(key === "all" ? "upcoming" : key) : "transparent"}`,
              }}
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Type">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([["VISIO", "📹 Visio"], ["PHYSIQUE", "📍 Physique"], ["TELEPHONIQUE", "📞 Téléphonique"]] as [MeetingTypeFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              className="rdv-pill"
              style={{
                cursor: "pointer", padding: "5px 14px",
                background: selectedMeetingTypes.has(key) ? "var(--accentLight)" : "var(--surface2)",
                color: selectedMeetingTypes.has(key) ? "var(--accent)" : "var(--ink3)",
                border: `1px solid ${selectedMeetingTypes.has(key) ? "var(--accent)" : "transparent"}`,
              }}
              onClick={() => setSelectedMeetingTypes((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; })}
            >
              {label}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Catégorie">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([["EXPLORATOIRE", "Exploratoire"], ["BESOIN", "Besoin"]] as [MeetingCategoryFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              className="rdv-pill"
              style={{
                cursor: "pointer", padding: "5px 14px",
                background: selectedMeetingCategories.has(key) ? categoryBg(key) : "var(--surface2)",
                color: selectedMeetingCategories.has(key) ? categoryColor(key) : "var(--ink3)",
                border: `1px solid ${selectedMeetingCategories.has(key) ? categoryColor(key) : "transparent"}`,
              }}
              onClick={() => setSelectedMeetingCategories((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; })}
            >
              {label}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Feedback">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([["POSITIVE", "Positif"], ["NEUTRAL", "Neutre"], ["NEGATIVE", "Négatif"], ["NO_SHOW", "Absent"], ["NONE", "Sans retour"]] as [OutcomeFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              className="rdv-pill"
              style={{
                cursor: "pointer", padding: "5px 14px",
                background: selectedOutcomes.has(key) ? "var(--accentLight)" : "var(--surface2)",
                color: selectedOutcomes.has(key) ? "var(--accent)" : "var(--ink3)",
                border: `1px solid ${selectedOutcomes.has(key) ? "var(--accent)" : "transparent"}`,
              }}
              onClick={() => setSelectedOutcomes((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; })}
            >
              {label}
            </button>
          ))}
        </div>
      </FilterSection>

      {activeFilterCount > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 500 }}>Filtres actifs</span>
            <button style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }} onClick={clearAllFilters}>
              Tout effacer
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {search && <FilterChip label={`"${search}"`} onRemove={() => setSearch("")} />}
            {statusFilter !== "all" && <FilterChip label={statusLabel(statusFilter)} onRemove={() => setStatusFilter("all")} />}
            {confirmationFilter !== "all" && <FilterChip label={confirmationLabel(confirmationFilter)} onRemove={() => setConfirmationFilter("all")} />}
            {Array.from(selectedClients).map((id) => {
              const c = clientOptions.find((o) => o.id === id);
              return c ? <FilterChip key={id} label={c.name} onRemove={() => setSelectedClients((p) => { const n = new Set(p); n.delete(id); return n; })} /> : null;
            })}
            {Array.from(selectedMeetingTypes).map((t) => (
              <FilterChip key={t} label={meetingTypeLabel(t)} onRemove={() => setSelectedMeetingTypes((p) => { const n = new Set(p); n.delete(t); return n; })} />
            ))}
            {Array.from(selectedMeetingCategories).map((c) => (
              <FilterChip key={c} label={categoryLabel(c)} onRemove={() => setSelectedMeetingCategories((p) => { const n = new Set(p); n.delete(c); return n; })} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
