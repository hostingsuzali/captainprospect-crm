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

async function fetchAlloPage(apiKey: string, alloNumber: string, contactNumber: string) {
  const url = new URL(`${BASE_URL}/v1/api/calls`);
  url.searchParams.set('allo_number', alloNumber);
  url.searchParams.set('contact_number', contactNumber);
  url.searchParams.set('size', '20');
  url.searchParams.set('page', '0');

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
    next: { revalidate: 0 },
  });

  if (!res.ok) return [];
  const data = await res.json();
  const { rawCalls } = parseAlloCallsListResponse(data);
  return rawCalls;
}

// GET /api/sdr/calls/for-contact?phone=+33644606054
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
  }

  const phone = req.nextUrl.searchParams.get('phone');
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

  // Fan out: all allo_numbers × phone variants, collect and deduplicate by call id
  const fetches = alloNumbers.flatMap((alloNumber) =>
    variants.map((v) => fetchAlloPage(apiKey, alloNumber, v))
  );

  const pages = await Promise.allSettled(fetches);
  const allCalls: Record<string, object> = {};

  for (const p of pages) {
    if (p.status !== 'fulfilled') continue;
    for (const call of p.value) {
      if (call?.id) allCalls[call.id] = call;
    }
  }

  // Sort newest first
  const calls = Object.values(allCalls).sort((a: any, b: any) => {
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
      },
    },
  });
}
