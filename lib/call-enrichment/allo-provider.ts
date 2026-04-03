import type { CallProvider, CallProviderInput, CallRecord } from './provider';
import { parseAlloCallsListResponse } from './allo-response';

const BASE_URL = 'https://api.withallo.com';
const MAX_PAGES = Math.max(1, parseInt(process.env.CALL_ENRICHMENT_ALLO_MAX_PAGES ?? '60', 10));

interface AlloTranscriptEntry {
  source: 'AGENT' | 'EXTERNAL' | 'USER';
  text: string;
  start_time?: number;
}

interface AlloCall {
  id: string;
  from: string;
  to: string;
  duration: number;
  direction: 'INBOUND' | 'OUTBOUND';
  outcome?: string;
  summary?: string;
  recording_url?: string;
  transcript?: AlloTranscriptEntry[];
  /** Some API versions return a single string instead of transcript[] */
  transcriptPlain?: string;
  created_at?: string;
  /** ISO string or unix seconds depending on Allo version */
  start_time?: string | number;
}

function normalizeAlloCall(raw: Record<string, unknown>): AlloCall {
  const from = String(raw.from ?? raw.from_number ?? '');
  const to = String(raw.to ?? raw.to_number ?? '');
  const typeRaw = String(raw.direction ?? raw.type ?? 'OUTBOUND').toUpperCase();
  const direction: 'INBOUND' | 'OUTBOUND' = typeRaw === 'INBOUND' ? 'INBOUND' : 'OUTBOUND';

  let duration = typeof raw.duration === 'number' ? raw.duration : 0;
  if (!duration && typeof raw.length_in_minutes === 'number') {
    duration = Math.round(raw.length_in_minutes * 60);
  }

  const startRaw = raw.start_time ?? raw.start_date ?? raw.created_at;

  const recordingRaw = raw.recording_url ?? raw.recording;
  const recording_url =
    typeof recordingRaw === 'string' && /^https?:\/\//i.test(recordingRaw) ? recordingRaw : undefined;

  const summary =
    typeof raw.summary === 'string'
      ? raw.summary
      : typeof raw.call_summary === 'string'
        ? raw.call_summary
        : undefined;

  const transcript = Array.isArray(raw.transcript) ? (raw.transcript as AlloTranscriptEntry[]) : undefined;
  const transcriptPlain =
    typeof raw.transcription === 'string' && raw.transcription.trim()
      ? raw.transcription
      : undefined;

  return {
    id:           String(raw.id ?? ''),
    from,
    to,
    duration,
    direction,
    outcome:      typeof raw.outcome === 'string' ? raw.outcome : undefined,
    summary,
    recording_url,
    transcript,
    transcriptPlain,
    created_at:   typeof raw.created_at === 'string' ? raw.created_at : undefined,
    start_time:   typeof startRaw === 'string' || typeof startRaw === 'number' ? startRaw : undefined,
  };
}

function formatTranscript(entries: AlloTranscriptEntry[]): string {
  return entries.map((e) => `${e.source}: ${e.text}`).join('\n');
}

/** Prefer calls with real Allo content; tie-break with duration then recency. */
function contentScore(call: AlloCall): number {
  let s = 0;
  if (call.summary?.trim()) s += 1_000_000;
  if (call.transcript?.length) {
    const len = call.transcript.reduce((n, e) => n + (e.text?.length ?? 0), 0);
    s += 100_000 + Math.min(len, 50_000);
  }
  if (call.transcriptPlain?.trim()) s += 100_000 + Math.min(call.transcriptPlain.length, 50_000);
  if (call.recording_url?.trim()) s += 10_000;
  s += Math.min(call.duration, 3600);
  return s;
}

function alloCallToRecord(call: AlloCall): CallRecord {
  const transcription = call.transcript?.length
    ? formatTranscript(call.transcript)
    : call.transcriptPlain?.trim() || undefined;
  return {
    summary:        call.summary?.trim() || undefined,
    transcription,
    recordingUrl:   call.recording_url?.trim() || undefined,
  };
}

function callTimestamp(call: AlloCall): Date | null {
  const raw = call.start_time ?? call.created_at;
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return new Date(raw > 1e12 ? raw : raw * 1000);
  return new Date(raw);
}

function callFallsInWindow(call: AlloCall, windowStart: Date, windowEnd: Date): boolean {
  const ts = callTimestamp(call);
  if (!ts || Number.isNaN(ts.getTime())) return true; // can't determine — include it
  return ts >= windowStart && ts <= windowEnd;
}

/**
 * All format variants of a phone number to match against Allo's from/to fields.
 * Allo may store numbers in local, E.164, or without-plus format.
 */
function phoneVariants(e164: string): string[] {
  const variants: string[] = [e164];
  if (e164.startsWith('+33')) {
    variants.push('0' + e164.slice(3)); // French local: 0644606054
  }
  if (e164.startsWith('+')) {
    variants.push(e164.slice(1)); // without leading +: 33644606054
  }
  return [...new Set(variants)];
}

function stripSpaces(s: string): string {
  return s.replace(/\s+/g, '');
}

function phoneMatchesCall(call: AlloCall, variants: string[]): boolean {
  const fromN = stripSpaces(call.from ?? '').toLowerCase();
  const toN = stripSpaces(call.to ?? '').toLowerCase();
  return variants.some((v) => {
    const q = stripSpaces(v).toLowerCase();
    return fromN.includes(q) || toN.includes(q);
  });
}

export class AlloProvider implements CallProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch one page of calls for an allo_number WITHOUT contact_number filter.
   * Allo's contact_number filter has proven unreliable (returns 0 even when calls exist).
   * We fetch by allo_number only and match the contact phone locally against from/to.
   */
  private async fetchPageForLine(alloNumber: string, page: number): Promise<{ calls: AlloCall[]; totalPages: number }> {
    const url = new URL(`${BASE_URL}/v1/api/calls`);
    url.searchParams.set('allo_number', alloNumber);
    url.searchParams.set('size', String(Math.min(100, Math.max(1, parseInt(process.env.CALL_ENRICHMENT_ALLO_PAGE_SIZE ?? '100', 10)))));
    url.searchParams.set('page', String(page));

    console.log(`[call-enrichment][allo] GET ${url.toString()}`);

    const res = await fetch(url.toString(), {
      headers: { Authorization: this.apiKey },
    });

    console.log(`[call-enrichment][allo] response status=${res.status} alloNumber=${alloNumber} page=${page}`);

    if (res.status === 401 || res.status === 403) {
      throw new Error(`Allo API auth error: ${res.status}`);
    }
    if (!res.ok) {
      console.warn(`[call-enrichment][allo] non-ok response ${res.status} for alloNumber=${alloNumber}`);
      return { calls: [], totalPages: 0 };
    }

    const data = await res.json();
    const { rawCalls, totalPages } = parseAlloCallsListResponse(data);
    const calls = rawCalls.map(normalizeAlloCall).filter((c) => c.id);
    console.log(`[call-enrichment][allo] page=${page}/${totalPages} count=${calls.length} for alloNumber=${alloNumber}`);
    return { calls, totalPages };
  }

  private async searchForLine(
    alloNumber: string,
    contactPhoneVariants: string[],
    windowStart: Date,
    windowEnd: Date,
  ): Promise<AlloCall | null> {
    // Fetch pages until we find a match or go past the window (busy lines need more pages for a full day)
    for (let page = 0; page < MAX_PAGES; page++) {
      const { calls, totalPages } = await this.fetchPageForLine(alloNumber, page);

      if (calls.length === 0) break;

      for (const call of calls) {
        const inWindow = callFallsInWindow(call, windowStart, windowEnd);
        const matchesPhone = phoneMatchesCall(call, contactPhoneVariants);

        if (inWindow && matchesPhone) {
          console.log(
            `[call-enrichment][allo] ✓ match callId=${call.id} from=${call.from} to=${call.to} ` +
            `start=${call.start_time ?? call.created_at} duration=${call.duration}s ` +
            `line=${alloNumber}`
          );
          return call;
        }

        // Log near-misses to help debug
        if (matchesPhone && !inWindow) {
          console.log(
            `[call-enrichment][allo] phone match but outside window: callId=${call.id} ` +
            `ts=${call.start_time ?? call.created_at} window=${windowStart.toISOString()}→${windowEnd.toISOString()}`
          );
        }
      }

      // Stop if oldest result on this page is already before our window
      const oldest = calls[calls.length - 1];
      const oldestTs = callTimestamp(oldest);
      if (oldestTs && !Number.isNaN(oldestTs.getTime())) {
        if (oldestTs < windowStart) {
          console.log(`[call-enrichment][allo] oldest result (${oldestTs.toISOString()}) is before windowStart — stopping`);
          break;
        }
      }

      if (page + 1 >= totalPages) break;
    }

    return null;
  }

  async fetchMatchingCallRecord(input: CallProviderInput): Promise<CallRecord | null> {
    const { phones, alloNumbers, windowStart, windowEnd } = input;

    // Build all phone variants once
    const contactVariants = phones.flatMap(phoneVariants);
    console.log(`[call-enrichment][allo] searching across ${alloNumbers.length} lines, contact variants: ${contactVariants.join(', ')}`);
    console.log(`[call-enrichment][allo] window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

    // Search each allo line in parallel (same contact can appear on several lines — pick richest payload)
    const lineMatches = await Promise.all(
      alloNumbers.map((n) => this.searchForLine(n, contactVariants, windowStart, windowEnd))
    );

    const candidates = lineMatches.filter((c): c is AlloCall => c !== null);
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const sa = contentScore(a);
      const sb = contentScore(b);
      if (sb !== sa) return sb - sa;
      const ta = callTimestamp(a)?.getTime() ?? 0;
      const tb = callTimestamp(b)?.getTime() ?? 0;
      return tb - ta;
    });

    const best = candidates[0]!;
    if (candidates.length > 1) {
      console.log(
        `[call-enrichment][allo] chose best of ${candidates.length} line matches: callId=${best.id} ` +
        `contentScore=${contentScore(best)} (prefer summary/transcript/recording, then duration, then newest)`
      );
    }

    return alloCallToRecord(best);
  }
}
