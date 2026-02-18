import { NextRequest } from "next/server";
import { successResponse, requireRole, withErrorHandler, errorResponse } from "@/lib/api-utils";
import { initiateCall, getUserOutboundNumber } from "@/lib/calls/call-service";
import { z } from "zod";

const bodySchema = z.object({
  toNumber: z.string().min(1, "toNumber required"),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  campaignId: z.string().optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await requireRole(["SDR", "BUSINESS_DEVELOPER", "MANAGER"], request);
  const userId = session.user.id as string;

  const body = bodySchema.safeParse(await request.json());
  if (!body.success) {
    return errorResponse(body.error.issues.map((i) => i.message).join(", "), 400);
  }

  const { callId, fromNumber } = await initiateCall({
    userId,
    toNumber: body.data.toNumber,
    contactId: body.data.contactId,
    companyId: body.data.companyId,
    campaignId: body.data.campaignId,
  });

  return successResponse({ callId, fromNumber });
});
