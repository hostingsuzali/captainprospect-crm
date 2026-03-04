// ============================================
// POST /api/webhooks/withallo
// WithAllo webhook: accepts CALL_RECEIVED, verifies signature (placeholder),
// returns 200 OK immediately, processes async.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { verifyWebhookSignature } from "@/lib/webhooks/withallo/signature";
import {
  parseCallEvent,
  processCallEvent,
} from "@/lib/webhooks/withallo/processCallEvent";
import type { WithAlloWebhookPayload } from "@/lib/webhooks/withallo/types";

function log(event: string, data: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ event, ...data, timestamp: new Date().toISOString() })
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  let rawBody: string;

  try {
    rawBody = await request.text();
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const secret =
    (process.env.WITHALLO_WEBHOOK_SECRET ?? "").trim();
  const signatureHeader =
    request.headers.get("X-Webhook-Signature") ??
    request.headers.get("x-allo-signature");

  if (!verifyWebhookSignature(rawBody, signatureHeader, secret)) {
    log("withallo_webhook_signature_invalid", { hasSecret: !!secret });
    return NextResponse.json({ ok: true });
  }

  const payload = body as WithAlloWebhookPayload;

  after(async () => {
    try {
      const event = parseCallEvent(payload);
      if (!event) return;

      await processCallEvent(event);
    } catch (err) {
      log("withallo_webhook_error", {
        error: err instanceof Error ? err.message : String(err),
        externalCallId: (body as { call?: { id?: string }; data?: { id?: string } })?.call?.id ?? (body as { data?: { id?: string } })?.data?.id,
      });
    }
  });

  return NextResponse.json({ ok: true });
}
