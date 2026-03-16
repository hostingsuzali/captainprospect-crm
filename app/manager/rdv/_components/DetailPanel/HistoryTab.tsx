"use client";

import type { Meeting } from "../../_types";
import { outcomeLabel } from "../../_lib/formatters";

interface HistoryTabProps {
  meeting: Meeting;
}

function HistoryEntry({
  time,
  actor,
  description,
  color,
}: {
  time: string;
  actor: string;
  description: string;
  color: string;
}) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, marginTop: 5, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 13, color: "var(--ink2)" }}>
          <strong style={{ color: "var(--ink)" }}>{actor}</strong> — {description}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>
          {new Date(time).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}

export function HistoryTab({ meeting }: HistoryTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <HistoryEntry
        time={meeting.createdAt}
        actor={meeting.sdr.name}
        description="RDV créé"
        color="var(--green)"
      />
      {meeting.feedback && (
        <HistoryEntry
          time={meeting.createdAt}
          actor="Client"
          description={`Feedback : ${outcomeLabel(meeting.feedback.outcome)}`}
          color="var(--amber)"
        />
      )}
      {meeting.result === "MEETING_CANCELLED" && (
        <HistoryEntry
          time={meeting.createdAt}
          actor="—"
          description={`Annulé${meeting.cancellationReason ? ` : ${meeting.cancellationReason}` : ""}`}
          color="var(--red)"
        />
      )}
    </div>
  );
}
