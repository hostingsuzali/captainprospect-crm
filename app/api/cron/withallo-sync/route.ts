import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseCallEvent,
  processCallEvent,
} from "@/lib/webhooks/withallo/processCallEvent";

function log(event: string, data: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ event, ...data, timestamp: new Date().toISOString() }),
  );
}

export async function GET(request: Request) {
  // Simple cron token verification
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    log("withallo_cron_unauthorized", {});
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const workspaceConfig = await prisma.voipWorkspaceConfig.findUnique({
    where: { provider: "allo" },
  });

  if (!workspaceConfig?.alloApiKey) {
    log("withallo_cron_missing_api_key", {});
    return NextResponse.json({ ok: false, message: "Missing Allo API Key" });
  }

  try {
    // 1. Fetch recent calls from Allo API.
    // Replace the URL with actual Allo API URL for fetching calls
    // Using a 1-day lookback for the sync
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Example fetch assuming standard Allo API structure
    const response = await fetch(
      `https://api.withallo.com/v1/calls?since=${yesterday.toISOString()}`,
      {
        headers: {
          Authorization: `Bearer ${workspaceConfig.alloApiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      log("withallo_cron_api_error", { status: response.status });
      return NextResponse.json({
        ok: false,
        message: `Allo API error: ${response.status}`,
      });
    }

    const data = await response.json();
    const calls = data.calls || [];
    let synced = 0;

    for (const call of calls) {
      // Structure payload as if it came from webhook
      const payload = {
        topic: "CALL_RECEIVED",
        call: call,
      };

      const event = parseCallEvent(payload);
      if (!event) continue;

      // Ensure idempotency isn't violated by wrapping in try/catch just in case processCallEvent throws
      try {
        await processCallEvent(event);
        synced++;
      } catch (err) {
        log("withallo_cron_processing_error", {
          error: err instanceof Error ? err.message : String(err),
          callId: call.id,
        });
      }
    }

    log("withallo_cron_success", { syncedCount: synced });
    return NextResponse.json({ ok: true, synced });
  } catch (err) {
    log("withallo_cron_fatal_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
