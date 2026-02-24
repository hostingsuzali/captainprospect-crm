// ============================================
// Allo API client — https://api.withallo.com
// Auth: Authorization: YOUR_API_KEY (no Bearer). Scope CONVERSATIONS_READ for calls.
// ============================================

import { getAlloApiKey } from "./adapter";

const ALLO_API_BASE = "https://api.withallo.com";

export class AlloApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = "AlloApiError";
  }
}

/** Single transcript row from Allo API (source: AGENT | EXTERNAL | USER) */
export interface AlloTranscriptRow {
  source?: string;
  text?: string;
  time?: string;
  start_seconds?: number;
  end_seconds?: number;
}

/** Call record from GET /v1/api/calls */
export interface AlloCallRecord {
  id: string;
  from_number: string;
  to_number: string | null;
  length_in_minutes: number;
  type: "INBOUND" | "OUTBOUND" | null;
  summary: string | null;
  tag: string | null;
  recording_url: string | null;
  start_date: string;
  transcript: AlloTranscriptRow[] | null;
}

/** Response shape from GET /v1/api/calls */
interface AlloCallsResponse {
  data?: {
    results?: AlloCallRecord[];
    metadata?: { total_pages?: number; current_page?: number };
  };
  code?: string;
  details?: unknown;
}

async function request(
  path: string,
  options: { method?: string; searchParams?: Record<string, string> } = {}
): Promise<unknown> {
  const apiKey = await getAlloApiKey();
  if (!apiKey) {
    throw new AlloApiError("ALLO_API_KEY non configuré", "API_KEY_MISSING", 500);
  }
  const url = new URL(path, ALLO_API_BASE);
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) =>
      url.searchParams.set(k, v)
    );
  }
  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
  });
  const body = (await res.json().catch(() => ({}))) as AlloCallsResponse & { code?: string };
  if (!res.ok) {
    const code = body.code ?? (res.status === 401 ? "API_KEY_INVALID" : undefined);
    throw new AlloApiError(
      body.code === "API_KEY_INVALID"
        ? "Clé API Allo invalide"
        : body.code === "API_KEY_INSUFFICIENT_SCOPE"
          ? "Clé API Allo : scope insuffisant (CONVERSATIONS_READ requis)"
          : `Allo API: ${res.status} ${res.statusText}`,
      code,
      res.status
    );
  }
  return body;
}

/**
 * Fetch recent calls for an Allo number (E.164).
 * Requires scope CONVERSATIONS_READ.
 */
export async function fetchCalls(
  alloNumber: string,
  params: { size?: number; page?: number } = {}
): Promise<AlloCallRecord[]> {
  const size = Math.min(100, Math.max(1, params.size ?? 10));
  const page = Math.max(0, params.page ?? 0);
  const response = (await request("/v1/api/calls", {
    searchParams: {
      allo_number: alloNumber,
      size: String(size),
      page: String(page),
    },
  })) as AlloCallsResponse;
  const results = response.data?.results ?? [];
  return results;
}
