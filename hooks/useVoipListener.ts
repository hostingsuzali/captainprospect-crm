"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export interface VoipCallCompletedEvent {
  actionId: string;
  provider: string;
  duration: number;
  summary?: string;
  hasTranscript: boolean;
  contactName: string;
  enrichmentPending: boolean;
  recordingUrl?: string;
  /** When true (Allo auto-validation), notes/status already updated from AI — no modal */
  autoValidated?: boolean;
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
  intervalMs?: number;
}

/**
 * REPLACED: SSE → polling
 * Polls /api/comms/events for VoIP enrichment events every 15s.
 * Fixes Vercel serverless timeout issues (SSE held connections for 300s).
 */
export function useVoipListener({
  userId,
  onCallCompleted,
  onEnrichmentReady,
  enabled = true,
  intervalMs = 15_000,
}: UseVoipListenerOptions) {
  const onCallCompletedRef = useRef(onCallCompleted);
  const onEnrichmentReadyRef = useRef(onEnrichmentReady);
  const lastTimestampRef = useRef<string>(new Date().toISOString());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  onCallCompletedRef.current = onCallCompleted;
  onEnrichmentReadyRef.current = onEnrichmentReady;

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/comms/events?since=${encodeURIComponent(lastTimestampRef.current)}`
      );
      if (!res.ok) {
        setIsConnected(false);
        return;
      }
      const json = await res.json();
      if (!json.success) {
        setIsConnected(false);
        return;
      }

      const { events, timestamp } = json.data;

      if (timestamp) lastTimestampRef.current = timestamp;
      if (Array.isArray(events)) {
        events.forEach((event: VoipCallCompletedEvent & VoipEnrichmentEvent & { type?: string }) => {
          if (event.type === "voip:call-completed") {
            onCallCompletedRef.current?.({
              actionId: event.actionId,
              provider: event.provider,
              duration: event.duration,
              summary: event.summary,
              hasTranscript: event.hasTranscript,
              contactName: event.contactName,
              enrichmentPending: event.enrichmentPending,
              recordingUrl: event.recordingUrl,
              autoValidated: event.autoValidated,
            });
          } else if (event.type === "voip:enrichment-ready") {
            onEnrichmentReadyRef.current?.({
              actionId: event.actionId,
              summary: event.summary,
            });
          }
        });
      }
      setIsConnected(true);
    } catch {
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !userId) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsConnected(false);
      return;
    }

    poll();
    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, userId, poll, intervalMs]);

  return { isConnected };
}
