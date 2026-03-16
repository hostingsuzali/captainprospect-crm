"use client";

import type { Meeting } from "../../_types";
import type { UseFicheRdvReturn } from "../../_hooks/useFicheRdv";
import { transcriptToText } from "../../_lib/formatters";
import { FileText, Check, RefreshCw } from "lucide-react";

interface FicheTabProps {
  meeting: Meeting;
  setSelectedMeeting: React.Dispatch<React.SetStateAction<Meeting | null>>;
  ficheState: UseFicheRdvReturn;
  updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>;
}

const FICHE_FIELDS = [
  ["contexte", "Contexte"],
  ["besoinsProblemes", "Besoins / Problèmes identifiés"],
  ["solutionsEnPlace", "Solutions en place"],
  ["objectionsFreins", "Objections / Freins"],
  ["notesImportantes", "Notes importantes"],
] as const;

export function FicheTab({ meeting, setSelectedMeeting, ficheState, updateMeeting }: FicheTabProps) {
  const {
    ficheForm,
    setFicheForm,
    ficheLoading,
    ficheError,
    ficheSaving,
    ficheSaved,
    ficheManualTranscript,
    setFicheManualTranscript,
    generateWithAI,
    saveFiche,
  } = ficheState;

  const hasAutoTranscript = transcriptToText(meeting.voipTranscript) !== "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Fiche RDV</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {ficheSaved && <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 500 }}>Sauvegardé ✓</span>}
          <button
            className="rdv-btn rdv-btn-ghost"
            style={{ fontSize: 12, padding: "6px 12px" }}
            disabled={ficheLoading}
            onClick={() => generateWithAI(meeting, (updated) => setSelectedMeeting(updated))}
          >
            {ficheLoading ? (
              <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <FileText size={13} />
            )}
            Générer IA
          </button>
          <button
            className="rdv-btn rdv-btn-primary"
            style={{ fontSize: 12, padding: "6px 12px" }}
            disabled={ficheSaving}
            onClick={() => saveFiche(meeting, (updated) => setSelectedMeeting(updated))}
          >
            <Check size={13} /> {ficheSaving ? "Enregistrement…" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {meeting.rdvFicheUpdatedAt && (
        <div style={{ fontSize: 12, color: "var(--ink3)" }}>
          Dernière mise à jour : {new Date(meeting.rdvFicheUpdatedAt).toLocaleString("fr-FR")}
        </div>
      )}

      {ficheError && (
        <div style={{ background: "var(--redLight)", border: "1px solid rgba(220,38,38,0.18)", color: "var(--red)", padding: "10px 12px", borderRadius: 12, fontSize: 12 }}>
          {ficheError}
        </div>
      )}

      {!hasAutoTranscript && (
        <div>
          <div style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 600, marginBottom: 8 }}>
            Transcription (à coller pour génération IA)
          </div>
          <textarea
            className="rdv-input"
            style={{ width: "100%", minHeight: 100, resize: "vertical" }}
            value={ficheManualTranscript}
            onChange={(e) => setFicheManualTranscript(e.target.value)}
            placeholder="Collez ici la transcription complète (Agent/Prospect)…"
          />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {FICHE_FIELDS.map(([field, label]) => (
          <div key={field} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12, background: "var(--surface)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "var(--ink3)", textTransform: "uppercase", marginBottom: 8 }}>
              {label}
            </div>
            <textarea
              className="rdv-input"
              style={{ width: "100%", minHeight: 80, resize: "vertical", border: "1px solid var(--border2)", borderRadius: 8, fontSize: 13, lineHeight: 1.6, padding: "8px 10px", background: "var(--surface2)" }}
              value={ficheForm[field]}
              onChange={(e) => setFicheForm((f) => ({ ...f, [field]: e.target.value }))}
              placeholder={`Saisir ${label.toLowerCase()}…`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
