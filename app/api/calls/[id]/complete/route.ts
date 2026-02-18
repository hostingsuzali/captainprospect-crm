import { NextRequest } from "next/server";
import { successResponse, requireRole, withErrorHandler, errorResponse } from "@/lib/api-utils";
import { completeCallWithOutcome } from "@/lib/calls/call-service";
import { z } from "zod";

const bodySchema = z.object({
  result: z.enum([
    "NO_RESPONSE",
    "BAD_CONTACT",
    "INTERESTED",
    "CALLBACK_REQUESTED",
    "MEETING_BOOKED",
    "MEETING_CANCELLED",
    "DISQUALIFIED",
    "ENVOIE_MAIL",
  ]),
  note: z.string().optional(),
  callbackDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  durationSeconds: z.number().int().min(0),
});

export const POST = withErrorHandler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const session = await requireRole(["SDR", "BUSINESS_DEVELOPER", "MANAGER"], request);
  const { id: callId } = await context.params;

  const body = bodySchema.safeParse(await request.json());
  if (!body.success) {
    return errorResponse(body.error.issues.map((i) => i.message).join(", "), 400);
  }

  const callbackDate = body.data.callbackDate
    ? new Date(body.data.callbackDate)
    : undefined;

  const result = await completeCallWithOutcome({
    callId,
    userId: session.user.id as string,
    result: body.data.result as Parameters<typeof completeCallWithOutcome>[0]["result"],
    note: body.data.note,
    callbackDate,
    durationSeconds: body.data.durationSeconds,
  });

  if ("error" in result) return errorResponse(result.error, 400);
  return successResponse({ actionId: result.actionId });
});
