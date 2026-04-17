"use client";

import { useState, useEffect, useCallback } from "react";
import type { Meeting, ViewMode } from "../_types";
import { useMeetingFilters } from "../_hooks/useMeetingFilters";
import { useMeetings } from "../_hooks/useMeetings";
import { useMeetingActions } from "../_hooks/useMeetingActions";
import { useDetailPanel } from "../_hooks/useDetailPanel";
import { useFicheRdv } from "../_hooks/useFicheRdv";
import { useFeedback } from "../_hooks/useFeedback";
import { CommandBar } from "./CommandBar";
import { IntelligenceStrip } from "./IntelligenceStrip";
import { FilterSidebar } from "./FilterSidebar";
import { MeetingList } from "./MeetingList";
import { CalendarView } from "./CalendarView";
import { DetailPanel } from "./DetailPanel";
import { EditContactModal } from "./modals/EditContactModal";
import { EditCompanyModal } from "./modals/EditCompanyModal";
import { LinkContactModal } from "./modals/LinkContactModal";
import { SyncRdvAudiosModal } from "./modals/SyncRdvAudiosModal";
import { downloadCSV } from "../_lib/csv-export";
import { Download, Trash2, X, Check, XCircle, AlertTriangle } from "lucide-react";
import type { LinkContactResult } from "../_types";
import "./rdv-shell.css";

type ModalType = "editContact" | "editCompany" | "linkContact" | "deleteConfirm" | null;

export function RdvShell() {
  const [view, setView] = useState<ViewMode>("list");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const filters = useMeetingFilters();
  const {
    meetings,
    aggregates,
    loading,
    loadingMore,
    fetchMeetings,
    loadMore,
    updateLocalMeeting,
    updateLocalMeetings,
    listRef,
  } = useMeetings(filters);
  const { updateMeeting, deleteMeetings } = useMeetingActions(() => fetchMeetings());

  const panelState = useDetailPanel();
  const ficheState = useFicheRdv(updateMeeting);
  const feedbackState = useFeedback();

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [syncAudiosOpen, setSyncAudiosOpen] = useState(false);

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

  // Arrow key navigation while panel is open
  useEffect(() => {
    if (!panelState.panelOpen || !panelState.selectedMeeting) return;
    const onNavigate = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const idx = meetings.findIndex((m) => m.id === panelState.selectedMeeting?.id);
      if (idx === -1) return;
      const nextIdx = e.key === "ArrowDown" ? Math.min(meetings.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (nextIdx === idx) return;
      e.preventDefault();
      panelState.openPanel(meetings[nextIdx], meetings);
    };
    window.addEventListener("keydown", onNavigate);
    return () => window.removeEventListener("keydown", onNavigate);
  }, [panelState, meetings]);

  const handleOpenPanel = useCallback((m: Meeting) => {
    panelState.openPanel(m, meetings);
  }, [panelState, meetings]);

  useEffect(() => {
    if (!panelState.selectedMeeting) return;
    const resolved = panelState.selectedMeeting;
    ficheState.initFiche(resolved);
    feedbackState.initFeedback(resolved);
  }, [panelState.selectedMeeting?.id, ficheState.initFiche, feedbackState.initFeedback]);

  const handleContactSaved = useCallback(
    (patch: { firstName: string | null; lastName: string | null; title: string | null; email: string | null; phone: string | null; linkedin: string | null }) => {
      if (!panelState.selectedMeeting?.contact) return;
      panelState.setSelectedMeeting((prev) =>
        prev && prev.contact ? { ...prev, contact: { ...prev.contact, ...patch } } : prev
      );
      const selectedId = panelState.selectedMeeting.id;
      updateLocalMeetings((prev) =>
        prev.map((m) => (m.id === selectedId && m.contact ? { ...m, contact: { ...m.contact, ...patch } } : m))
      );
    },
    [panelState, updateLocalMeetings]
  );

  const handleCompanySaved = useCallback(
    (patch: { name: string; industry: string | null; country: string | null; size: string | null; website: string | null; phone: string | null }) => {
      if (!panelState.selectedMeeting?.company) return;
      panelState.setSelectedMeeting((prev) =>
        prev && prev.company ? { ...prev, company: { ...prev.company, ...patch } } : prev
      );
      const selectedId = panelState.selectedMeeting.id;
      updateLocalMeetings((prev) =>
        prev.map((m) => (m.id === selectedId && m.company ? { ...m, company: { ...m.company, ...patch } } : m))
      );
    },
    [panelState, updateLocalMeetings]
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
      const selectedId = panelState.selectedMeeting?.id;
      if (!selectedId) return;
      updateLocalMeeting(selectedId, { contact: contactPatch, company: companyData });
    },
    [panelState, updateLocalMeeting]
  );

  const handleDelete = useCallback(async () => {
    await deleteMeetings(Array.from(panelState.selectedIds));
    panelState.clearSelection();
    setDeleteConfirmInput("");
    setActiveModal(null);
  }, [deleteMeetings, panelState]);

  const handleBulkConfirm = useCallback(async () => {
    setBulkConfirming(true);
    const ids = Array.from(panelState.selectedIds);
    const confirmedAt = new Date().toISOString();
    ids.forEach((id) => {
      updateLocalMeeting(id, { confirmationStatus: "CONFIRMED", confirmedAt });
    });
    await Promise.all(ids.map((id) => updateMeeting(id, { confirmationStatus: "CONFIRMED" })));
    panelState.clearSelection();
    setBulkConfirming(false);
  }, [panelState, updateMeeting, updateLocalMeeting]);

  const handleBulkCancel = useCallback(async () => {
    setBulkCancelling(true);
    const ids = Array.from(panelState.selectedIds);
    ids.forEach((id) => {
      updateLocalMeeting(id, { confirmationStatus: "CANCELLED", confirmedAt: null, confirmedById: null });
    });
    await Promise.all(ids.map((id) => updateMeeting(id, { confirmationStatus: "CANCELLED" })));
    panelState.clearSelection();
    setBulkCancelling(false);
  }, [panelState, updateMeeting, updateLocalMeeting]);

  const selectedMeetings = meetings.filter((m) => panelState.selectedIds.has(m.id));
  const deleteGuardToken = `DELETE ${panelState.selectedIds.size}`;
  const requiresDeleteGuard = panelState.selectedIds.size > 5;
  const deleteAllowed = !requiresDeleteGuard || deleteConfirmInput.trim().toUpperCase() === deleteGuardToken;

  return (
      <div className="rdv-page">
        <CommandBar
          view={view}
          setView={setView}
          filters={filters}
          meetings={meetings}
          onRefresh={() => fetchMeetings()}
          onOpenSyncAudios={() => setSyncAudiosOpen(true)}
        />

        <IntelligenceStrip
          aggregates={aggregates}
          loading={loading}
          statusFilter={filters.statusFilter}
          datePreset={filters.datePreset}
          onSetStatusFilter={filters.setStatusFilter}
          onSetDatePreset={filters.setDatePreset}
        />

        <div className={`rdv-content-layout ${panelState.panelOpen ? "panel-open" : ""}`}>
          <FilterSidebar
            filters={filters}
            sidebarOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onOpen={() => setSidebarOpen(true)}
          />

          <div className="rdv-main-column">
            {view === "list" && (
              <MeetingList
                meetings={meetings}
                loading={loading}
                loadingMore={loadingMore}
                listRef={listRef}
                selectedIds={panelState.selectedIds}
                onToggleSelect={panelState.toggleSelect}
                onToggleSelectAll={() => panelState.toggleSelectAll(meetings)}
                onOpen={handleOpenPanel}
                onLoadMore={loadMore}
                updateMeeting={updateMeeting}
                updateLocalMeeting={updateLocalMeeting}
              />
            )}
            {view === "calendar" && (
              <CalendarView
                meetings={meetings}
                openPanel={handleOpenPanel}
                updateMeeting={updateMeeting}
                updateLocalMeeting={updateLocalMeeting}
              />
            )}
          </div>

          <DetailPanel
            panelState={panelState}
            ficheState={ficheState}
            feedbackState={feedbackState}
            updateMeeting={updateMeeting}
            onOpenEditContact={() => setActiveModal("editContact")}
            onOpenEditCompany={() => setActiveModal("editCompany")}
            onOpenLinkContact={() => setActiveModal("linkContact")}
            updateLocalMeeting={updateLocalMeeting}
          />
        </div>

        {/* Bulk actions bar */}
        {panelState.selectedIds.size > 0 && (
          <div
            style={{
              borderRadius: 16,
              padding: "12px 24px", display: "flex", alignItems: "center", gap: 14, zIndex: 40,
              animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
            }}
            className="bulk-action-bar"
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              {panelState.selectedIds.size} sélectionné{panelState.selectedIds.size > 1 ? "s" : ""}
            </span>
            <div style={{ width: 1, height: 24, background: "var(--border2)" }} />
            <button
              className="rdv-btn"
              style={{ fontSize: 12, background: "var(--greenLight)", color: "var(--green)", border: "1px solid rgba(5,150,105,0.2)" }}
              onClick={handleBulkConfirm}
              disabled={bulkConfirming}
            >
              <Check size={13} /> {bulkConfirming ? "Confirmation…" : "Confirmer"}
            </button>
            <button
              className="rdv-btn"
              style={{ fontSize: 12, background: "var(--amberLight)", color: "var(--amber)", border: "1px solid rgba(217,119,6,0.2)" }}
              onClick={handleBulkCancel}
              disabled={bulkCancelling}
            >
              <XCircle size={13} /> {bulkCancelling ? "Annulation…" : "Annuler"}
            </button>
            <button
              className="rdv-btn rdv-btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => downloadCSV(selectedMeetings, "selection")}
            >
              <Download size={13} /> Exporter CSV
            </button>
            <button
              className="rdv-btn"
              style={{ fontSize: 12, background: "var(--redLight)", color: "var(--red)", border: "1px solid rgba(220,38,38,0.2)" }}
              onClick={() => setActiveModal("deleteConfirm")}
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

        {/* Delete confirmation dialog */}
        {activeModal === "deleteConfirm" && (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
            }}
            onClick={() => {
              setActiveModal(null);
              setDeleteConfirmInput("");
            }}
          >
            <div
              style={{
                background: "var(--surface)", borderRadius: 16, padding: 28,
                maxWidth: 440, width: "100%", boxShadow: "0 24px 48px rgba(0,0,0,0.15)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--redLight)", display: "grid", placeContent: "center" }}>
                  <AlertTriangle size={20} style={{ color: "var(--red)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Confirmer la suppression</div>
                  <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 2 }}>Cette action est irréversible.</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "var(--ink2)", marginBottom: 24, lineHeight: 1.5 }}>
                Vous allez supprimer <strong>{panelState.selectedIds.size}</strong> rendez-vous sélectionné{panelState.selectedIds.size > 1 ? "s" : ""}.
                Cette action ne peut pas être annulée.
              </p>
              <div
                className="rdv-scrollbar"
                style={{
                  maxHeight: 140,
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--surface2)",
                  padding: "8px 10px",
                  marginBottom: 14,
                }}
              >
                {selectedMeetings.slice(0, 20).map((m) => (
                  <div key={m.id} style={{ fontSize: 12, color: "var(--ink2)", padding: "4px 0" }}>
                    {(m.contact?.firstName || m.contact?.lastName)
                      ? `${m.contact?.firstName ?? ""} ${m.contact?.lastName ?? ""}`.trim()
                      : m.company?.name || "Meeting sans contact"} - {m.company?.name || "Sans entreprise"}
                  </div>
                ))}
                {selectedMeetings.length > 20 && (
                  <div style={{ fontSize: 12, color: "var(--ink3)", paddingTop: 4 }}>
                    +{selectedMeetings.length - 20} autres
                  </div>
                )}
              </div>
              {requiresDeleteGuard && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 6 }}>
                    Tapez <strong>{deleteGuardToken}</strong> pour confirmer.
                  </div>
                  <input
                    className="rdv-input"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder={deleteGuardToken}
                    autoFocus
                  />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  className="rdv-btn rdv-btn-ghost"
                  onClick={() => {
                    setActiveModal(null);
                    setDeleteConfirmInput("");
                  }}
                >
                  Annuler
                </button>
                <button
                  className="rdv-btn"
                  style={{ background: "var(--red)", color: "white" }}
                  onClick={handleDelete}
                  disabled={!deleteAllowed}
                >
                  <Trash2 size={13} /> Supprimer définitivement
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {activeModal === "editContact" && panelState.selectedMeeting?.contact && (
          <EditContactModal
            meeting={panelState.selectedMeeting}
            onClose={() => setActiveModal(null)}
            onSaved={handleContactSaved}
          />
        )}
        {activeModal === "editCompany" && panelState.selectedMeeting?.company && (
          <EditCompanyModal
            meeting={panelState.selectedMeeting}
            onClose={() => setActiveModal(null)}
            onSaved={handleCompanySaved}
          />
        )}
        {activeModal === "linkContact" && panelState.selectedMeeting && (
          <LinkContactModal
            meeting={panelState.selectedMeeting}
            onClose={() => setActiveModal(null)}
            onLinked={handleContactLinked}
          />
        )}
        <SyncRdvAudiosModal
          isOpen={syncAudiosOpen}
          onClose={() => setSyncAudiosOpen(false)}
          meetings={meetings}
          selectedIds={panelState.selectedIds}
          onSynced={async () => {
            await fetchMeetings();
          }}
        />
      </div>
  );
}
