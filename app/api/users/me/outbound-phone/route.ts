import { NextRequest } from "next/server";
import { successResponse, requireRole, withErrorHandler, errorResponse } from "@/lib/api-utils";
import { getUserOutboundNumber, setUserOutboundNumber } from "@/lib/calls/call-service";
import { z } from "zod";

export const GET = withErrorHandler(async () => {
  const session = await requireRole(["SDR", "BUSINESS_DEVELOPER", "MANAGER"], request);
  const number = await getUserOutboundNumber(session.user.id as string);
  return successResponse({ outboundPhoneNumber: number });
});

const bodySchema = z.object({
  outboundPhoneNumber: z.string().min(1, "Number required"),
});

export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const session = await requireRole(["SDR", "BUSINESS_DEVELOPER", "MANAGER"], request);
  const body = bodySchema.safeParse(await request.json());
  if (!body.success) {
    return errorResponse(body.error.issues.map((i) => i.message).join(", "), 400);
  }

  const result = await setUserOutboundNumber(session.user.id as string, body.data.outboundPhoneNumber);
  if (!result.ok) return errorResponse(result.error, 400);
  return successResponse({ outboundPhoneNumber: body.data.outboundPhoneNumber });
});
