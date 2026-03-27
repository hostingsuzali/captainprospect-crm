// ============================================
// POST /api/webhooks/withallo
// WithAllo webhook: verify signature, publish to QStash, return 200 immediately.
// QStash calls /api/voip/process for async processing.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/webhooks/withallo/signature";
import { scheduleVoipEvent } from "@/lib/voip/queue";

function log(event: string, data: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ event, ...data, timestamp: new Date().toISOString() }),
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

  const secret = (process.env.WITHALLO_WEBHOOK_SECRET ?? "").trim();
  const signatureHeader =
    request.headers.get("X-Webhook-Signature") ??
    request.headers.get("x-allo-signature");

  if (!verifyWebhookSignature(rawBody, signatureHeader, secret)) {
    log("withallo_webhook_signature_invalid", { hasSecret: !!secret });
    return NextResponse.json({ ok: true });
  }

  log("withallo_webhook_received", {
    topic: (body as Record<string, unknown>)?.topic,
    event: (body as Record<string, unknown>)?.event,
  });

  try {
    await scheduleVoipEvent({
      provider: "allo",
      rawPayload: body,
      receivedAt: new Date().toISOString(),
    });
    log("withallo_webhook_queued", {});
  } catch (err) {
    log("withallo_webhook_queue_error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({ ok: true });
}
