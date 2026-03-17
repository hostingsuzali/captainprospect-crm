import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
  validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

// ============================================
// GET /api/clients/[id]/sessions
// Returns all sessions for a client, newest first.
// ============================================

export const GET = withErrorHandler(
  async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], _request);

    const { id: clientId } = await context.params;

    const sessions = await prisma.clientSession.findMany({
      where: { clientId },
      include: { tasks: { orderBy: { createdAt: 'asc' } } },
      orderBy: { date: 'desc' },
    });

    const formatted = sessions.map((s) => ({
      id: s.id,
      type: s.type,
      date: s.date.toISOString(),
      leexiId: s.leexiId,
      recordingUrl: s.recordingUrl,
      crMarkdown: s.crMarkdown,
      summaryEmail: s.summaryEmail,
      emailSentAt: s.emailSentAt?.toISOString() ?? null,
      tasks: s.tasks.map((t) => ({
        id: t.id,
        label: t.label,
        assignee: t.assignee,
        assigneeRole: t.assigneeRole,
        priority: t.priority,
        doneAt: t.doneAt?.toISOString() ?? null,
      })),
      createdAt: s.createdAt.toISOString(),
    }));

    return successResponse(formatted);
  },
);

// ============================================
// POST /api/clients/[id]/sessions
// Creates a new session (CR) for a client.
// If notifyByEmail is true, sends summary email via SMTP.
// ============================================

const createSessionSchema = z.object({
  type: z.string().min(1),
  date: z.string().optional(),
  leexiId: z.string().optional(),
  recordingUrl: z.string().optional(),
  crMarkdown: z.string().optional(),
  summaryEmail: z.string().optional(),
  notifyByEmail: z.boolean().optional().default(false),
  tasks: z
    .array(
      z.object({
        label: z.string().min(1),
        assignee: z.string().optional(),
        assigneeRole: z.enum(['SDR', 'MANAGER', 'DEV', 'ALWAYS']).optional().default('ALWAYS'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
      }),
    )
    .optional()
    .default([]),
});

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);

    const { id: clientId } = await context.params;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, email: true },
    });
    if (!client) return errorResponse('Client introuvable', 404);

    const body = await validateRequest(request, createSessionSchema);

    const session = await prisma.clientSession.create({
      data: {
        clientId,
        type: body.type,
        date: body.date ? new Date(body.date) : new Date(),
        leexiId: body.leexiId,
        recordingUrl: body.recordingUrl,
        crMarkdown: body.crMarkdown,
        summaryEmail: body.summaryEmail,
        tasks: {
          create: (body.tasks ?? []).map((t) => ({
            label: t.label,
            assignee: t.assignee,
            assigneeRole: t.assigneeRole || 'ALWAYS',
            priority: t.priority || 'MEDIUM',
          })),
        },
      },
      include: { tasks: true },
    });

    let emailSent = false;

    // Send summary email if requested and client has an email
    if (body.notifyByEmail && client.email && body.summaryEmail) {
      try {
        const nodemailer = (await import('nodemailer')).default;
        const transporter = nodemailer.createTransport({
          host: process.env.SYSTEM_SMTP_HOST,
          port: Number(process.env.SYSTEM_SMTP_PORT ?? 587),
          secure: false,
          auth: {
            user: process.env.SYSTEM_SMTP_USER,
            pass: process.env.SYSTEM_SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: process.env.SYSTEM_SMTP_FROM ?? process.env.SYSTEM_SMTP_USER,
          to: client.email,
          subject: `Synthèse de notre session ${body.type} — ${client.name}`,
          text: body.summaryEmail,
        });

        await prisma.clientSession.update({
          where: { id: session.id },
          data: { emailSentAt: new Date() },
        });

        emailSent = true;
      } catch (err) {
        console.error('Session email send failed:', err);
      }
    }

    const result = {
      id: session.id,
      type: session.type,
      date: session.date.toISOString(),
      leexiId: session.leexiId,
      recordingUrl: session.recordingUrl,
      crMarkdown: session.crMarkdown,
      summaryEmail: session.summaryEmail,
      tasks: session.tasks.map((t) => ({
        id: t.id,
        label: t.label,
        assignee: t.assignee,
        assigneeRole: t.assigneeRole,
        priority: t.priority,
        doneAt: t.doneAt?.toISOString() ?? null,
      })),
      createdAt: session.createdAt.toISOString(),
    };

    return NextResponse.json({ success: true, data: result, emailSent }, { status: 201 });
  },
);
