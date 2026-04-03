import { DateTime } from 'luxon';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { prisma } from '@/lib/prisma';
import { callProvider } from './provider';

const DEFAULT_COUNTRY = (process.env.PHONE_DEFAULT_COUNTRY ?? 'FR') as Parameters<typeof isValidPhoneNumber>[1];
const WINDOW_BEFORE_MS = parseInt(process.env.CALL_ENRICHMENT_WINDOW_BEFORE_MS ?? '3600000', 10); // 60 min (call happens before action is saved)
const WINDOW_AFTER_MS  = parseInt(process.env.CALL_ENRICHMENT_WINDOW_AFTER_MS  ?? '300000',  10); // 5 min
/** IANA zone for “whole calendar day” matching (default France). */
const ENRICHMENT_DAY_TZ = process.env.CALL_ENRICHMENT_DAY_TZ ?? 'Europe/Paris';
const USE_RELATIVE_WINDOW =
  process.env.CALL_ENRICHMENT_RELATIVE_WINDOW === '1' ||
  process.env.CALL_ENRICHMENT_RELATIVE_WINDOW === 'true';

function enrichmentWindowForAction(createdAt: Date): { windowStart: Date; windowEnd: Date; logHint: string } {
  if (USE_RELATIVE_WINDOW) {
    return {
      windowStart: new Date(createdAt.getTime() - WINDOW_BEFORE_MS),
      windowEnd:   new Date(createdAt.getTime() + WINDOW_AFTER_MS),
      logHint:     `relative ±${WINDOW_BEFORE_MS / 1000}s before / ${WINDOW_AFTER_MS / 1000}s after`,
    };
  }
  const local = DateTime.fromJSDate(createdAt, { zone: 'utc' }).setZone(ENRICHMENT_DAY_TZ);
  const start = local.startOf('day');
  const end = local.endOf('day');
  return {
    windowStart: start.toUTC().toJSDate(),
    windowEnd:   end.toUTC().toJSDate(),
    logHint:     `calendar day ${start.toISODate()} (${ENRICHMENT_DAY_TZ})`,
  };
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    if (isValidPhoneNumber(raw, DEFAULT_COUNTRY)) {
      return parsePhoneNumber(raw, DEFAULT_COUNTRY).format('E.164');
    }
    return null;
  } catch {
    return null;
  }
}

async function collectCandidatePhones(actionId: string): Promise<string[]> {
  const action = await prisma.action.findUnique({
    where: { id: actionId },
    select: {
      meetingPhone: true,
      contact: { select: { phone: true } },
      company:  { select: { phone: true } },
    },
  });
  if (!action) return [];

  const normalized = [action.meetingPhone, action.contact?.phone, action.company?.phone]
    .map(normalizePhone)
    .filter((p): p is string => p !== null);

  return [...new Set(normalized)];
}

function getAlloNumbers(): string[] {
  return (process.env.ALLO_NUMBERS ?? '').split(',').map((n) => n.trim()).filter(Boolean);
}

export async function enrichActionFromCallProvider(actionId: string): Promise<void> {
  console.log(`[call-enrichment] ▶ start actionId=${actionId}`);

  const action = await prisma.action.findUnique({
    where: { id: actionId },
    select: { id: true, sdrId: true, createdAt: true, callEnrichmentAt: true, callSummary: true, callRecordingUrl: true },
  });

  if (!action) {
    console.warn(`[call-enrichment] action not found actionId=${actionId}`);
    return;
  }
  // Skip only if enrichment ran AND produced at least some data (summary OR recording)
  if (action.callEnrichmentAt && (action.callSummary || action.callRecordingUrl)) {
    console.log(`[call-enrichment] already enriched, skipping actionId=${actionId}`);
    return;
  }

  const phones = await collectCandidatePhones(actionId);
  const alloNumbers = getAlloNumbers();

  console.log(`[call-enrichment] phones=${JSON.stringify(phones)} alloNumbers=${JSON.stringify(alloNumbers)}`);

  if (phones.length === 0) {
    console.warn(`[call-enrichment] BLOCKED — no valid phone found on contact/company/meetingPhone for actionId=${actionId}`);
    await prisma.action.update({ where: { id: actionId }, data: { callEnrichmentError: 'NO_PHONE' } });
    return;
  }

  if (alloNumbers.length === 0) {
    console.warn(`[call-enrichment] BLOCKED — ALLO_NUMBERS env var is empty, no allo number to search with`);
    await prisma.action.update({ where: { id: actionId }, data: { callEnrichmentError: 'NO_ALLO_NUMBERS' } });
    return;
  }

  const { windowStart, windowEnd, logHint } = enrichmentWindowForAction(action.createdAt);
  console.log(`[call-enrichment] window ${windowStart.toISOString()} → ${windowEnd.toISOString()} (${logHint})`);

  let record;
  try {
    record = await callProvider.fetchMatchingCallRecord({ phones, alloNumbers, sdrId: action.sdrId, windowStart, windowEnd });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : 'PROVIDER_ERROR';
    console.error(`[call-enrichment] provider threw error actionId=${actionId}:`, msg);
    await prisma.action.update({ where: { id: actionId }, data: { callEnrichmentError: msg } });
    return;
  }

  if (!record) {
    console.warn(`[call-enrichment] NO_MATCH — Allo returned no call in the time window for actionId=${actionId}`);
    await prisma.action.update({ where: { id: actionId }, data: { callEnrichmentError: 'NO_MATCH' } });
    return;
  }

  console.log(`[call-enrichment] ✓ match found — summary=${!!record.summary} transcription=${!!record.transcription} recording=${!!record.recordingUrl}`);

  // Another writer (e.g. SDR picked a call manually) may have enriched while we were fetching — do not overwrite.
  const latest = await prisma.action.findUnique({
    where: { id: actionId },
    select: { callEnrichmentAt: true, callSummary: true, callRecordingUrl: true },
  });
  if (latest?.callEnrichmentAt && (latest.callSummary || latest.callRecordingUrl)) {
    console.log(`[call-enrichment] skip — already enriched concurrently actionId=${actionId}`);
    return;
  }

  await prisma.action.update({
    where: { id: actionId },
    data: {
      callSummary:         record.summary        ?? null,
      callTranscription:   record.transcription  ?? null,
      callRecordingUrl:    record.recordingUrl   ?? null,
      callEnrichmentAt:    new Date(),
      callEnrichmentError: null,
    },
  });

  console.log(`[call-enrichment] ✓ done actionId=${actionId}`);
}
