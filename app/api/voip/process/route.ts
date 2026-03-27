import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { prisma } from "@/lib/prisma";
import { publishToUser } from "@/lib/comms/events";
import { getVoipAdapter } from "@/lib/voip/factory";
import { matchContactByPhone, getSdrIdByVoipNumber } from "@/lib/voip/processor";
import { findMissionByPhone } from "@/lib/webhooks/withallo/findMissionByPhone";
import { normalizePhone, last9Digits } from "@/lib/voip/normalizePhone";
import type { VoipProvider, NormalizedCall } from "@/lib/voip/types";
import type { VoipEventJobData } from "@/lib/voip/queue";

function log(event: string, data: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ event, ...data, timestamp: new Date().toISOString() }),
  );
}

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY ?? "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? "",
});

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify QStash signature in production
  if (process.env.NODE_ENV === "production") {
    const signature = request.headers.get("upstash-signature") ?? "";
    try {
      await receiver.verify({ signature, body: rawBody });
    } catch {
      log("voip_process_signature_invalid", {});
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let data: VoipEventJobData;
  try {
    data = JSON.parse(rawBody) as VoipEventJobData;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await processVoipEvent(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log("voip_process_error", {
      provider: data.provider,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 },
    );
  }
}

async function processVoipEvent(data: VoipEventJobData): Promise<void> {
  const { provider: rawProvider, rawPayload, receivedAt } = data;
  const provider = rawProvider as VoipProvider;

  log("voip_process_started", { provider, receivedAt });

  const adapter = getVoipAdapter(provider);
  const normalizedCall = adapter.parseWebhook(rawPayload);

  if (!normalizedCall) {
    log("voip_process_skipped_irrelevant", { provider });
    return;
  }

  normalizedCall.fromNumber = normalizePhone(normalizedCall.fromNumber);
  normalizedCall.toNumber = normalizePhone(normalizedCall.toNumber);

  // Idempotency: check if this call already exists
  const existingRecord = await prisma.callRecord.findFirst({
    where: {
      provider,
      externalCallId: normalizedCall.providerCallId,
    },
  });

  if (existingRecord) {
    log("voip_process_duplicate_skipped", {
      provider,
      externalCallId: normalizedCall.providerCallId,
    });
    return;
  }

  // Resolve SDR
  const isInbound = normalizedCall.direction === "inbound";
  const sdrId = isInbound
    ? await getSdrIdByVoipNumber(provider, normalizedCall.toNumber)
    : await adapter.matchSdr(normalizedCall);

  // Match contact/company
  const prospectNumber = isInbound
    ? normalizedCall.fromNumber
    : normalizedCall.toNumber;
  const { contact, company } = await matchContactByPhone(prospectNumber);

  // Find mission via phone number fallback
  const missionMatch =
    (await findMissionByPhone(normalizedCall.fromNumber)) ??
    (await findMissionByPhone(normalizedCall.toNumber));

  const missionId = missionMatch?.missionId;

  if (!missionId) {
    log("voip_process_no_mission", {
      provider,
      externalCallId: normalizedCall.providerCallId,
      fromNumber: normalizedCall.fromNumber,
      toNumber: normalizedCall.toNumber,
    });
    return;
  }

  // Try to link to an existing CallSession
  let sessionId: string | null = null;
  if (sdrId && prospectNumber) {
    const last9 = last9Digits(prospectNumber);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const session = await prisma.callSession.findFirst({
      where: {
        sdrId,
        status: "pending",
        createdAt: { gte: fiveMinAgo },
        phoneNumber: { contains: last9 },
      },
      orderBy: { createdAt: "desc" },
    });

    if (session) {
      sessionId = session.id;
      await prisma.callSession.update({
        where: { id: session.id },
        data: { status: "linked" },
      });
    }
  }

  const durationSeconds =
    normalizedCall.durationSeconds ??
    (normalizedCall.startedAt && normalizedCall.endedAt
      ? Math.round(
          (normalizedCall.endedAt.getTime() -
            normalizedCall.startedAt.getTime()) /
            1000,
        )
      : 0);

  const callRecord = await prisma.callRecord.create({
    data: {
      missionId,
      contactId: contact?.id ?? missionMatch?.contactId ?? undefined,
      companyId: company?.id ?? missionMatch?.companyId ?? undefined,
      sessionId: sessionId ?? undefined,
      externalCallId: normalizedCall.providerCallId,
      source: provider,
      provider,
      fromNumber: normalizedCall.fromNumber || undefined,
      toNumber: normalizedCall.toNumber || undefined,
      duration: durationSeconds,
      durationSeconds,
      direction: normalizedCall.direction?.toUpperCase(),
      summary: normalizedCall.aiSummary,
      recordingUrl: normalizedCall.recordingUrl,
      timestamp: normalizedCall.startedAt ?? new Date(),
      startedAt: normalizedCall.startedAt,
      endedAt: normalizedCall.endedAt,
      rawPayload: rawPayload as object,
      sdrId: sdrId ?? undefined,
    },
  });

  // Store transcripts
  if (normalizedCall.aiTranscript && normalizedCall.aiTranscript.length > 0) {
    const validTranscripts = normalizedCall.aiTranscript.filter(
      (t) => t.text?.trim(),
    );
    if (validTranscripts.length > 0) {
      await prisma.callTranscript.createMany({
        data: validTranscripts.map((t) => ({
          callRecordId: callRecord.id,
          source: provider,
          text: t.text,
          startSeconds: t.startSeconds,
          endSeconds: t.endSeconds,
          speaker: t.speaker,
        })),
        skipDuplicates: true,
      });
    }
  }

  log("voip_process_call_saved", {
    provider,
    callRecordId: callRecord.id,
    externalCallId: normalizedCall.providerCallId,
    missionId,
    sdrId,
    sessionId,
    transcriptCount: normalizedCall.aiTranscript?.length ?? 0,
  });

  // Link to Action record (unified VoIP layer)
  if (sdrId && (contact?.id || company?.id)) {
    await linkToActionRecord(normalizedCall, provider, sdrId, contact, company);
  }
  await backfillCallRecordSummaryFromAction(callRecord.id, provider, normalizedCall.providerCallId);

  // Notify SDR in real-time
  if (sdrId) {
    publishToUser(sdrId, {
      type: "voip:call-completed",
      threadId: "",
      actionId: callRecord.id,
      provider,
      duration: durationSeconds,
      summary: normalizedCall.aiSummary,
      hasTranscript: !!(normalizedCall.aiTranscript?.length),
      contactName: contact
        ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
          normalizedCall.toNumber
        : normalizedCall.toNumber,
      enrichmentPending: normalizedCall.enrichmentPending,
      recordingUrl: normalizedCall.recordingUrl ?? undefined,
    } as Parameters<typeof publishToUser>[1]);
  }

  // Enrichment: for serverless, fetch immediately if provider supports it
  if (normalizedCall.enrichmentPending && adapter.fetchEnrichment) {
    try {
      const enriched = await adapter.fetchEnrichment(
        normalizedCall.providerCallId,
      );

      await prisma.callRecord.update({
        where: { id: callRecord.id },
        data: { summary: enriched.aiSummary ?? undefined },
      });

      if (enriched.aiTranscript && enriched.aiTranscript.length > 0) {
        await prisma.callTranscript.createMany({
          data: enriched.aiTranscript
            .filter((t) => t.text?.trim())
            .map((t) => ({
              callRecordId: callRecord.id,
              source: "enrichment",
              text: t.text,
              startSeconds: t.startSeconds,
              endSeconds: t.endSeconds,
              speaker: t.speaker,
            })),
          skipDuplicates: true,
        });
      }

      if (sdrId) {
        publishToUser(sdrId, {
          type: "voip:enrichment-ready",
          threadId: "",
          actionId: callRecord.id,
          summary: enriched.aiSummary,
        } as Parameters<typeof publishToUser>[1]);
      }

      log("voip_process_enrichment_complete", {
        callRecordId: callRecord.id,
        provider,
      });
    } catch (err) {
      log("voip_process_enrichment_failed", {
        callRecordId: callRecord.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function backfillCallRecordSummaryFromAction(
  callRecordId: string,
  provider: VoipProvider,
  providerCallId: string,
): Promise<void> {
  const callRecord = await prisma.callRecord.findUnique({
    where: { id: callRecordId },
    select: { summary: true },
  });
  if (callRecord?.summary) return;

  const action = await prisma.action.findFirst({
    where: {
      voipProvider: provider,
      voipCallId: providerCallId,
      voipSummary: { not: null },
    },
    select: { voipSummary: true },
  });

  if (!action?.voipSummary?.trim()) return;

  await prisma.callRecord.update({
    where: { id: callRecordId },
    data: { summary: action.voipSummary },
  });
}

async function linkToActionRecord(
  normalizedCall: NormalizedCall,
  provider: VoipProvider,
  sdrId: string,
  contact: { id: string } | null,
  company: { id: string } | null,
): Promise<void> {
  let existing = await prisma.action.findFirst({
    where: {
      voipProvider: provider,
      voipCallId: normalizedCall.providerCallId,
    },
  });

  // Allo: initiate creates action with voipCallId "pending:uuid"; webhook has real id
  if (
    !existing &&
    provider === "allo" &&
    normalizedCall.providerCallId &&
    sdrId
  ) {
    existing = await prisma.action.findFirst({
      where: {
        voipProvider: "allo",
        sdrId,
        actionStatus: "IN_PROGRESS",
        OR: [
          { voipCallId: "" },
          { voipCallId: null },
          { voipCallId: { startsWith: "pending:" } },
        ],
        ...(contact?.id
          ? { contactId: contact.id }
          : company?.id
            ? { companyId: company.id }
            : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (existing) {
    await prisma.action.update({
      where: { id: existing.id },
      data: {
        voipCallId: normalizedCall.providerCallId || existing.voipCallId,
        duration: normalizedCall.durationSeconds,
        voipRecordingUrl: normalizedCall.recordingUrl ?? undefined,
        voipSummary: normalizedCall.aiSummary ?? undefined,
        voipTranscript: (normalizedCall.aiTranscript ?? undefined) as
          | object
          | undefined,
        note: normalizedCall.aiSummary ?? existing.note,
        actionStatus:
          provider === "allo" && !normalizedCall.enrichmentPending
            ? null
            : "PENDING_VALIDATION",
      },
    });
  }
}
