import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, requireAuth, withErrorHandler, errorResponse } from "@/lib/api-utils";
import { updateCallStatus } from "@/lib/calls/call-service";
import { z } from "zod";

export const GET = withErrorHandler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const session = await requireAuth(request);
  const { id } = await context.params;

  const call = await prisma.call.findFirst({
    where: { id, userId: session.user.id },
    include: { contact: true, company: true, campaign: true, action: true },
  });
  if (!call) return errorResponse("Call not found", 404);
  return successResponse(call);
});

const patchSchema = z.object({
  status: z.enum(["queued", "ringing", "in_progress", "completed", "failed"]).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  recordingUrl: z.string().url().optional(),
  externalCallId: z.string().optional(),
});

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const session = await requireAuth(request);
  const { id } = await context.params;

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  const updates: { status?: "queued" | "ringing" | "in_progress" | "completed" | "failed"; durationSeconds?: number; recordingUrl?: string; externalCallId?: string; endTime?: Date } = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.durationSeconds !== undefined) updates.durationSeconds = parsed.data.durationSeconds;
  if (parsed.data.recordingUrl !== undefined) updates.recordingUrl = parsed.data.recordingUrl;
  if (parsed.data.externalCallId !== undefined) updates.externalCallId = parsed.data.externalCallId;
  if (parsed.data.status === "completed" || parsed.data.status === "failed") {
    updates.endTime = new Date();
    if (parsed.data.durationSeconds !== undefined) updates.durationSeconds = parsed.data.durationSeconds;
  }

  const updated = await updateCallStatus(id, session.user.id as string, updates);
  if (!updated) return errorResponse("Call not found", 404);
  return successResponse(updated);
});
