"use client";

import type { Meeting } from "../../_types";

interface AudioTabProps {
  meeting: Meeting;
}

export function AudioTab({ meeting }: AudioTabProps) {
  const hasRecording = !!meeting.callRecordingUrl?.trim();
  const transcription = meeting.callTranscription?.trim() ?? "";

  if (!hasRecording) {
    return (
      <div
        style={{
          border: "1px dashed var(--border2)",
          borderRadius: 12,
          padding: 16,
          color: "var(--ink3)",
          fontSize: 13,
        }}
      >
        Aucun audio disponible pour ce rendez-vous.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
          Enregistrement
        </div>
        <audio
          controls
          src={`/api/actions/${meeting.id}/recording`}
          style={{ width: "100%" }}
        />
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
          Transcription
        </div>
        {transcription ? (
          <div
            className="rdv-scrollbar"
            style={{
              maxHeight: 300,
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "var(--surface2)",
              padding: 12,
              fontSize: 13,
              color: "var(--ink2)",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {transcription}
          </div>
        ) : (
          <div style={{ color: "var(--ink3)", fontSize: 12, opacity: 0.8 }}>
            Aucune transcription disponible.
          </div>
        )}
      </div>
    </div>
  );
}
