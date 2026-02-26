// ============================================
// POST /api/enricher/serp-lookup — SerpAPI Google Maps phone lookup
// Searches places by company name + address, matches approx, returns phone
// ============================================

import { NextRequest } from 'next/server';
import {
    successResponse,
    errorResponse,
    requireAuth,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

const serpLookupSchema = z.object({
    company_name: z.string().optional(),
    address: z.string().optional(),
    website: z.string().optional(),
});

// Normalize string for fuzzy comparison
function normalizeForMatch(s: string): string {
    return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Get word overlap score (0–100) between company name and place title
function fuzzyCompanyScore(companyName: string, placeTitle: string): number {
    if (!companyName) return 50; // No company → accept first result
    const c = normalizeForMatch(companyName);
    const t = normalizeForMatch(placeTitle);
    if (!c) return 50;
    if (c === t) return 100;
    if (t.includes(c) || c.includes(t)) return 90;
    const cWords = new Set(c.split(/\s+/).filter((w) => w.length > 1));
    const tWords = new Set(t.split(/\s+/).filter((w) => w.length > 1));
    if (cWords.size === 0) return 50;
    let overlap = 0;
    for (const w of cWords) {
        if (tWords.has(w)) overlap++;
        else if ([...tWords].some((tw) => tw.includes(w) || w.includes(tw))) overlap += 0.8;
    }
    const score = Math.round((overlap / cWords.size) * 100);
    return Math.min(100, score);
}

// Check if address overlaps with place address
function addressOverlap(addr: string, placeAddr: string): boolean {
    if (!addr || !placeAddr) return false;
    const a = normalizeForMatch(addr);
    const p = normalizeForMatch(placeAddr);
    const aWords = a.split(/\s+/).filter((w) => w.length > 2);
    let matches = 0;
    for (const w of aWords) {
        if (p.includes(w)) matches++;
    }
    return matches >= Math.min(2, aWords.length);
}

const FAKE_NUMBERS = new Set([
    '0000000000', '1111111111', '2222222222', '3333333333', '4444444444',
    '5555555555', '6666666666', '7777777777', '8888888888', '9999999999',
    '1234567890', '0123456789', '0606060606',
]);

function isValidPhone(phone: string): boolean {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return false;
    if (FAKE_NUMBERS.has(digits)) return false;
    if (/^(.)\1{6,}$/.test(digits)) return false;
    return true;
}

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireAuth(request);

    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
        return errorResponse('SERP_API_KEY non configurée. Ajoutez-la dans .env', 503);
    }

    const { company_name, address, website } = await validateRequest(request, serpLookupSchema);

    if (!company_name && !address) {
        return errorResponse('Au moins company_name ou address requis', 400);
    }

    // Build search query: company + address for Google Maps
    const queryParts: string[] = [];
    if (company_name) queryParts.push(company_name.trim());
    if (address) queryParts.push(address.trim());
    const q = queryParts.join(' ');

    if (!q.trim()) {
        return errorResponse('Requête vide', 400);
    }

    const params = new URLSearchParams({
        engine: 'google_maps',
        type: 'search',
        q: q.trim(),
        api_key: apiKey,
        hl: 'fr',
        gl: 'fr',
    });

    try {
        const resp = await fetch(`https://serpapi.com/search?${params.toString()}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
        });

        if (!resp.ok) {
            const errText = await resp.text();
            console.error('SerpAPI error:', resp.status, errText);
            return errorResponse(`Erreur SerpAPI: ${resp.status}`, resp.status);
        }

        const data = (await resp.json()) as {
            local_results?: Array<{
                title?: string;
                address?: string;
                phone?: string;
                place_id?: string;
            }>;
            search_metadata?: { status?: string };
            error?: string;
        };

        if (data.error) {
            return errorResponse(data.error, 400);
        }

        const localResults = data.local_results || [];
        let best: { phone: string; source: string; confidence: number } | null = null;

        for (const place of localResults) {
            const phone = place.phone?.trim();
            if (!phone || !isValidPhone(phone)) continue;

            const companyScore = fuzzyCompanyScore(company_name || '', place.title || '');
            const addrMatch = address ? addressOverlap(address, place.address || '') : false;
            let confidence = companyScore;
            if (addrMatch) confidence = Math.min(100, confidence + 15);
            if (companyScore >= 60) {
                if (!best || confidence > best.confidence) {
                    best = {
                        phone,
                        source: 'serp_google_maps',
                        confidence: Math.min(100, confidence),
                    };
                }
            }
        }

        // If no good match but we have results with phones, take best by position
        if (!best && localResults.length > 0) {
            const firstWithPhone = localResults.find((p) => p.phone && isValidPhone(p.phone));
            if (firstWithPhone?.phone) {
                const companyScore = fuzzyCompanyScore(company_name || '', firstWithPhone.title || '');
                best = {
                    phone: firstWithPhone.phone.trim(),
                    source: 'serp_google_maps',
                    confidence: Math.max(40, companyScore),
                };
            }
        }

        return successResponse({
            phone_number: best?.phone ?? null,
            source: best?.source ?? null,
            confidence: best?.confidence ?? 0,
        });
    } catch (err) {
        console.error('SerpAPI lookup failed:', err);
        return errorResponse('Erreur lors de la recherche SerpAPI', 500);
    }
});
