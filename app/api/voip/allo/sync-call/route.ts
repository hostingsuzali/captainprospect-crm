// ============================================
// POST /api/voip/allo/sync-call — Fetch call from Allo API when webhook not yet received
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { requireRole, withErrorHandler, errorResponse } from "@/lib/api-utils";
import { syncAlloCallForAction } from "@/lib/voip/providers/allo/sync-call";
import { AlloApiError } from "@/lib/voip/providers/allo/api";

export const POST = withErrorHandler(async (request: NextRequest) => {
  await requireRole(
    ["SDR", "BUSINESS_DEVELOPER", "MANAGER"],
    request
  );
  const body = await request.json().catch(() => ({}));
  const actionId = body.actionId as string | undefined;
  if (!actionId?.trim()) {
    return errorResponse("actionId requis", 400);
  }

  try {
    const result = await syncAlloCallForAction(actionId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.error === "Action introuvable" ? 404 : 400 }
      );
    }
    return NextResponse.json({ ok: true, updated: result.updated ?? false });
  } catch (e) {
    if (e instanceof AlloApiError) {
      const status = e.status === 401 || e.status === 403 ? e.status : 502;
      return NextResponse.json(
        { ok: false, error: e.message },
        { status }
      );
    }
    throw e;
  }
});
