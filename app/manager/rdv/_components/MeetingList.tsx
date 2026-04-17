"use client";

import { memo, useEffect, useState } from "react";
import type { Meeting } from "../_types";
import { Skeleton } from "./shared/Skeleton";
import { EmptyState } from "./shared/EmptyState";
import { Avatar } from "./shared/Avatar";
import {
  contactName,
  meetingStatus,
  statusBg,
  statusColor,
  statusLabel,
  formatDateShort,
  meetingTypeIcon,
  categoryBg,
  categoryColor,
  categoryLabel,
  confirmationBg,
  confirmationColor,
  confirmationLabel,
  hashColor,
  proximityLabel,
  formatDuration,
} from "../_lib/formatters";
import type { ConfirmationFilter } from "../_types";
import { Copy, Linkedin, RefreshCw, Check, X, Mic } from "lucide-react";

interface MeetingListProps {
  meetings: Meeting[];
  loading: boolean;
  loadingMore: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpen: (m: Meeting) => void;
  onLoadMore: () => void;
  updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>;
  updateLocalMeeting: (id: string, patch: Partial<Meeting>) => void;
}

const MeetingRow = memo(function MeetingRow({
  meeting,
  selected,
  onToggleSelect,
  onOpen,
  updateMeeting,
  updateLocalMeeting,
}: {
  meeting: Meeting;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (m: Meeting) => void;
  updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>;
  updateLocalMeeting: (id: string, patch: Partial<Meeting>) => void;
}) {
  const status = meetingStatus(meeting);
  const date = formatDateShort(meeting.createdAt);
  const rdvDate = formatDateShort(meeting.callbackDate);
  const proximity = proximityLabel(meeting.callbackDate);
  const isPending = meeting.confirmationStatus === "PENDING";
  const [audioPopupOpen, setAudioPopupOpen] = useState(false);
  const hasAudio = !!meeting.callRecordingUrl?.trim();
  const transcription = meeting.callTranscription?.trim() ?? "";

  const handleInlineConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateMeeting(meeting.id, { confirmationStatus: "CONFIRMED" });
    updateLocalMeeting(meeting.id, {
      confirmationStatus: "CONFIRMED",
      confirmedAt: new Date().toISOString(),
    });
  };

  const handleInlineCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateMeeting(meeting.id, { confirmationStatus: "CANCELLED" });
    updateLocalMeeting(meeting.id, {
      confirmationStatus: "CANCELLED",
      confirmedAt: null,
      confirmedById: null,
    });
  };

  return (
    <div
      className="rdv-row"
      onClick={() => onOpen(meeting)}
      style={{
        display: "flex", alignItems: "center", padding: "0 24px", height: 80,
        borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 0.15s",
        gap: 12, borderLeft: selected ? "3px solid var(--accent)" : "3px solid transparent",
        background: selected ? "rgba(108,99,255,0.04)" : "transparent",
      }}
    >
      <div style={{ width: 36 }} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="rdv-checkbox" checked={selected} onChange={() => onToggleSelect(meeting.id)} />
      </div>

      <div style={{ width: 90, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>{date.day}</div>
        <div style={{ fontSize: 11, color: "var(--ink3)", textTransform: "uppercase", fontWeight: 500 }}>{date.month}</div>
        <span style={{ fontSize: 10, fontWeight: 600, background: "var(--surface2)", color: "var(--ink3)", borderRadius: 5, padding: "2px 7px" }}>
          {date.time}
        </span>
      </div>

      {/* Secondary date: scheduled meeting date */}
      <div style={{ width: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        {meeting.callbackDate ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: proximity.color, lineHeight: 1 }}>{rdvDate.day} {rdvDate.month}</div>
            <span style={{ fontSize: 9, fontWeight: 600, color: proximity.color, background: `${proximity.color}12`, borderRadius: 4, padding: "1px 5px" }}>
              {proximity.text}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: "var(--ink3)", opacity: 0.4 }}>—</span>
        )}
      </div>

      <div style={{ flex: 2, minWidth: 140, display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={meeting.contact ? contactName(meeting.contact) : (meeting.company?.name ?? "—")} size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {meeting.contact ? contactName(meeting.contact) : (meeting.company ? "Société seule" : "—")}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
            {meeting.contact?.title ?? (meeting.company ? meeting.company.name : "—")}
          </div>
        </div>
      </div>

      <div style={{ flex: 2, minWidth: 120, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", display: "grid", placeContent: "center", fontSize: 13, fontWeight: 700, color: "var(--ink3)", flexShrink: 0 }}>
          {(meeting.company?.name || "?")[0]}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{ fontSize: 13, color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}
            title={meeting.company?.name || ""}
          >
            {meeting.company?.name || "—"}
          </div>
          {meeting.company?.industry && (
            <span style={{ fontSize: 10, color: "var(--ink3)", background: "var(--surface2)", padding: "2px 7px", borderRadius: 4, fontWeight: 500 }}>
              {meeting.company.industry}
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 80 }}>
        {meeting.client && (
          <span className="rdv-pill" style={{ background: `${hashColor(meeting.client.name)}12`, color: hashColor(meeting.client.name), fontWeight: 600 }}>
            {meeting.client.name}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 80, fontSize: 13, color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {meeting.mission.name}
      </div>

      <div style={{ width: 100, display: "flex", alignItems: "center", gap: 6 }}>
        <Avatar name={meeting.sdr.name} size={24} />
        <span style={{ fontSize: 12, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {meeting.sdr.name}
        </span>
      </div>

      <div style={{ width: 120, minWidth: 120, display: "flex", alignItems: "center", gap: 6 }}>
        {meeting.interlocuteur ? (
          <>
            <Avatar
              name={[meeting.interlocuteur.firstName, meeting.interlocuteur.lastName].filter(Boolean).join(" ") || "Commercial"}
              size={24}
            />
            <span style={{ fontSize: 12, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {[meeting.interlocuteur.firstName, meeting.interlocuteur.lastName].filter(Boolean).join(" ") || "Assigné"}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: "var(--ink3)", opacity: 0.65 }}>Non assigné</span>
        )}
      </div>

      <div style={{ width: 36, textAlign: "center", color: "var(--ink3)" }}>{meetingTypeIcon(meeting.meetingType)}</div>

      {meeting.duration ? (
        <div style={{ width: 50, textAlign: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink3)", background: "var(--surface2)", padding: "2px 6px", borderRadius: 4 }}>
            {formatDuration(meeting.duration)}
          </span>
        </div>
      ) : (
        <div style={{ width: 50 }} />
      )}

      <div style={{ width: 70, textAlign: "center" }}>
        <span className="status-badge" style={{ background: statusBg(status), color: statusColor(status) }}>
          {statusLabel(status)}
        </span>
      </div>

      <div style={{ width: 100, textAlign: "center" }}>
        {meeting.confirmationStatus ? (
          <span
            className="status-badge"
            style={{
              background: confirmationBg(meeting.confirmationStatus as ConfirmationFilter),
              color: confirmationColor(meeting.confirmationStatus as ConfirmationFilter),
            }}
          >
            {confirmationLabel(meeting.confirmationStatus as ConfirmationFilter)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--ink3)", opacity: 0.4 }}>—</span>
        )}
      </div>

      <div style={{ width: 36, textAlign: "center", position: "relative" }}>
        {hasAudio ? (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAudioPopupOpen((prev) => !prev);
              }}
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: audioPopupOpen ? "rgba(108,99,255,0.12)" : "var(--surface2)",
                color: audioPopupOpen ? "var(--accent)" : "var(--ink3)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              title="Audio et transcription"
            >
              <Mic size={13} />
            </button>
            {audioPopupOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: 320,
                  zIndex: 20,
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "var(--surface)",
                  boxShadow: "0 12px 28px rgba(15,23,42,0.14)",
                  padding: 10,
                  textAlign: "left",
                }}
              >
                <audio controls src={`/api/actions/${meeting.id}/recording`} style={{ width: "100%" }} />
                <div
                  className="rdv-scrollbar"
                  style={{
                    marginTop: 8,
                    maxHeight: 140,
                    overflowY: "auto",
                    fontSize: 12,
                    color: "var(--ink2)",
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {transcription || "Aucune transcription disponible."}
                </div>
              </div>
            )}
          </>
        ) : (
          <span style={{ fontSize: 11, color: "var(--ink3)", opacity: 0.4 }}>—</span>
        )}
      </div>

      <div style={{ width: 64, position: "relative" }}>
        <div className="rdv-row-actions" style={{ opacity: 0, transition: "opacity 0.15s", display: "flex", gap: 3 }}>
          {isPending && (
            <>
              <button
                onClick={handleInlineConfirm}
                style={{ background: "var(--greenLight)", border: "1px solid rgba(5,150,105,0.2)", color: "var(--green)", cursor: "pointer", padding: 4, borderRadius: 6 }}
                title="Confirmer"
              >
                <Check size={13} />
              </button>
              <button
                onClick={handleInlineCancel}
                style={{ background: "var(--redLight)", border: "1px solid rgba(220,38,38,0.2)", color: "var(--red)", cursor: "pointer", padding: 4, borderRadius: 6 }}
                title="Annuler"
              >
                <X size={13} />
              </button>
            </>
          )}
          {meeting.contact?.email && (
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(meeting.contact!.email!); }}
              style={{ background: "var(--surface2)", border: "none", color: "var(--ink3)", cursor: "pointer", padding: 4, borderRadius: 6 }}
              title="Copier email"
            >
              <Copy size={13} />
            </button>
          )}
          {meeting.contact?.linkedin && (
            <a
              href={meeting.contact.linkedin}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: "var(--ink3)", padding: 4, background: "var(--surface2)", borderRadius: 6, display: "flex" }}
              title="LinkedIn"
            >
              <Linkedin size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
});

export function MeetingList({
  meetings,
  loading,
  loadingMore,
  listRef,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
  onLoadMore,
  updateMeeting,
  updateLocalMeeting,
}: MeetingListProps) {
  const scrollContainerRef = listRef as React.RefObject<HTMLDivElement>;

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
        onLoadMore();
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollContainerRef, onLoadMore]);

  return (
    <>
      <div
        className="rdv-list-header"
        style={{
          display: "flex", alignItems: "center", padding: "10px 24px",
          borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 600,
          color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em",
          flexShrink: 0, gap: 12, background: "rgba(255,255,255,0.88)",
        }}
      >
        <div style={{ width: 36 }}>
          <input
            type="checkbox"
            className="rdv-checkbox"
            checked={selectedIds.size > 0 && selectedIds.size === meetings.length}
            onChange={onToggleSelectAll}
          />
        </div>
        <div style={{ width: 90 }} title="Date de l'action (prise de RDV)">Créé le</div>
        <div style={{ width: 80 }} title="Date prévue du rendez-vous">Date RDV</div>
        <div style={{ flex: 2, minWidth: 140 }}>Contact</div>
        <div style={{ flex: 2, minWidth: 120 }}>Entreprise</div>
        <div style={{ flex: 1, minWidth: 80 }}>Client</div>
        <div style={{ flex: 1, minWidth: 80 }}>Mission</div>
        <div style={{ width: 100 }}>SDR</div>
        <div style={{ width: 120 }}>Commercial</div>
        <div style={{ width: 36, textAlign: "center" }}>Type</div>
        <div style={{ width: 50, textAlign: "center" }}>Durée</div>
        <div style={{ width: 70, textAlign: "center" }}>Statut</div>
        <div style={{ width: 100, textAlign: "center" }}>Confirm.</div>
        <div style={{ width: 36, textAlign: "center" }}>Audio</div>
        <div style={{ width: 64 }} />
      </div>

      <div ref={scrollContainerRef} className="rdv-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "16px 24px", gap: 12, borderBottom: "1px solid var(--border)" }}>
              <Skeleton w={18} h={18} r={5} />
              <Skeleton w={70} h={44} r={8} />
              <Skeleton w={60} h={30} r={6} />
              <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 4 }}>
                <Skeleton w="75%" h={14} />
                <Skeleton w="50%" h={10} />
              </div>
              <div style={{ flex: 2 }}><Skeleton w="65%" h={14} /></div>
              <div style={{ flex: 1 }}><Skeleton w="60%" h={24} r={12} /></div>
              <div style={{ flex: 1 }}><Skeleton w="55%" h={14} /></div>
              <Skeleton w={80} h={14} />
              <Skeleton w={24} h={24} r={12} />
              <Skeleton w={40} h={20} r={4} />
              <Skeleton w={50} h={24} r={12} />
              <Skeleton w={70} h={24} r={12} />
              <Skeleton w={22} h={22} r={11} />
            </div>
          ))
        ) : meetings.length === 0 ? (
          <EmptyState />
        ) : (
          meetings.map((m) => (
            <MeetingRow
              key={m.id}
              meeting={m}
              selected={selectedIds.has(m.id)}
              onToggleSelect={onToggleSelect}
              onOpen={onOpen}
              updateMeeting={updateMeeting}
              updateLocalMeeting={updateLocalMeeting}
            />
          ))
        )}
        {loadingMore && (
          <div style={{ padding: 20, textAlign: "center" }}>
            <RefreshCw size={16} style={{ animation: "spin 1s linear infinite", color: "var(--ink3)" }} />
          </div>
        )}
      </div>
    </>
  );
}
