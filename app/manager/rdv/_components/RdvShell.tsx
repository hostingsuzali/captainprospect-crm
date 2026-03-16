"use client";

import { useState, useEffect, useCallback } from "react";
import type { Meeting, ViewMode } from "../_types";
import { useMeetingFilters } from "../_hooks/useMeetingFilters";
import { useMeetings } from "../_hooks/useMeetings";
import { useMeetingActions } from "../_hooks/useMeetingActions";
import { useDetailPanel } from "../_hooks/useDetailPanel";
import { useFicheRdv } from "../_hooks/useFicheRdv";
import { useFeedback } from "../_hooks/useFeedback";
import { useNoteAutosave } from "../_hooks/useNoteAutosave";
import { CommandBar } from "./CommandBar";
import { IntelligenceStrip } from "./IntelligenceStrip";
import { FilterSidebar } from "./FilterSidebar";
import { MeetingList } from "./MeetingList";
import { CalendarView } from "./CalendarView";
import { DetailPanel } from "./DetailPanel";
import { EditContactModal } from "./modals/EditContactModal";
import { EditCompanyModal } from "./modals/EditCompanyModal";
import { LinkContactModal } from "./modals/LinkContactModal";
import { downloadCSV } from "../_lib/csv-export";
import { Download, Trash2, X } from "lucide-react";
import type { LinkContactResult } from "../_types";

const DESIGN_TOKENS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Inter:wght@300;400;500;600;700&display=swap');
:root {
  --bg: #F8F9FB;
  --surface: #FFFFFF;
  --surface2: #F1F3F7;
  --border: rgba(0,0,0,0.06);
  --border2: rgba(0,0,0,0.10);
  --ink: #111827;
  --ink2: #4B5563;
  --ink3: #9CA3AF;
  --accent: #6C63FF;
  --accentLight: rgba(108,99,255,0.08);
  --green: #059669;
  --greenLight: rgba(5,150,105,0.08);
  --amber: #D97706;
  --amberLight: rgba(217,119,6,0.08);
  --red: #DC2626;
  --redLight: rgba(220,38,38,0.06);
  --blue: #2563EB;
  --blueLight: rgba(37,99,235,0.07);
}
`;

const GLOBAL_CSS = `
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.rdv-page { font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--ink); min-height: 100vh; display: flex; flex-direction: column; }
.rdv-serif { font-family: 'DM Sans','Inter',system-ui,sans-serif; font-weight: 600; }
.rdv-row:hover .rdv-row-actions { opacity: 1; }
.rdv-row:hover { background: var(--surface2) !important; }
.rdv-checkbox { appearance: none; width: 18px; height: 18px; border: 1.5px solid var(--border2); border-radius: 5px; background: var(--surface); cursor: pointer; display: grid; place-content: center; transition: all 0.15s; }
.rdv-checkbox:checked { background: var(--accent); border-color: var(--accent); }
.rdv-checkbox:checked::after { content: '✓'; color: white; font-size: 12px; font-weight: 600; }
.rdv-scrollbar::-webkit-scrollbar { width: 6px; }
.rdv-scrollbar::-webkit-scrollbar-track { background: transparent; }
.rdv-scrollbar::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
.rdv-input { background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; color: var(--ink); padding: 10px 14px; font-size: 13px; outline: none; transition: all 0.15s; font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
.rdv-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accentLight); }
.rdv-input::placeholder { color: var(--ink3); }
.rdv-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: none; font-family: 'DM Sans', sans-serif; }
.rdv-btn-primary { background: var(--accent); color: white; }
.rdv-btn-primary:hover { filter: brightness(1.08); box-shadow: 0 2px 8px rgba(108,99,255,0.25); }
.rdv-btn-ghost { background: var(--surface); color: var(--ink2); border: 1px solid var(--border2); }
.rdv-btn-ghost:hover { background: var(--surface2); color: var(--ink); border-color: var(--ink3); }
.rdv-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap; }
.rdv-metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 22px 24px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
.rdv-metric-card:hover { border-color: var(--border2); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.rdv-metric-card.active { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accentLight), 0 4px 16px rgba(108,99,255,0.1); }
.rdv-panel { position: fixed; top: 0; right: 0; width: 480px; height: 100vh; background: var(--surface); border-left: 1px solid var(--border); z-index: 50; transform: translateX(100%); transition: transform 0.35s cubic-bezier(0.16,1,0.3,1); overflow-y: auto; box-shadow: -8px 0 32px rgba(0,0,0,0.06); }
.rdv-panel.open { transform: translateX(0); }
.rdv-tab { padding: 10px 18px; font-size: 13px; font-weight: 500; color: var(--ink3); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; background: none; border-top: none; border-left: none; border-right: none; font-family: 'DM Sans', sans-serif; }
.rdv-tab:hover { color: var(--ink2); }
.rdv-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.rdv-board-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; }
.rdv-board-card:hover { border-color: var(--border2); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
`;

export function RdvShell() {
  const [view, setView] = useState<ViewMode>("list");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const filters = useMeetingFilters();
  const { meetings, aggregates, loading, loadingMore, fetchMeetings, loadMore, listRef } = useMeetings(filters);
  const { updateMeeting, deleteMeetings } = useMeetingActions(() => fetchMeetings());

  const panelState = useDetailPanel();
  const ficheState = useFicheRdv(updateMeeting);
  const feedbackState = useFeedback();
  const noteState = useNoteAutosave();

  const [meetings2, setMeetings2] = useState<Meeting[]>([]);
  useEffect(() => { setMeetings2(meetings); }, [meetings]);

  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [linkContactOpen, setLinkContactOpen] = useState(false);

  // Fetch on filter change
  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  // ESC closes panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && panelState.panelOpen) panelState.closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelState]);

  const handleOpenPanel = useCallback(
    (m: Meeting) => {
      panelState.openPanel(m, meetings2);
      ficheState.initFiche(m);
      feedbackState.initFeedback(m);
      noteState.initNote("");
    },
    [panelState, ficheState, feedbackState, noteState, meetings2]
  );

  const handleContactSaved = useCallback(
    (patch: { firstName: string | null; lastName: string | null; title: string | null; email: string | null; phone: string | null; linkedin: string | null }) => {
      if (!panelState.selectedMeeting?.contact) return;
      panelState.setSelectedMeeting((prev) =>
        prev && prev.contact ? { ...prev, contact: { ...prev.contact, ...patch } } : prev
      );
      setMeetings2((prev) =>
        prev.map((m) =>
          m.id === panelState.selectedMeeting?.id && m.contact ? { ...m, contact: { ...m.contact, ...patch } } : m
        )
      );
    },
    [panelState]
  );

  const handleCompanySaved = useCallback(
    (patch: { name: string; industry: string | null; country: string | null; size: string | null; website: string | null; phone: string | null }) => {
      if (!panelState.selectedMeeting?.company) return;
      panelState.setSelectedMeeting((prev) =>
        prev && prev.company ? { ...prev, company: { ...prev.company, ...patch } } : prev
      );
      setMeetings2((prev) =>
        prev.map((m) =>
          m.id === panelState.selectedMeeting?.id && m.company ? { ...m, company: { ...m.company, ...patch } } : m
        )
      );
    },
    [panelState]
  );

  const handleContactLinked = useCallback(
    (c: LinkContactResult) => {
      const contactPatch = {
        id: c.id,
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        title: c.title ?? null,
        linkedin: null,
        customData: null,
      };
      const companyData = c.company
        ? { id: c.company.id, name: c.company.name, industry: null, country: null, size: null, website: null, phone: null }
        : null;
      panelState.setSelectedMeeting((prev) =>
        prev ? { ...prev, contact: contactPatch, company: companyData } : null
      );
      setMeetings2((prev) =>
        prev.map((m) =>
          m.id === panelState.selectedMeeting?.id ? { ...m, contact: contactPatch, company: companyData } : m
        )
      );
    },
    [panelState]
  );

  const handleDelete = useCallback(async () => {
    await deleteMeetings(Array.from(panelState.selectedIds));
    panelState.clearSelection();
  }, [deleteMeetings, panelState]);

  return (
    <>
      <style>{DESIGN_TOKENS}{GLOBAL_CSS}</style>
      <div className="rdv-page">
        <CommandBar view={view} setView={setView} filters={filters} meetings={meetings2} />

        <IntelligenceStrip
          aggregates={aggregates}
          loading={loading}
          statusFilter={filters.statusFilter}
          datePreset={filters.datePreset}
          onSetStatusFilter={filters.setStatusFilter}
          onSetDatePreset={filters.setDatePreset}
        />

        <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
          <FilterSidebar
            filters={filters}
            sidebarOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onOpen={() => setSidebarOpen(true)}
          />

          <div
            style={{
              flex: 1, overflow: "hidden", display: "flex", flexDirection: "column",
              transition: "margin-right 0.35s cubic-bezier(0.16,1,0.3,1)",
              marginRight: panelState.panelOpen ? 480 : 0,
            }}
          >
            {view === "list" && (
              <MeetingList
                meetings={meetings2}
                loading={loading}
                loadingMore={loadingMore}
                listRef={listRef}
                selectedIds={panelState.selectedIds}
                onToggleSelect={panelState.toggleSelect}
                onToggleSelectAll={() => panelState.toggleSelectAll(meetings2)}
                onOpen={handleOpenPanel}
                onLoadMore={loadMore}
              />
            )}
            {view === "calendar" && (
              <CalendarView
                meetings={meetings2}
                openPanel={handleOpenPanel}
                updateMeeting={updateMeeting}
                setMeetings={setMeetings2}
              />
            )}
          </div>

          <DetailPanel
            panelState={panelState}
            ficheState={ficheState}
            feedbackState={feedbackState}
            noteState={noteState}
            updateMeeting={updateMeeting}
            onOpenEditContact={() => setEditContactOpen(true)}
            onOpenEditCompany={() => setEditCompanyOpen(true)}
            onOpenLinkContact={() => setLinkContactOpen(true)}
            onSetMeetings={setMeetings2}
          />
        </div>

        {/* Bulk actions bar */}
        {panelState.selectedIds.size > 0 && (
          <div
            style={{
              position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
              background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 16,
              padding: "12px 24px", display: "flex", alignItems: "center", gap: 14, zIndex: 40,
              animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              {panelState.selectedIds.size} sélectionné{panelState.selectedIds.size > 1 ? "s" : ""}
            </span>
            <div style={{ width: 1, height: 24, background: "var(--border2)" }} />
            <button
              className="rdv-btn rdv-btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => downloadCSV(meetings2.filter((m) => panelState.selectedIds.has(m.id)), "selection")}
            >
              <Download size={13} /> Exporter CSV
            </button>
            <button
              className="rdv-btn"
              style={{ fontSize: 12, background: "var(--redLight)", color: "var(--red)", border: "1px solid rgba(220,38,38,0.2)" }}
              onClick={handleDelete}
            >
              <Trash2 size={13} /> Supprimer
            </button>
            <button
              style={{ background: "var(--surface2)", border: "none", color: "var(--ink3)", cursor: "pointer", padding: 6, borderRadius: 8 }}
              onClick={() => panelState.clearSelection()}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Modals */}
        {editContactOpen && panelState.selectedMeeting?.contact && (
          <EditContactModal
            meeting={panelState.selectedMeeting}
            onClose={() => setEditContactOpen(false)}
            onSaved={handleContactSaved}
          />
        )}
        {editCompanyOpen && panelState.selectedMeeting?.company && (
          <EditCompanyModal
            meeting={panelState.selectedMeeting}
            onClose={() => setEditCompanyOpen(false)}
            onSaved={handleCompanySaved}
          />
        )}
        {linkContactOpen && panelState.selectedMeeting && (
          <LinkContactModal
            meeting={panelState.selectedMeeting}
            onClose={() => setLinkContactOpen(false)}
            onLinked={handleContactLinked}
          />
        )}
      </div>
    </>
  );
}
