// ============================================
// AIRCALL ADAPTER — Click-to-call API; AI via Intelligence (async)
// ============================================

import { prisma } from "@/lib/prisma";
import type {
  VoipAdapter,
  InitiateCallParams,
  InitiateCallResult,
  NormalizedCall,
  TranscriptSegment,
} from "../../types";

function getAuth(): string {
  const id = process.env.AIRCALL_API_ID;
  const token = process.env.AIRCALL_API_TOKEN;
  if (!id || !token) throw new Error("AIRCALL_API_ID and AIRCALL_API_TOKEN requis");
  return `Basic ${Buffer.from(`${id}:${token}`).toString("base64")}`;
}

interface AircallWebhookPayload {
  event?: string;
  data?: {
    id?: number;
    direction?: "inbound" | "outbound";
    missed_call_reason?: string;
    number?: { digits?: string };
    raw_digits?: string;
    duration?: number;
    started_at?: number;
    ended_at?: number;
    recording?: string;
    user?: { id?: number };
  };
}

function normalizeAircallSegment(seg: {
  role?: string;
  content?: string;
  start_time?: number;
  end_time?: number;
}): TranscriptSegment {
  return {
    speaker: seg.role === "agent" ? "agent" : "prospect",
    text: seg.content ?? "",
    startSeconds: seg.start_time ?? 0,
    endSeconds: seg.end_time,
  };
}

export class AircallAdapter implements VoipAdapter {
  provider = "aircall" as const;

  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    const config = await prisma.userVoipConfig.findUnique({
      where: { userId: params.userId, active: true },
    });
    if (!config?.aircallUserId)
      throw new Error("Configuration Aircall manquante pour ce SDR");

    const res = await fetch(
      `https://api.aircall.io/v1/users/${config.aircallUserId}/calls`,
      {
        method: "POST",
        headers: {
          Authorization: getAuth(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: params.phone }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Aircall API: ${res.status} ${err}`);
    }
    const json = (await res.json()) as { call?: { id?: number; sid?: string } };
    const call = json.call;
    if (!call?.id) throw new Error("Aircall n'a pas retourné d'id d'appel");

    const action = await prisma.action.create({
      data: {
        sdrId: params.userId,
        contactId: params.contactId ?? undefined,
        companyId: params.companyId ?? undefined,
        campaignId: params.campaignId!,
        channel: "CALL",
        result: "NO_RESPONSE",
        actionStatus: "IN_PROGRESS",
        voipProvider: "aircall",
        voipCallId: String(call.id),
      },
    });

    return {
      providerCallId: String(call.id),
      actionId: action.id,
      callMethod: "api",
    };
  }

  parseWebhook(rawBody: unknown): NormalizedCall | null {
    const raw = rawBody as AircallWebhookPayload;
    const event = raw?.event;
    if (!["call.ended", "call.hungup"].includes(event) || !raw?.data) return null;
    const data = raw.data;
    return {
      provider: "aircall",
      providerCallId: String(data.id ?? ""),
      direction: (data.direction === "outbound" ? "outbound" : "inbound") as "inbound" | "outbound",
      status: data.missed_call_reason ? "missed" : "completed",
      fromNumber: data.number?.digits ?? "",
      toNumber: data.raw_digits ?? "",
      durationSeconds: data.duration ?? 0,
      startedAt: new Date((data.started_at ?? 0) * 1000),
      endedAt: new Date((data.ended_at ?? 0) * 1000),
      recordingUrl: data.recording,
      enrichmentPending: event === "call.ended",
      providerUserId: data.user?.id != null ? String(data.user.id) : undefined,
    };
  }

  async fetchEnrichment(callId: string): Promise<Partial<NormalizedCall>> {
    const h = { headers: { Authorization: getAuth() } };
    const [sum, trs, snt, top, act] = await Promise.allSettled([
      fetch(`https://api.aircall.io/v1/calls/${callId}/summary`, h).then((r) =>
        r.json()
      ),
      fetch(`https://api.aircall.io/v1/calls/${callId}/transcription`, h).then(
        (r) => r.json()
      ),
      fetch(`https://api.aircall.io/v1/calls/${callId}/sentiments`, h).then(
        (r) => r.json()
      ),
      fetch(`https://api.aircall.io/v1/calls/${callId}/topics`, h).then((r) =>
        r.json()
      ),
      fetch(`https://api.aircall.io/v1/calls/${callId}/action_items`, h).then(
        (r) => r.json()
      ),
    ]);
    const summary = sum.status === "fulfilled" ? sum.value : null;
    const transcript = trs.status === "fulfilled" ? trs.value : null;
    const sentiments = snt.status === "fulfilled" ? snt.value : null;
    const topics = top.status === "fulfilled" ? top.value : null;
    const actionItems = act.status === "fulfilled" ? act.value : null;
    return {
      aiSummary:
        summary && typeof summary.summary === "string" ? summary.summary : undefined,
      aiTranscript: Array.isArray(transcript?.transcript)
        ? transcript.transcript.map(normalizeAircallSegment)
        : undefined,
      aiSentiment:
        sentiments?.overall &&
        typeof sentiments.overall === "string"
          ? (sentiments.overall.toLowerCase() as "positive" | "neutral" | "negative")
          : undefined,
      aiTopics: Array.isArray(topics?.topics) ? topics.topics : undefined,
      aiActionItems: Array.isArray(actionItems?.action_items)
        ? actionItems.action_items
        : undefined,
    };
  }

  async matchSdr(normalizedCall: NormalizedCall): Promise<string | null> {
    if (!normalizedCall.providerUserId) return null;
    const config = await prisma.userVoipConfig.findFirst({
      where: {
        provider: "aircall",
        aircallUserId: parseInt(normalizedCall.providerUserId, 10),
        active: true,
      },
    });
    return config?.userId ?? null;
  }
}
