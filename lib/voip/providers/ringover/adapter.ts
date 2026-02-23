// ============================================
// RINGOVER ADAPTER — Callback 2-step; Empower AI (async)
// ============================================

import { prisma } from "@/lib/prisma";
import type {
  VoipAdapter,
  InitiateCallParams,
  InitiateCallResult,
  NormalizedCall,
  TranscriptSegment,
} from "../../types";

function getHeaders(): Record<string, string> {
  const key = process.env.RINGOVER_API_KEY;
  if (!key) throw new Error("RINGOVER_API_KEY requis");
  return {
    Authorization: key,
    "Content-Type": "application/json",
  };
}

interface RingoverWebhookPayload {
  event?: string;
  call_id?: string;
  direction?: string;
  status?: string;
  caller_number?: string;
  receiver_number?: string;
  duration?: number;
  timestamp?: string;
  user_id?: string;
}

function normalizeRingoverSegment(seg: {
  speaker?: string;
  text?: string;
  start_time?: number;
  end_time?: number;
}): TranscriptSegment {
  return {
    speaker: seg.speaker === "agent" ? "agent" : "prospect",
    text: seg.text ?? "",
    startSeconds: seg.start_time ?? 0,
    endSeconds: seg.end_time,
  };
}

export class RingoverAdapter implements VoipAdapter {
  provider = "ringover" as const;

  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    const config = await prisma.userVoipConfig.findUnique({
      where: { userId: params.userId, active: true },
    });
    if (!config?.ringoverNumber)
      throw new Error("Configuration Ringover manquante pour ce SDR");

    const res = await fetch(
      "https://public-api.ringover.com/v2/calls/callback",
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          from_number: config.ringoverNumber,
          to_number: params.phone,
          ringover_number: config.ringoverNumber,
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ringover API: ${res.status} ${err}`);
    }
    const json = (await res.json()) as { call?: { call_id?: string } };
    const callId = json.call?.call_id ?? "";

    const action = await prisma.action.create({
      data: {
        sdrId: params.userId,
        contactId: params.contactId ?? undefined,
        companyId: params.companyId ?? undefined,
        campaignId: params.campaignId!,
        channel: "CALL",
        result: "NO_RESPONSE",
        actionStatus: "IN_PROGRESS",
        voipProvider: "ringover",
        voipCallId: callId,
      },
    });

    return {
      providerCallId: callId,
      actionId: action.id,
      callMethod: "callback",
    };
  }

  parseWebhook(rawBody: unknown): NormalizedCall | null {
    const raw = rawBody as RingoverWebhookPayload;
    if (raw?.event !== "call_ended") return null;
    const ts = raw.timestamp ? new Date(raw.timestamp) : new Date();
    return {
      provider: "ringover",
      providerCallId: raw.call_id ?? "",
      direction: raw.direction === "inbound" ? "inbound" : "outbound",
      status: raw.status === "answered" ? "completed" : "missed",
      fromNumber: raw.caller_number ?? "",
      toNumber: raw.receiver_number ?? "",
      durationSeconds: raw.duration ?? 0,
      startedAt: ts,
      endedAt: ts,
      enrichmentPending: true,
      providerUserId: raw.user_id,
    };
  }

  async fetchEnrichment(callId: string): Promise<Partial<NormalizedCall>> {
    const platformRes = await fetch(
      `https://public-api.ringover.com/empower/platform/ringover/channel/${callId}`,
      { method: "POST", headers: getHeaders() }
    );
    if (!platformRes.ok) return { enrichmentPending: false };
    const platformJson = (await platformRes.json()) as { calluuid?: string };
    const calluuid = platformJson.calluuid;
    if (!calluuid) return { enrichmentPending: false };

    const [sum, trs, km] = await Promise.allSettled([
      fetch(
        `https://public-api.ringover.com/empower/calls/${calluuid}/summary`,
        { headers: getHeaders() }
      ).then((r) => r.json()),
      fetch(
        `https://public-api.ringover.com/empower/calls/${calluuid}/transcript`,
        { headers: getHeaders() }
      ).then((r) => r.json()),
      fetch(
        `https://public-api.ringover.com/empower/calls/${calluuid}/key_moments`,
        { headers: getHeaders() }
      ).then((r) => r.json()),
    ]);

    const summary = sum.status === "fulfilled" ? sum.value : null;
    const transcript = trs.status === "fulfilled" ? trs.value : null;
    const keyMoments = km.status === "fulfilled" ? km.value : null;

    return {
      aiSummary:
        summary && typeof summary.summary === "string" ? summary.summary : undefined,
      aiTranscript: Array.isArray(transcript?.segments)
        ? transcript.segments.map(normalizeRingoverSegment)
        : undefined,
      aiTopics: Array.isArray(keyMoments?.moments)
        ? keyMoments.moments.map((m: { label?: string }) => m.label).filter(Boolean)
        : undefined,
      enrichmentPending: false,
    };
  }

  async matchSdr(normalizedCall: NormalizedCall): Promise<string | null> {
    if (!normalizedCall.providerUserId) return null;
    const config = await prisma.userVoipConfig.findFirst({
      where: {
        provider: "ringover",
        ringoverUserId: normalizedCall.providerUserId,
        active: true,
      },
    });
    return config?.userId ?? null;
  }
}
