"use client";

import type { Meeting, PanelTab } from "../../_types";
import {
  statusBg,
  statusColor,
  statusLabel,
  meetingStatus,
  confirmationBg,
  confirmationColor,
  confirmationLabel,
  meetingTypeIcon,
  meetingTypeLabel,
  categoryBg,
  categoryColor,
  categoryLabel,
} from "../../_lib/formatters";
import type { ConfirmationFilter } from "../../_types";
import { Avatar } from "../shared/Avatar";
import { X, Check, Mail, Phone, Linkedin, FileText, ThumbsUp, MessageSquare, History, CalendarPlus } from "lucide-react";
import { downloadICS, proximityLabel } from "../../_lib/formatters";
import { DetailTab } from "./DetailTab";
import { FicheTab } from "./FicheTab";
import { FeedbackTab } from "./FeedbackTab";
import { NoteTab } from "./NoteTab";
import { HistoryTab } from "./HistoryTab";
import type { UseDetailPanelReturn } from "../../_hooks/useDetailPanel";
import type { UseFicheRdvReturn } from "../../_hooks/useFicheRdv";
import type { UseFeedbackReturn } from "../../_hooks/useFeedback";
import type { UseNoteAutosaveReturn } from "../../_hooks/useNoteAutosave";
import { contactName } from "../../_lib/formatters";

interface DetailPanelProps {
  panelState: UseDetailPanelReturn;
  ficheState: UseFicheRdvReturn;
  feedbackState: UseFeedbackReturn;
  noteState: UseNoteAutosaveReturn;
  updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>;
  onOpenEditContact: () => void;
  onOpenEditCompany: () => void;
  onOpenLinkContact: () => void;
  updateLocalMeeting: (id: string, patch: Partial<Meeting>) => void;
}

const TABS: { key: PanelTab; label: string; Icon: typeof FileText }[] = [
  { key: "detail", label: "Détail", Icon: FileText },
  { key: "fiche", label: "Fiche RDV", Icon: FileText },
  { key: "feedback", label: "Feedback", Icon: ThumbsUp },
  { key: "note", label: "Note interne", Icon: MessageSquare },
  { key: "history", label: "Historique", Icon: History },
];

export function DetailPanel({
  panelState,
  ficheState,
  feedbackState,
  noteState,
  updateMeeting,
  onOpenEditContact,
  onOpenEditCompany,
  onOpenLinkContact,
  updateLocalMeeting,
}: DetailPanelProps) {
  const { selectedMeeting, setSelectedMeeting, panelOpen, panelTab, setPanelTab, closePanel } = panelState;

  if (!selectedMeeting) return null;

  const status = meetingStatus(selectedMeeting);

  const handleConfirm = () => {
    updateMeeting(selectedMeeting.id, { confirmationStatus: "CONFIRMED" });
    const confirmedAt = new Date().toISOString();
    updateLocalMeeting(selectedMeeting.id, { confirmationStatus: "CONFIRMED", confirmedAt });
    setSelectedMeeting({ ...selectedMeeting, confirmationStatus: "CONFIRMED", confirmedAt });
  };

  const handleCancel = () => {
    updateMeeting(selectedMeeting.id, { confirmationStatus: "CANCELLED" });
    updateLocalMeeting(selectedMeeting.id, {
      confirmationStatus: "CANCELLED",
      confirmedAt: null,
      confirmedById: null,
    });
    setSelectedMeeting({ ...selectedMeeting, confirmationStatus: "CANCELLED", confirmedAt: null, confirmedById: null });
  };

  return (
    <div className={`rdv-panel rdv-scrollbar ${panelOpen ? "open" : ""}`}>
      <div style={{ padding: "28px 28px 0", borderBottom: "1px solid var(--border)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Avatar name={contactName(selectedMeeting.contact)} size={60} />
            <div>
              <div className="rdv-serif" style={{ fontSize: 22, color: "var(--ink)" }}>
                {contactName(selectedMeeting.contact)}
              </div>
              <div style={{ fontSize: 14, color: "var(--ink2)", marginTop: 2 }}>
                {selectedMeeting.contact?.title || "—"} · {selectedMeeting.company?.name || "—"}
              </div>
            </div>
          </div>
          <button
            onClick={closePanel}
            style={{ background: "var(--surface2)", border: "none", color: "var(--ink3)", cursor: "pointer", padding: 6, borderRadius: 8 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Status pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span className="status-badge" style={{ background: statusBg(status), color: statusColor(status) }}>
            {statusLabel(status)}
          </span>
          {selectedMeeting.confirmationStatus && (
            <span
              className="status-badge"
              style={{
                background: confirmationBg(selectedMeeting.confirmationStatus as ConfirmationFilter),
                color: confirmationColor(selectedMeeting.confirmationStatus as ConfirmationFilter),
              }}
            >
              {confirmationLabel(selectedMeeting.confirmationStatus as ConfirmationFilter)}
            </span>
          )}
          <span className="rdv-pill" style={{ background: "var(--surface2)", color: "var(--ink2)", padding: "4px 14px" }}>
            {meetingTypeIcon(selectedMeeting.meetingType)} {meetingTypeLabel(selectedMeeting.meetingType)}
          </span>
          {selectedMeeting.meetingCategory ? (
            <span className="rdv-pill" style={{ background: categoryBg(selectedMeeting.meetingCategory), color: categoryColor(selectedMeeting.meetingCategory), padding: "4px 14px" }}>
              {categoryLabel(selectedMeeting.meetingCategory)}
            </span>
          ) : (
            <span className="rdv-pill" style={{ background: "var(--surface2)", color: "var(--ink3)", padding: "4px 14px", opacity: 0.6 }}>
              Non classé
            </span>
          )}
        </div>

        {/* Proximity indicator */}
        {selectedMeeting.callbackDate && (() => {
          const prox = proximityLabel(selectedMeeting.callbackDate);
          return (
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: prox.color, background: `${prox.color}12`, borderRadius: 6, padding: "3px 10px" }}>
                {prox.text}
              </span>
            </div>
          );
        })()}

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {selectedMeeting.confirmationStatus !== "CONFIRMED" && (
            <button
              className="rdv-btn"
              style={{ fontSize: 12, padding: "6px 12px", background: "var(--greenLight)", color: "var(--green)", border: "1px solid rgba(5,150,105,0.2)" }}
              onClick={handleConfirm}
            >
              <Check size={13} /> Confirmer
            </button>
          )}
          {selectedMeeting.confirmationStatus !== "CANCELLED" && (
            <button
              className="rdv-btn"
              style={{ fontSize: 12, padding: "6px 12px", background: "var(--redLight)", color: "var(--red)", border: "1px solid rgba(220,38,38,0.2)" }}
              onClick={handleCancel}
            >
              <X size={13} /> Annuler
            </button>
          )}
          {selectedMeeting.contact?.email && (
            <a href={`mailto:${selectedMeeting.contact.email}`} className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px", textDecoration: "none" }}>
              <Mail size={13} /> Email
            </a>
          )}
          {selectedMeeting.contact?.phone && (
            <a href={`tel:${selectedMeeting.contact.phone}`} className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px", textDecoration: "none" }}>
              <Phone size={13} /> Appeler
            </a>
          )}
          {selectedMeeting.contact?.linkedin && (
            <a href={selectedMeeting.contact.linkedin} target="_blank" rel="noreferrer" className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px", textDecoration: "none" }}>
              <Linkedin size={13} /> LinkedIn
            </a>
          )}
          {selectedMeeting.callbackDate && (
            <button
              className="rdv-btn rdv-btn-ghost"
              style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={() => downloadICS(selectedMeeting)}
            >
              <CalendarPlus size={13} /> Exporter .ics
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "none" }}>
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`rdv-tab ${panelTab === key ? "active" : ""}`}
              onClick={() => setPanelTab(key)}
            >
              <Icon size={13} style={{ display: "inline", marginRight: 5, verticalAlign: -2 }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: 28 }}>
        {panelTab === "detail" && (
          <DetailTab
            meeting={selectedMeeting}
            setSelectedMeeting={setSelectedMeeting}
            editMode={panelState.detailEditMode}
            setEditMode={panelState.setDetailEditMode}
            detailForm={panelState.detailForm}
            setDetailForm={panelState.setDetailForm}
            detailSaving={panelState.detailSaving}
            setDetailSaving={panelState.setDetailSaving}
            updateMeeting={updateMeeting}
            updateLocalMeeting={updateLocalMeeting}
            onOpenEditContact={onOpenEditContact}
            onOpenEditCompany={onOpenEditCompany}
            onOpenLinkContact={onOpenLinkContact}
          />
        )}
        {panelTab === "fiche" && (
          <FicheTab
            meeting={selectedMeeting}
            setSelectedMeeting={setSelectedMeeting}
            ficheState={ficheState}
            updateMeeting={updateMeeting}
          />
        )}
        {panelTab === "feedback" && (
          <FeedbackTab
            meeting={selectedMeeting}
            feedbackState={feedbackState}
            updateMeeting={updateMeeting}
          />
        )}
        {panelTab === "note" && (
          <NoteTab
            meeting={selectedMeeting}
            noteState={noteState}
            updateMeeting={updateMeeting}
          />
        )}
        {panelTab === "history" && (
          <HistoryTab meeting={selectedMeeting} />
        )}
      </div>
    </div>
  );
}
