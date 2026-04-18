"use client";

import { useState, useCallback } from "react";
import { PhoneCall } from "lucide-react";
import type { Meeting } from "../../_types";
import { AlloCallPickerModal } from "@/components/sdr/AlloCallPickerModal";
import { useToast } from "@/components/ui";

interface AudioTabProps {
  meeting: Meeting;
  updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>;
  setSelectedMeeting: (meeting: Meeting) => void;
}

export function AudioTab({ meeting, updateMeeting, setSelectedMeeting }: AudioTabProps) {
  const hasRecording = !!meeting.callRecordingUrl?.trim();
  const transcription = meeting.callTranscription?.trim() ?? "";

  const { success, error: showError } = useToast();

  const [alloOpen, setAlloOpen] = useState(false);
  const [alloLoading, setAlloLoading] = useState(false);
  const [alloCalls, setAlloCalls] = useState<unknown[]>([]);
  const [alloFilterPhone, setAlloFilterPhone] = useState("");
  const [alloLineCount, setAlloLineCount] = useState<number | null>(null);
  const [alloSelectedId, setAlloSelectedId] = useState<string | null>(null);
  const [alloSaving, setAlloSaving] = useState(false);

  const openAlloDialog = useCallback(async () => {
    const phone = meeting.contact?.phone || meeting.meetingPhone;
    if (!phone) {
      showError("Numéro manquant", "Aucun numéro de téléphone trouvé pour ce RDV.");
      return;
    }
    setAlloFilterPhone(phone);
    setAlloLineCount(null);
    setAlloOpen(true);
    setAlloLoading(true);
    setAlloCalls([]);
    setAlloSelectedId(null);
    try {
      const res = await fetch(`/api/sdr/calls/for-contact?phone=${encodeURIComponent(phone)}`);
      const json = await res.json();
      if (json.success) {
        setAlloCalls(json.data.calls ?? []);
        const meta = json.data?.meta as { filterPhone?: string; alloLineCount?: number } | undefined;
        if (meta?.filterPhone) setAlloFilterPhone(meta.filterPhone);
        if (typeof meta?.alloLineCount === "number") setAlloLineCount(meta.alloLineCount);
      } else {
        showError("Erreur Allo", json.error ?? "Impossible de charger les appels.");
        setAlloOpen(false);
      }
    } catch {
      showError("Erreur réseau", "Impossible de contacter Allo.");
      setAlloOpen(false);
    } finally {
      setAlloLoading(false);
    }
  }, [meeting.contact?.phone, meeting.meetingPhone, showError]);

  const confirmAlloCall = useCallback(async () => {
    const call = alloCalls.find((c: any) => String((c as any).id) === alloSelectedId) as any;
    if (!call) return;

    const callRecordingUrl =
      typeof call.recording_url === "string" && call.recording_url ? call.recording_url : null;
    const callSummary =
      typeof call.summary === "string" && call.summary ? call.summary : null;
    let callTranscription: string | null = null;
    if (Array.isArray(call.transcript) && call.transcript.length > 0) {
      callTranscription = (call.transcript as Array<{ source?: string; text?: string }>)
        .map((e) => `${e.source ?? "?"}: ${e.text ?? ""}`)
        .join("\n");
    } else if (typeof call.transcription === "string" && call.transcription) {
      callTranscription = call.transcription;
    }

    setAlloSaving(true);
    try {
      await updateMeeting(meeting.id, { callRecordingUrl, callSummary, callTranscription });
      setSelectedMeeting({
        ...meeting,
        callRecordingUrl: callRecordingUrl ?? undefined,
        callSummary: callSummary ?? undefined,
        callTranscription: callTranscription ?? undefined,
      });
      setAlloOpen(false);
      success("Audio lié", "L'appel Allo a été lié au RDV avec succès.");
    } catch {
      showError("Erreur", "Impossible de lier l'appel au RDV.");
    } finally {
      setAlloSaving(false);
    }
  }, [alloCalls, alloSelectedId, meeting, updateMeeting, setSelectedMeeting, success, showError]);

  if (!hasRecording) {
    return (
      <>
        <div
          style={{
            border: "1px dashed var(--border2)",
            borderRadius: 12,
            padding: 16,
            color: "var(--ink3)",
            fontSize: 13,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <span>Aucun audio disponible pour ce rendez-vous.</span>
          <button
            onClick={openAlloDialog}
            disabled={alloSaving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--accent, #4f46e5)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              opacity: alloSaving ? 0.6 : 1,
            }}
          >
            <PhoneCall size={14} />
            Retrouvez L&apos;audio
          </button>
        </div>
        <AlloCallPickerModal
          isOpen={alloOpen}
          onClose={() => setAlloOpen(false)}
          loading={alloLoading}
          calls={alloCalls}
          filterPhone={alloFilterPhone}
          alloLineCount={alloLineCount}
          selectedId={alloSelectedId}
          onSelectId={setAlloSelectedId}
          onConfirm={confirmAlloCall}
        />
      </>
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
