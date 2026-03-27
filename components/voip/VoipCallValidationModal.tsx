"use client";

import { useState, useEffect } from "react";
import { Button, useToast } from "@/components/ui";
import { ACTION_RESULT_LABELS } from "@/lib/types";
import { Loader2, Phone } from "lucide-react";
import type { VoipCallCompletedEvent } from "@/hooks/useVoipListener";
import { proxyRecordingUrl } from "@/lib/voip/recording";

const PROVIDER_LABELS: Record<string, string> = {
  allo: "Allo",
  aircall: "Aircall",
  ringover: "Ringover",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface VoipCallValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string;
  callData: VoipCallCompletedEvent;
  /** When enrichment arrives async (Aircall/Ringover), parent passes it here. */
  enrichmentSummary?: string | null;
  statusOptions?: Array<{ value: string; label: string }>;
  onValidated?: () => void;
}

export function VoipCallValidationModal({
  isOpen,
  onClose,
  actionId,
  callData,
  enrichmentSummary,
  statusOptions,
  onValidated,
}: VoipCallValidationModalProps) {
  const { success, error: showError } = useToast();
  const [note, setNote] = useState(callData.summary ?? "");
  const [result, setResult] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const enriched = !callData.enrichmentPending || !!enrichmentSummary;

  useEffect(() => {
    if (isOpen) {
      setNote(callData.summary ?? "");
      setResult("");
    }
  }, [isOpen, actionId, callData.summary]);

  useEffect(() => {
    if (enrichmentSummary) {
      setNote(enrichmentSummary);
    }
  }, [enrichmentSummary]);

  const options = statusOptions?.length
    ? statusOptions
    : Object.entries(ACTION_RESULT_LABELS).map(([value, label]) => ({ value, label }));

  const handleValidate = async () => {
    if (!result.trim()) {
      showError("Sélectionnez un résultat");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, note: note.trim() || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        success("Appel validé");
        onValidated?.();
        onClose();
      } else {
        showError(json.error ?? "Erreur lors de la validation");
      }
    } catch {
      showError("Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Résumé de l&apos;appel</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {PROVIDER_LABELS[callData.provider] ?? callData.provider}
          </span>
          <span className="text-sm text-slate-500 flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" />
            {formatDuration(callData.duration)}
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Résumé / Note
          </label>
          {!enriched ? (
            <div className="flex items-center gap-2 py-3 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Résumé IA en cours…
            </div>
          ) : (
            <textarea
              value={enrichmentSummary ?? note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[80px]"
              placeholder="Résumé de l'appel…"
              rows={3}
            />
          )}
        </div>

        {callData.recordingUrl && (
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Enregistrement
            </label>
            <audio controls src={proxyRecordingUrl(callData.recordingUrl) ?? undefined} className="w-full h-9">
              <track kind="captions" />
            </audio>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Résultat
          </label>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
          >
            <option value="">Choisir…</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Fermer
          </Button>
          <Button
            onClick={handleValidate}
            disabled={!result || saving}
            className="flex-1 gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Valider"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
