// ============================================
// GET /api/voip/config — Current user's VoIP config
// PATCH /api/voip/config — Upsert current user's VoIP config
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { requireRole, withErrorHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const VALID_PROVIDERS = ["allo", "aircall", "ringover"] as const;

const updateVoipConfigSchema = z.object({
  provider: z.enum(VALID_PROVIDERS),
  alloNumber: z.string().optional().nullable(),
  aircallUserId: z.number().optional().nullable(),
  aircallNumberId: z.number().optional().nullable(),
  ringoverUserId: z.string().optional().nullable(),
  ringoverNumber: z.string().optional().nullable(),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await requireRole(
    ["SDR", "BUSINESS_DEVELOPER", "MANAGER"],
    request
  );
  const config = await prisma.userVoipConfig.findUnique({
    where: { userId: session.user.id },
  });
  return successResponse(config ?? null);
});

export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const session = await requireRole(
    ["SDR", "BUSINESS_DEVELOPER", "MANAGER"],
    request
  );
  const body = await request.json();
  const data = updateVoipConfigSchema.parse(body);

  const config = await prisma.userVoipConfig.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      provider: data.provider,
      alloNumber: data.provider === "allo" ? data.alloNumber ?? null : null,
      aircallUserId: data.provider === "aircall" ? data.aircallUserId ?? null : null,
      aircallNumberId: data.provider === "aircall" ? data.aircallNumberId ?? null : null,
      ringoverUserId: data.provider === "ringover" ? data.ringoverUserId ?? null : null,
      ringoverNumber: data.provider === "ringover" ? data.ringoverNumber ?? null : null,
      active: true,
    },
    update: {
      provider: data.provider,
      alloNumber: data.provider === "allo" ? data.alloNumber ?? null : null,
      aircallUserId: data.provider === "aircall" ? data.aircallUserId ?? null : null,
      aircallNumberId: data.provider === "aircall" ? data.aircallNumberId ?? null : null,
      ringoverUserId: data.provider === "ringover" ? data.ringoverUserId ?? null : null,
      ringoverNumber: data.provider === "ringover" ? data.ringoverNumber ?? null : null,
      active: true,
    },
  });
  return successResponse(config);
});
