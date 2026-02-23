// ============================================
// ALLO ADAPTER — tel: link only; AI in webhook payload
// ============================================
// Webhooks API: use topic CALL_RECEIVED (fires after every call ends).
// Register via POST /v1/api/webhooks or Allo app: Settings > Integrations > Webhooks.
// Payload includes: oneSentenceSummary, transcriptions, recordingUrl, fromNumber, fromName.

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type {
  VoipAdapter,
  InitiateCallParams,
  InitiateCallResult,
  NormalizedCall,
  TranscriptSegment,
} from "../../types";

/**
 * Allo Webhooks API — topic CALL_RECEIVED (fires after every call ends).
 * Payload can use topic/event and various field names (camelCase or snake_case).
 */
interface AlloWebhookPayload {
  topic?: string;
  event?: string;
  call?: {
    id?: string;
    callId?: string;
    direction?: string;
    status?: string;
    from?: string;
    fromNumber?: string;
    fromName?: string;
    to?: string;
    toNumber?: string;
    duration?: number;
    started_at?: string;
    startedAt?: string;
    ended_at?: string;
    endedAt?: string;
    recording_url?: string;
    recordingUrl?: string;
    summary?: string;
    oneSentenceSummary?: string;
    transcript?: Array<{
      source?: string;
      text?: string;
      start_seconds?: number;
      startSeconds?: number;
      end_seconds?: number;
      endSeconds?: number;
    }>;
    transcriptions?: Array<{
      source?: string;
      text?: string;
      start_seconds?: number;
      startSeconds?: number;
      end_seconds?: number;
      endSeconds?: number;
    }>;
  };
}

export class AlloAdapter implements VoipAdapter {
  provider = "allo" as const;

  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    const { userId, contactId, companyId, phone, campaignId } = params;
    if (!campaignId) {
      throw new Error("campaignId requis pour initier un appel Allo");
    }
    // Unique placeholder per initiate so (voipProvider, voipCallId) never duplicates; webhook replaces with real id
    const pendingCallId = `pending:${randomUUID()}`;
    const action = await prisma.action.create({
      data: {
        sdrId: userId,
        contactId: contactId ?? undefined,
        companyId: companyId ?? undefined,
        campaignId,
        channel: "CALL",
        result: "NO_RESPONSE",
        actionStatus: "IN_PROGRESS",
        voipProvider: "allo",
        voipCallId: pendingCallId,
      },
    });
    return {
      providerCallId: "",
      actionId: action.id,
      callMethod: "tel_link",
      telLink: `tel:${phone}`,
    };
  }

  parseWebhook(rawBody: unknown): NormalizedCall | null {
    const raw = rawBody as AlloWebhookPayload;
    const topicOrEvent = (raw?.topic ?? raw?.event ?? "").toUpperCase();
    const isCallReceived =
      topicOrEvent === "CALL_RECEIVED" ||
      raw?.event === "call.received";
    if (!isCallReceived || !raw?.call) return null;
    const call = raw.call;
    const fromNumber =
      call.fromNumber ?? call.from ?? "";
    const toNumber =
      call.toNumber ?? call.to ?? "";
    const transcriptions = call.transcriptions ?? call.transcript ?? [];
    const startedAt =
      call.started_at ?? call.startedAt != null
        ? new Date((call.started_at ?? call.startedAt) as string)
        : new Date();
    const endedAt =
      call.ended_at ?? call.endedAt != null
        ? new Date((call.ended_at ?? call.endedAt) as string)
        : new Date();
    return {
      provider: "allo",
      providerCallId: call.id ?? call.callId ?? "",
      direction: call.direction === "outbound" ? "outbound" : "inbound",
      status:
        call.status === "completed" ? "completed" : "missed",
      fromNumber,
      toNumber,
      durationSeconds: call.duration ?? 0,
      startedAt,
      endedAt,
      recordingUrl: call.recordingUrl ?? call.recording_url,
      aiSummary:
        call.oneSentenceSummary ?? call.summary,
      aiTranscript: transcriptions.map(
        (t): TranscriptSegment => ({
          speaker:
            t.source === "EXTERNAL" || t.source === "external"
              ? "prospect"
              : "agent",
          text: t.text ?? "",
          startSeconds: (t.start_seconds ?? t.startSeconds) ?? 0,
          endSeconds: (t.end_seconds ?? t.endSeconds),
        })
      ),
      enrichmentPending: false,
      providerUserId: fromNumber,
    };
  }

  async matchSdr(normalizedCall: NormalizedCall): Promise<string | null> {
    const config = await prisma.userVoipConfig.findFirst({
      where: {
        provider: "allo",
        alloNumber: normalizedCall.fromNumber,
        active: true,
      },
    });
    return config?.userId ?? null;
  }
}
