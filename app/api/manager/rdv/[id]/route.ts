import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
  validateRequest,
  NotFoundError,
} from "@/lib/api-utils";
import { z } from "zod";

const updateSchema = z.object({
  note: z.string().optional(),
  managerNote: z.string().optional(),
  callbackDate: z.string().datetime().optional(),
  meetingType: z.enum(["VISIO", "PHYSIQUE", "TELEPHONIQUE"]).optional(),
  result: z.enum(["MEETING_BOOKED", "MEETING_CANCELLED"]).optional(),
  sdrId: z.string().cuid().optional(),
  meetingAddress: z.string().optional(),
  meetingJoinUrl: z.string().optional(),
  meetingPhone: z.string().optional(),
  cancellationReason: z.string().optional(),
  feedbackOutcome: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "NO_SHOW"]).optional(),
  feedbackRecontact: z.enum(["YES", "NO", "MAYBE"]).optional(),
  feedbackNote: z.string().optional(),
});

export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;
    const body = await validateRequest(request, updateSchema);

    const action = await prisma.action.findUnique({ where: { id } });
    if (!action) throw new NotFoundError("RDV introuvable");

    const actionUpdate: Record<string, unknown> = {};
    if (body.note !== undefined) actionUpdate.note = body.note;
    if (body.callbackDate !== undefined) actionUpdate.callbackDate = new Date(body.callbackDate);
    if (body.meetingType !== undefined) actionUpdate.meetingType = body.meetingType;
    if (body.result !== undefined) actionUpdate.result = body.result;
    if (body.sdrId !== undefined) actionUpdate.sdrId = body.sdrId;
    if (body.meetingAddress !== undefined) actionUpdate.meetingAddress = body.meetingAddress;
    if (body.meetingJoinUrl !== undefined) actionUpdate.meetingJoinUrl = body.meetingJoinUrl;
    if (body.meetingPhone !== undefined) actionUpdate.meetingPhone = body.meetingPhone;
    if (body.cancellationReason !== undefined) actionUpdate.cancellationReason = body.cancellationReason;

    const updated = await prisma.action.update({
      where: { id },
      data: actionUpdate,
      include: {
        contact: { include: { company: true } },
        sdr: { select: { id: true, name: true, email: true } },
        campaign: { include: { mission: { include: { client: true } } } },
        meetingFeedback: true,
      },
    });

    if (
      body.feedbackOutcome !== undefined ||
      body.feedbackRecontact !== undefined ||
      body.feedbackNote !== undefined
    ) {
      await prisma.meetingFeedback.upsert({
        where: { actionId: id },
        create: {
          actionId: id,
          outcome: (body.feedbackOutcome as any) ?? "NEUTRAL",
          recontactRequested: (body.feedbackRecontact as any) ?? "NO",
          clientNote: body.feedbackNote ?? null,
        },
        update: {
          ...(body.feedbackOutcome !== undefined && { outcome: body.feedbackOutcome as any }),
          ...(body.feedbackRecontact !== undefined && { recontactRequested: body.feedbackRecontact as any }),
          ...(body.feedbackNote !== undefined && { clientNote: body.feedbackNote }),
        },
      });
    }

    return successResponse(updated);
  }
);

export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;

    const action = await prisma.action.findUnique({ where: { id } });
    if (!action) throw new NotFoundError("RDV introuvable");

    await prisma.action.delete({ where: { id } });
    return successResponse({ deleted: true });
  }
);
