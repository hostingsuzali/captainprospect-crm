"use client";

import { memo, useEffect, useRef } from "react";
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
  outcomeIcon,
  hashColor,
} from "../_lib/formatters";
import type { ConfirmationFilter } from "../_types";
import { Copy, Linkedin, RefreshCw } from "lucide-react";

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
}

const MeetingRow = memo(function MeetingRow({
  meeting,
  selected,
  onToggleSelect,
  onOpen,
}: {
  meeting: Meeting;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (m: Meeting) => void;
}) {
  const status = meetingStatus(meeting);
  const date = formatDateShort(meeting.createdAt);

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

      <div style={{ flex: 2, minWidth: 160, display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={contactName(meeting.contact)} size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {contactName(meeting.contact)}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
            {meeting.contact?.title || "—"}
          </div>
        </div>
      </div>

      <div style={{ flex: 2, minWidth: 140, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", display: "grid", placeContent: "center", fontSize: 13, fontWeight: 700, color: "var(--ink3)", flexShrink: 0 }}>
          {(meeting.company?.name || "?")[0]}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
            {meeting.company?.name || "—"}
          </div>
          {meeting.company?.industry && (
            <span style={{ fontSize: 10, color: "var(--ink3)", background: "var(--surface2)", padding: "2px 7px", borderRadius: 4, fontWeight: 500 }}>
              {meeting.company.industry}
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 100 }}>
        {meeting.client && (
          <span className="rdv-pill" style={{ background: `${hashColor(meeting.client.name)}12`, color: hashColor(meeting.client.name), fontWeight: 600 }}>
            {meeting.client.name}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 100, fontSize: 13, color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {meeting.mission.name}
      </div>

      <div style={{ width: 120, display: "flex", alignItems: "center", gap: 8 }}>
        <Avatar name={meeting.sdr.name} size={24} />
        <span style={{ fontSize: 13, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {meeting.sdr.name}
        </span>
      </div>

      <div style={{ width: 44, textAlign: "center", color: "var(--ink3)" }}>{meetingTypeIcon(meeting.meetingType)}</div>

      <div style={{ width: 90, textAlign: "center" }}>
        {meeting.meetingCategory ? (
          <span className="rdv-pill" style={{ background: categoryBg(meeting.meetingCategory), color: categoryColor(meeting.meetingCategory), padding: "4px 10px" }}>
            {categoryLabel(meeting.meetingCategory)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--ink3)", opacity: 0.4 }}>—</span>
        )}
      </div>

      <div style={{ width: 80, textAlign: "center" }}>
        <span className="rdv-pill" style={{ background: statusBg(status), color: statusColor(status), padding: "4px 12px" }}>
          {statusLabel(status)}
        </span>
      </div>

      <div style={{ width: 110, textAlign: "center" }}>
        {meeting.confirmationStatus ? (
          <span
            className="rdv-pill"
            style={{
              background: confirmationBg(meeting.confirmationStatus as ConfirmationFilter),
              color: confirmationColor(meeting.confirmationStatus as ConfirmationFilter),
              padding: "4px 12px",
              border: `1px solid ${confirmationColor(meeting.confirmationStatus as ConfirmationFilter)}`,
            }}
          >
            {confirmationLabel(meeting.confirmationStatus as ConfirmationFilter)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--ink3)", opacity: 0.4 }}>—</span>
        )}
      </div>

      <div style={{ width: 44, textAlign: "center" }}>{outcomeIcon(meeting.feedback?.outcome || null)}</div>

      <div style={{ width: 48, position: "relative" }}>
        <div className="rdv-row-actions" style={{ opacity: 0, transition: "opacity 0.15s", display: "flex", gap: 4 }}>
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
        style={{
          display: "flex", alignItems: "center", padding: "10px 24px",
          borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 600,
          color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em",
          flexShrink: 0, gap: 12, background: "var(--surface)",
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
        <div style={{ width: 90 }}>Créé le</div>
        <div style={{ flex: 2, minWidth: 160 }}>Contact</div>
        <div style={{ flex: 2, minWidth: 140 }}>Entreprise</div>
        <div style={{ flex: 1, minWidth: 100 }}>Client</div>
        <div style={{ flex: 1, minWidth: 100 }}>Mission</div>
        <div style={{ width: 120 }}>SDR</div>
        <div style={{ width: 44, textAlign: "center" }}>Type</div>
        <div style={{ width: 90, textAlign: "center" }}>Catégorie</div>
        <div style={{ width: 80, textAlign: "center" }}>Statut</div>
        <div style={{ width: 110, textAlign: "center" }}>Confirmation</div>
        <div style={{ width: 44, textAlign: "center" }}>FB</div>
        <div style={{ width: 48 }} />
      </div>

      <div ref={scrollContainerRef} className="rdv-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "16px 24px", gap: 12, borderBottom: "1px solid var(--border)" }}>
              <Skeleton w={18} h={18} r={5} />
              <Skeleton w={70} h={44} r={8} />
              <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 4 }}>
                <Skeleton w="75%" h={14} />
                <Skeleton w="50%" h={10} />
              </div>
              <div style={{ flex: 2 }}><Skeleton w="65%" h={14} /></div>
              <div style={{ flex: 1 }}><Skeleton w="60%" h={24} r={12} /></div>
              <div style={{ flex: 1 }}><Skeleton w="55%" h={14} /></div>
              <Skeleton w={90} h={14} />
              <Skeleton w={30} h={30} r={15} />
              <Skeleton w={60} h={24} r={12} />
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
