import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
  validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

const updateSessionSchema = z.object({
  type: z.string().min(1).optional(),
  date: z.string().optional(),
  crMarkdown: z.string().optional(),
  summaryEmail: z.string().optional(),
});

export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string; sessionId: string }> },
  ) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);

    const { id: clientId, sessionId } = await context.params;
    const body = await validateRequest(request, updateSessionSchema);

    const session = await prisma.clientSession.findFirst({
      where: { id: sessionId, clientId },
    });
    if (!session) return errorResponse('Session introuvable', 404);

    const updated = await prisma.clientSession.update({
      where: { id: sessionId },
      data: {
        type: body.type ?? session.type,
        date: body.date ? new Date(body.date) : session.date,
        crMarkdown: body.crMarkdown ?? session.crMarkdown,
        summaryEmail: body.summaryEmail ?? session.summaryEmail,
      },
    });

    return successResponse({
      id: updated.id,
      type: updated.type,
      date: updated.date.toISOString(),
      crMarkdown: updated.crMarkdown,
      summaryEmail: updated.summaryEmail,
    });
  },
);

export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string; sessionId: string }> },
  ) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);

    const { id: clientId, sessionId } = await context.params;

    const session = await prisma.clientSession.findFirst({
      where: { id: sessionId, clientId },
    });
    if (!session) return errorResponse('Session introuvable', 404);

    await prisma.clientSession.delete({
      where: { id: sessionId },
    });

    return successResponse({ deleted: true });
  },
);

