import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseAlloCallsListResponse } from '@/lib/call-enrichment/allo-response';

const BASE_URL = 'https://api.withallo.com';

function phoneVariants(raw: string): string[] {
  const v: string[] = [raw];
  if (raw.startsWith('+33')) v.push('0' + raw.slice(3));
  if (raw.startsWith('+'))   v.push(raw.slice(1));
  return [...new Set(v)];
}

function getAlloNumbers(): string[] {
  return (process.env.ALLO_NUMBERS ?? '').split(',').map((n) => n.trim()).filter(Boolean);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const FOR_CONTACT_GAP_MS = Math.max(0, parseInt(process.env.CALL_ENRICHMENT_ALLO_LINE_GAP_MS ?? '120', 10));
const FOR_CONTACT_429_RETRIES = Math.max(0, parseInt(process.env.CALL_ENRICHMENT_ALLO_429_RETRIES ?? '6', 10));
const FOR_CONTACT_429_BASE_MS = Math.max(100, parseInt(process.env.CALL_ENRICHMENT_ALLO_429_BASE_MS ?? '750', 10));

function parisDayKey(value: Date): string {
  return value.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
}

async function fetchAlloPage(apiKey: string, alloNumber: string, contactNumber: string) {
  const url = new URL(`${BASE_URL}/v1/api/calls`);
  url.searchParams.set('allo_number', alloNumber);
  url.searchParams.set('contact_number', contactNumber);
  url.searchParams.set('size', '20');
  url.searchParams.set('page', '0');

  for (let attempt = 0; attempt <= FOR_CONTACT_429_RETRIES; attempt++) {
    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
      next: { revalidate: 0 },
    });

    if (res.status === 429 && attempt < FOR_CONTACT_429_RETRIES) {
      const backoff = Math.min(FOR_CONTACT_429_BASE_MS * 2 ** attempt, 30_000);
      await sleep(backoff);
      continue;
    }

    if (!res.ok) return [];
    const data = await res.json();
    const { rawCalls } = parseAlloCallsListResponse(data);
    return rawCalls;
  }
  return [];
}

// GET /api/sdr/calls/for-contact?phone=+33644606054
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
  }

  const phone = req.nextUrl.searchParams.get('phone');
  const meetingDate = req.nextUrl.searchParams.get('meetingDate');
  if (!phone) {
    return NextResponse.json({ success: false, error: 'phone requis' }, { status: 400 });
  }

  const apiKey = process.env.ALLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'ALLO_API_KEY non configuré' }, { status: 503 });
  }

  const alloNumbers = getAlloNumbers();
  if (alloNumbers.length === 0) {
    return NextResponse.json({ success: false, error: 'ALLO_NUMBERS non configuré' }, { status: 503 });
  }

  const variants = phoneVariants(phone);

  // Serial requests: parallel fan-out caused mass HTTP 429 from WithAllo (same as call-enrichment).
  const allCalls: Record<string, object> = {};
  for (let li = 0; li < alloNumbers.length; li++) {
    const alloNumber = alloNumbers[li]!;
    for (let vi = 0; vi < variants.length; vi++) {
      const v = variants[vi]!;
      const rawCalls = await fetchAlloPage(apiKey, alloNumber, v);
      for (const call of rawCalls) {
        const id = call.id != null ? String(call.id) : '';
        if (id) allCalls[id] = call;
      }
      if (vi < variants.length - 1 && FOR_CONTACT_GAP_MS > 0) await sleep(FOR_CONTACT_GAP_MS);
    }
    if (li < alloNumbers.length - 1 && FOR_CONTACT_GAP_MS > 0) await sleep(FOR_CONTACT_GAP_MS);
  }

  const targetMeetingDay = (() => {
    if (!meetingDate) return null;
    const d = new Date(meetingDate);
    if (Number.isNaN(d.getTime())) return null;
    return parisDayKey(d);
  })();

  let calls = Object.values(allCalls);
  if (targetMeetingDay) {
    calls = calls.filter((call: any) => {
      const ts = call.start_time ?? call.start_date ?? call.created_at;
      if (ts == null || ts === '') return false;
      const d = typeof ts === 'number'
        ? new Date(ts > 1e12 ? ts : ts * 1000)
        : new Date(String(ts));
      if (Number.isNaN(d.getTime())) return false;
      return parisDayKey(d) === targetMeetingDay;
    });
  }

  // Sort newest first
  calls = calls.sort((a: any, b: any) => {
    const ta = new Date(a.start_time ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.start_time ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });

  return NextResponse.json({
    success: true,
    data: {
      calls,
      meta: {
        filterPhone: phone,
        /** Lignes Allo interrogées (pour l’UI) */
        alloLineCount: alloNumbers.length,
        filteredOnMeetingDay: !!targetMeetingDay,
        meetingDay: targetMeetingDay,
      },
    },
  });
}
