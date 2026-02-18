import { NextRequest } from "next/server";
import { successResponse, requireAuth, withErrorHandler, errorResponse } from "@/lib/api-utils";
import { getCallHistory } from "@/lib/calls/call-service";
import type { CallStatus } from "@/lib/calls/call-service";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);
  const userId = session.user.id as string;
  const role = session.user.role as string;
  const isManager = role === "MANAGER";

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId") || undefined;
  const fromDate = searchParams.get("fromDate") ? new Date(searchParams.get("fromDate")!) : undefined;
  const toDate = searchParams.get("toDate") ? new Date(searchParams.get("toDate")!) : undefined;
  const status = searchParams.get("status") as CallStatus | undefined;
  const campaignId = searchParams.get("campaignId") || undefined;
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
  const sortBy = (searchParams.get("sortBy") || "startTime") as "startTime";
  const order = (searchParams.get("order") || "desc") as "asc" | "desc";

  if (targetUserId && !isManager) {
    return errorResponse("Only managers can filter by another user", 403);
  }

  const { calls, total } = await getCallHistory(
    {
      userId,
      isManager,
      targetUserId,
      fromDate,
      toDate,
      status,
      campaignId,
    },
    { limit, offset, sortBy, order }
  );

  return successResponse({ calls, total });
});
