/**
 * Process WithAllo CALL_RECEIVED webhook payload.
 * Parse event, find mission by phone, create CallRecord with idempotency.
 */
import { prisma } from "@/lib/prisma";
import { findMissionByPhone } from "./findMissionByPhone";
import type { ParsedCallEvent, WithAlloWebhookPayload } from "./types";

function log(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...data, timestamp: new Date().toISOString() }));
}

/** Extract call data from either call or data wrapper */
function extractCall(payload: WithAlloWebhookPayload): WithAlloWebhookPayload["call"] | undefined {
  return payload.call ?? payload.data;
}

/** Parse payload into ParsedCallEvent or null if not CALL_RECEIVED */
export function parseCallEvent(payload: WithAlloWebhookPayload): ParsedCallEvent | null {
  const topicOrEvent = (payload.topic ?? payload.event ?? "").toUpperCase();
  const isCallReceived =
    topicOrEvent === "CALL_RECEIVED" || payload.event === "call.completed";

  if (!isCallReceived) return null;

  const call = extractCall(payload);
  if (!call) return null;

  const id = call.id ?? call.callId ?? "";
  if (!id) return null;

  const fromNumber = (call.fromNumber ?? call.from ?? "").trim();
  const toNumber = (call.toNumber ?? call.to ?? "").trim();
  const durationSeconds =
    call.lengthInMinutes != null
      ? Math.round(call.lengthInMinutes * 60)
      : call.duration != null
        ? Math.round(call.duration)
        : 0;

  const dir = call.direction ?? call.type ?? "OUTBOUND";
  const direction = dir === "INBOUND" ? "INBOUND" : "OUTBOUND";
  const summary = (call.oneSentenceSummary ?? call.summary ?? undefined) || undefined;
  const recordingUrl = (call.recordingUrl ?? call.recording_url ?? undefined) || undefined;

  const timestampStr =
    call.startDate ?? call.started_at ?? call.startedAt ?? call.ended_at ?? call.endedAt;
  const timestamp = timestampStr ? new Date(timestampStr) : new Date();

  return {
    externalCallId: id,
    fromNumber,
    toNumber,
    duration: durationSeconds,
    direction,
    summary,
    recordingUrl,
    timestamp,
  };
}

/** Process parsed call event: find mission, create CallRecord (idempotent) */
export async function processCallEvent(event: ParsedCallEvent): Promise<void> {
  const match =
    (await findMissionByPhone(event.fromNumber)) ??
    (await findMissionByPhone(event.toNumber));

  if (!match) {
    log("withallo_webhook_no_mission", {
      externalCallId: event.externalCallId,
      fromNumber: event.fromNumber,
      toNumber: event.toNumber,
    });
    return;
  }

  const existing = await prisma.callRecord.findUnique({
    where: {
      source_externalCallId: {
        source: "withallo",
        externalCallId: event.externalCallId,
      },
    },
  });

  if (existing) {
    log("withallo_webhook_duplicate", { externalCallId: event.externalCallId });
    return;
  }

  await prisma.callRecord.create({
    data: {
      missionId: match.missionId,
      contactId: match.contactId ?? undefined,
      companyId: match.companyId ?? undefined,
      externalCallId: event.externalCallId,
      source: "withallo",
      fromNumber: event.fromNumber || undefined,
      toNumber: event.toNumber || undefined,
      duration: event.duration || undefined,
      direction: event.direction,
      summary: event.summary,
      recordingUrl: event.recordingUrl,
      timestamp: event.timestamp,
    },
  });

  log("withallo_webhook_created", {
    externalCallId: event.externalCallId,
    missionId: match.missionId,
  });
}
