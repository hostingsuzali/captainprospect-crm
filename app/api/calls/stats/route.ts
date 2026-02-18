import { NextRequest } from "next/server";
import { successResponse, requireAuth, withErrorHandler, errorResponse } from "@/lib/api-utils";
import { getCallStats } from "@/lib/calls/call-service";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);
  const userId = session.user.id as string;
  const role = session.user.role as string;
  const isManager = role === "MANAGER";

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId") || undefined;
  const fromDate = searchParams.get("fromDate") ? new Date(searchParams.get("fromDate")!) : undefined;
  const toDate = searchParams.get("toDate") ? new Date(searchParams.get("toDate")!) : undefined;

  if (targetUserId && !isManager) {
    return errorResponse("Only managers can view another user's stats", 403);
  }

  const stats = await getCallStats({
    userId,
    isManager,
    targetUserId,
    fromDate,
    toDate,
  });

  return successResponse(stats);
});
