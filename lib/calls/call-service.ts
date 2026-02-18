/**
 * Call service: initiate, lifecycle, complete with outcome, history, stats.
 * Enforces per-user unique outbound number and SDR-only visibility (manager can see all).
 * Structured for optional telephony provider integration later.
 */

import { prisma } from "@/lib/prisma";
import { ActionService } from "@/lib/services/ActionService";
import type { CallStatus as PrismaCallStatus, CallDirection } from "@prisma/client";
import type { ActionResult } from "@prisma/client";

const actionService = new ActionService();

// Re-export for API use
export type CallStatus = PrismaCallStatus;

export interface InitiateCallInput {
  userId: string;
  toNumber: string;
  contactId?: string;
  companyId?: string;
  campaignId?: string;
}

export interface CallRecord {
  id: string;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  userId: string;
  contactId: string | null;
  companyId: string | null;
  campaignId: string | null;
  startTime: Date;
  endTime: Date | null;
  status: PrismaCallStatus;
  durationSeconds: number | null;
  recordingUrl: string | null;
  externalCallId: string | null;
  actionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompleteCallInput {
  callId: string;
  userId: string;
  result: ActionResult;
  note?: string;
  callbackDate?: Date;
  durationSeconds: number;
}

export interface CallHistoryFilters {
  userId: string;
  isManager?: boolean;
  targetUserId?: string;
  fromDate?: Date;
  toDate?: Date;
  status?: PrismaCallStatus;
  campaignId?: string;
}

export interface CallStatsFilters {
  userId: string;
  isManager?: boolean;
  targetUserId?: string;
  fromDate?: Date;
  toDate?: Date;
}

/** Ensure no two users share the same outbound number. Returns true if number is available for this user (or already assigned to them). */
export async function ensureUserOutboundNumberUnique(
  userId: string,
  phoneNumber: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = phoneNumber.trim();
  if (!normalized) return { ok: false, error: "Number is required" };

  const existing = await prisma.user.findFirst({
    where: { outboundPhoneNumber: normalized },
    select: { id: true },
  });
  if (existing && existing.id !== userId) {
    return { ok: false, error: "This number is already assigned to another user" };
  }
  return { ok: true };
}

/** Get outbound number for user (must be set for outbound calls). */
export async function getUserOutboundNumber(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { outboundPhoneNumber: true },
  });
  return user?.outboundPhoneNumber ?? null;
}

/** Set outbound number for user; enforces uniqueness. */
export async function setUserOutboundNumber(
  userId: string,
  phoneNumber: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const check = await ensureUserOutboundNumberUnique(userId, phoneNumber);
  if (!check.ok) return check;

  await prisma.user.update({
    where: { id: userId },
    data: { outboundPhoneNumber: phoneNumber.trim() },
  });
  return { ok: true };
}

/** Create a Call record and return callId. Outbound calls use the user's unique outbound number. */
export async function initiateCall(input: InitiateCallInput): Promise<{ callId: string; fromNumber: string }> {
  const fromNumber = await getUserOutboundNumber(input.userId);
  const effectiveFrom = fromNumber ?? `mock-${input.userId.slice(0, 8)}`; // mock number if not set

  const call = await prisma.call.create({
    data: {
      direction: "OUTBOUND",
      fromNumber: effectiveFrom,
      toNumber: input.toNumber.trim(),
      userId: input.userId,
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      campaignId: input.campaignId ?? null,
      status: "ringing",
    },
  });

  return { callId: call.id, fromNumber: call.fromNumber };
}

/** Update call status (and optionally endTime, durationSeconds, recordingUrl). */
export async function updateCallStatus(
  callId: string,
  userId: string,
  updates: {
    status?: PrismaCallStatus;
    endTime?: Date;
    durationSeconds?: number;
    recordingUrl?: string;
    externalCallId?: string;
  }
): Promise<CallRecord | null> {
  const call = await prisma.call.findFirst({
    where: { id: callId, userId },
  });
  if (!call) return null;

  const updated = await prisma.call.update({
    where: { id: callId },
    data: {
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.endTime !== undefined && { endTime: updates.endTime }),
      ...(updates.durationSeconds !== undefined && { durationSeconds: updates.durationSeconds }),
      ...(updates.recordingUrl !== undefined && { recordingUrl: updates.recordingUrl }),
      ...(updates.externalCallId !== undefined && { externalCallId: updates.externalCallId }),
    },
  });
  return updated;
}

/** End call and optionally log outcome: create Action when campaign exists, else just finalize Call. */
export async function completeCallWithOutcome(input: CompleteCallInput): Promise<{ actionId?: string } | { error: string }> {
  const call = await prisma.call.findFirst({
    where: { id: input.callId, userId: input.userId },
    include: { campaign: true },
  });
  if (!call) return { error: "Call not found" };
  if (call.actionId) return { error: "Call already has a logged outcome" };

  const campaignId = call.campaignId ?? call.campaign?.id;
  let actionId: string | undefined;

  if (campaignId) {
    const action = await actionService.createAction({
      contactId: call.contactId ?? undefined,
      companyId: call.companyId ?? undefined,
      sdrId: input.userId,
      campaignId,
      channel: "CALL",
      result: input.result,
      note: input.note,
      callbackDate: input.callbackDate,
      duration: input.durationSeconds,
    });
    actionId = action.id;
  }

  await prisma.call.update({
    where: { id: input.callId },
    data: {
      status: "completed",
      endTime: call.endTime ?? new Date(),
      durationSeconds: input.durationSeconds,
      ...(actionId && { actionId }),
    },
  });

  return { actionId };
}

/** List calls with filters. SDR sees only own calls unless isManager and targetUserId set. */
export async function getCallHistory(
  filters: CallHistoryFilters,
  options: { limit?: number; offset?: number; sortBy?: "startTime"; order?: "asc" | "desc" }
): Promise<{ calls: CallRecord[]; total: number }> {
  const { limit = 50, offset = 0, sortBy = "startTime", order = "desc" } = options;

  const userIdFilter =
    filters.isManager && filters.targetUserId ? filters.targetUserId : filters.userId;

  const where: Parameters<typeof prisma.call.findMany>[0]["where"] = {
    userId: userIdFilter,
  };
  if (filters.status) where.status = filters.status;
  if (filters.campaignId) where.campaignId = filters.campaignId;
  if (filters.fromDate ?? filters.toDate) {
    const to = filters.toDate ? (() => { const d = new Date(filters.toDate); d.setHours(23, 59, 59, 999); return d; })() : undefined;
    where.startTime = { ...(filters.fromDate && { gte: filters.fromDate }), ...(to && { lte: to }) };
  }

  const [calls, total] = await Promise.all([
    prisma.call.findMany({
      where,
      orderBy: { [sortBy]: order },
      take: limit,
      skip: offset,
      include: {
        contact: true,
        company: true,
        campaign: true,
        user: { select: { id: true, name: true, email: true } },
        action: true,
      },
    }),
    prisma.call.count({ where }),
  ]);

  return { calls: calls as unknown as CallRecord[], total };
}

/** Aggregate stats for dashboard. */
export async function getCallStats(
  filters: CallStatsFilters
): Promise<{
  totalCalls: number;
  totalDurationSeconds: number;
  byStatus: Record<PrismaCallStatus, number>;
  byUser: Array<{ userId: string; userName: string; calls: number; durationSeconds: number }>;
}> {
  const userIdFilter =
    filters.isManager && filters.targetUserId ? filters.targetUserId : filters.userId;

  const where: Parameters<typeof prisma.call.findMany>[0]["where"] = {};
  if (!filters.isManager || filters.targetUserId) {
    where.userId = userIdFilter;
  } else {
    where.user = { role: { in: ["SDR", "BUSINESS_DEVELOPER"] } };
  }
  if (filters.fromDate ?? filters.toDate) {
    const to = filters.toDate ? (() => { const d = new Date(filters.toDate); d.setHours(23, 59, 59, 999); return d; })() : undefined;
    where.startTime = { ...(filters.fromDate && { gte: filters.fromDate }), ...(to && { lte: to }) };
  }

  const calls = await prisma.call.findMany({
    where,
    select: {
      status: true,
      durationSeconds: true,
      userId: true,
      user: { select: { name: true } },
    },
  });

  const totalCalls = calls.length;
  const totalDurationSeconds = calls.reduce((s, c) => s + (c.durationSeconds ?? 0), 0);
  const byStatus = {
    queued: 0,
    ringing: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
  } as Record<PrismaCallStatus, number>;
  calls.forEach((c) => {
    byStatus[c.status]++;
  });

  const userMap = new Map<string, { userName: string; calls: number; durationSeconds: number }>();
  calls.forEach((c) => {
    const cur = userMap.get(c.userId) ?? { userName: c.user?.name ?? "?", calls: 0, durationSeconds: 0 };
    cur.calls++;
    cur.durationSeconds += c.durationSeconds ?? 0;
    userMap.set(c.userId, cur);
  });
  const byUser = Array.from(userMap.entries()).map(([userId, v]) => ({
    userId,
    userName: v.userName,
    calls: v.calls,
    durationSeconds: v.durationSeconds,
  }));

  return { totalCalls, totalDurationSeconds, byStatus, byUser };
}
