// ============================================
// Sync a single Action from Allo API when webhook has not yet arrived
// ============================================

import { prisma } from "@/lib/prisma";
import { fetchCalls, type AlloCallRecord, type AlloTranscriptRow } from "./api";
import type { TranscriptSegment } from "../../types";

const MATCH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes before/after action createdAt

function normalizePhone(p: string): string {
  return p.replace(/\s/g, "").replace(/^00/, "+");
}

/** Digits only; for matching we use last 9 digits (FR mobile) or full if short */
function digitsOnly(p: string): string {
  return p.replace(/\D/g, "");
}

function phonesMatch(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  const len = Math.min(da.length, db.length, 9);
  return da.slice(-len) === db.slice(-len) || da.slice(-9) === db.slice(-9);
}

function transcriptToSegment(t: AlloTranscriptRow): TranscriptSegment {
  const speaker =
    t.source === "EXTERNAL" || t.source === "external" ? "prospect" : "agent";
  return {
    speaker,
    text: t.text ?? "",
    startSeconds: t.start_seconds ?? 0,
    endSeconds: t.end_seconds,
  };
}

/**
 * Find an Allo call that matches this action: same SDR Allo number, contact/company phone, and start_date near action.createdAt.
 */
function matchCallToAction(
  calls: AlloCallRecord[],
  action: { createdAt: Date; contactId: string | null; companyId: string | null },
  contactPhone: string | null,
  companyPhone: string | null,
  alloNumber: string
): AlloCallRecord | null {
  const targetPhone = normalizePhone(contactPhone ?? companyPhone ?? "");
  if (!targetPhone) return null;
  const actionTime = action.createdAt.getTime();
  for (const call of calls) {
    const callTime = new Date(call.start_date).getTime();
    if (Math.abs(callTime - actionTime) > MATCH_WINDOW_MS) continue;
    const from = normalizePhone(call.from_number);
    const to = call.to_number ? normalizePhone(call.to_number) : "";
    const isOutbound = call.type === "OUTBOUND";
    const otherParty = isOutbound ? to : from;
    if (otherParty && targetPhone && phonesMatch(otherParty, targetPhone)) {
      return call;
    }
  }
  return null;
}

export interface SyncAlloCallResult {
  ok: boolean;
  updated?: boolean;
  error?: string;
}

/**
 * If the action is an Allo call without voipSummary yet, fetch recent calls from Allo API,
 * match by SDR number + contact/company phone + time, and update the action.
 */
export async function syncAlloCallForAction(
  actionId: string
): Promise<SyncAlloCallResult> {
  const action = await prisma.action.findUnique({
    where: { id: actionId },
    include: {
      contact: { select: { phone: true } },
      company: { select: { phone: true } },
    },
  });
  if (!action) return { ok: false, error: "Action introuvable" };
  if (action.voipProvider !== "allo") return { ok: true, updated: false };
  if (action.voipSummary) return { ok: true, updated: false };

  const config = await prisma.userVoipConfig.findFirst({
    where: { userId: action.sdrId, provider: "allo", active: true },
    select: { alloNumber: true },
  });
  if (!config?.alloNumber) return { ok: false, error: "Numéro Allo non configuré pour ce SDR" };

  const contactPhone = action.contact?.phone ?? null;
  const companyPhone = action.company?.phone ?? null;
  if (!contactPhone && !companyPhone) return { ok: false, error: "Aucun numéro pour ce contact/société" };

  const calls = await fetchCalls(config.alloNumber, { size: 20, page: 0 });
  const match = matchCallToAction(
    calls,
    action,
    contactPhone,
    companyPhone,
    config.alloNumber
  );
  if (!match) return { ok: true, updated: false };

  const durationSeconds = Math.round((match.length_in_minutes ?? 0) * 60);
  const voipTranscript = (match.transcript ?? []).map(transcriptToSegment) as object;

  await prisma.action.update({
    where: { id: actionId },
    data: {
      voipCallId: match.id,
      voipSummary: match.summary ?? undefined,
      voipTranscript: voipTranscript,
      voipRecordingUrl: match.recording_url ?? undefined,
      duration: durationSeconds,
      note: match.summary ?? action.note,
    },
  });

  return { ok: true, updated: true };
}
