/**
 * POST /api/voip/test-qstash
 * Pushes a no-op job to QStash → QStash calls POST /api/voip/process.
 * Payload is chosen so the processor exits early (no CallRecord created).
 *
 * Requirements for a real round-trip:
 * - QSTASH_TOKEN, NEXT_PUBLIC_APP_URL (public HTTPS URL, not localhost)
 * - Production: QSTASH_* signing keys on the server that receives the callback
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
import { NextRequest, NextResponse } from "next/server";
import { scheduleVoipEvent } from "@/lib/voip/queue";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (!appUrl) {
    return NextResponse.json(
      {
        error:
          "Set NEXT_PUBLIC_APP_URL to your public HTTPS base (e.g. https://your-app.vercel.app). QStash cannot reach localhost.",
      },
      { status: 400 },
    );
  }

  if (!process.env.QSTASH_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "QSTASH_TOKEN is not set" },
      { status: 400 },
    );
  }

  try {
    const { messageId } = await scheduleVoipEvent({
      provider: "allo",
      rawPayload: { topic: "QSTASH_PING", _test: true },
      receivedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      messageId,
      note:
        "QStash will POST to /api/voip/process. Payload is ignored by the adapter (no DB writes). In production, QSTASH_CURRENT_SIGNING_KEY must match or delivery returns 401. Check Upstash → QStash → Logs.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
