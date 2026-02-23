"use client";

import { useEffect, useRef } from "react";

export interface VoipCallCompletedEvent {
  actionId: string;
  provider: string;
  duration: number;
  summary?: string;
  hasTranscript: boolean;
  contactName: string;
  enrichmentPending: boolean;
  recordingUrl?: string;
}

export interface VoipEnrichmentEvent {
  actionId: string;
  summary?: string;
}

export interface UseVoipListenerOptions {
  userId: string | null;
  onCallCompleted?: (data: VoipCallCompletedEvent) => void;
  onEnrichmentReady?: (data: VoipEnrichmentEvent) => void;
  enabled?: boolean;
}

/**
 * Listens for voip:call-completed and voip:enrichment-ready via SSE (/api/comms/events).
 * Same stream as comms; events are published by the VoIP processor.
 */
export function useVoipListener({
  userId,
  onCallCompleted,
  onEnrichmentReady,
  enabled = true,
}: UseVoipListenerOptions) {
  const onCallCompletedRef = useRef(onCallCompleted);
  const onEnrichmentReadyRef = useRef(onEnrichmentReady);
  onCallCompletedRef.current = onCallCompleted;
  onEnrichmentReadyRef.current = onEnrichmentReady;

  useEffect(() => {
    if (!enabled || !userId) return;

    const url = "/api/comms/events";
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data) as { type?: string; [k: string]: unknown };
        if (payload.type === "voip:call-completed") {
          onCallCompletedRef.current?.({
            actionId: String(payload.actionId ?? ""),
            provider: String(payload.provider ?? ""),
            duration: Number(payload.duration ?? 0),
            summary: payload.summary as string | undefined,
            hasTranscript: Boolean(payload.hasTranscript),
            contactName: String(payload.contactName ?? ""),
            enrichmentPending: Boolean(payload.enrichmentPending),
            recordingUrl: payload.recordingUrl as string | undefined,
          });
        } else if (payload.type === "voip:enrichment-ready") {
          onEnrichmentReadyRef.current?.({
            actionId: String(payload.actionId ?? ""),
            summary: payload.summary as string | undefined,
          });
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [userId, enabled]);
}
