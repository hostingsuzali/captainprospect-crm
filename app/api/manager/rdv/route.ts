import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  requireRole,
  withErrorHandler,
  getPaginationParams,
} from "@/lib/api-utils";
import { Prisma } from "@prisma/client";

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(["MANAGER"], request);
  const sp = new URL(request.url).searchParams;

  const search = sp.get("search")?.trim() ?? "";
  const clientIds = sp.getAll("clientIds[]");
  const missionIds = sp.getAll("missionIds[]");
  const sdrIds = sp.getAll("sdrIds[]");
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const statuses = sp.getAll("status[]");
  const meetingTypes = sp.getAll("meetingType[]");
  const meetingCategories = sp.getAll("meetingCategory[]");
  const outcomes = sp.getAll("outcome[]");

  const { page, limit, skip } = getPaginationParams(sp);

  const now = new Date();

  const where: Prisma.ActionWhereInput = {
    result: { in: ["MEETING_BOOKED", "MEETING_CANCELLED"] },
  };

  const andClauses: Prisma.ActionWhereInput[] = [];

  if (search) {
    andClauses.push({
      OR: [
        { contact: { firstName: { contains: search, mode: "insensitive" } } },
        { contact: { lastName: { contains: search, mode: "insensitive" } } },
        { contact: { email: { contains: search, mode: "insensitive" } } },
        { contact: { company: { name: { contains: search, mode: "insensitive" } } } },
        { campaign: { mission: { client: { name: { contains: search, mode: "insensitive" } } } } },
        { campaign: { mission: { name: { contains: search, mode: "insensitive" } } } },
        { campaign: { name: { contains: search, mode: "insensitive" } } },
        { sdr: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  if (clientIds.length > 0) {
    andClauses.push({ campaign: { mission: { clientId: { in: clientIds } } } });
  }
  if (missionIds.length > 0) {
    andClauses.push({ campaign: { missionId: { in: missionIds } } });
  }
  if (sdrIds.length > 0) {
    andClauses.push({ sdrId: { in: sdrIds } });
  }
  if (dateFrom) {
    andClauses.push({ callbackDate: { gte: new Date(dateFrom) } });
  }
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    andClauses.push({ callbackDate: { lte: end } });
  }

  if (statuses.length > 0) {
    const statusOr: Prisma.ActionWhereInput[] = [];
    for (const s of statuses) {
      if (s === "upcoming") statusOr.push({ result: "MEETING_BOOKED", callbackDate: { gte: now } });
      if (s === "past") statusOr.push({ result: "MEETING_BOOKED", callbackDate: { lt: now } });
      if (s === "cancelled") statusOr.push({ result: "MEETING_CANCELLED" });
    }
    if (statusOr.length > 0) andClauses.push({ OR: statusOr });
  }

  if (meetingTypes.length > 0) {
    andClauses.push({ meetingType: { in: meetingTypes } });
  }

  if (meetingCategories.length > 0) {
    andClauses.push({ meetingCategory: { in: meetingCategories } });
  }

  if (outcomes.length > 0) {
    andClauses.push({ meetingFeedback: { outcome: { in: outcomes as any[] } } });
  }

  if (andClauses.length > 0) where.AND = andClauses;

  const include = {
    contact: {
      include: {
        company: {
          include: { list: { include: { mission: true } } },
        },
      },
    },
    sdr: { select: { id: true, name: true, email: true } },
    campaign: {
      include: {
        mission: {
          include: { client: { select: { id: true, name: true, industry: true } } },
        },
      },
    },
    meetingFeedback: true,
  } satisfies Prisma.ActionInclude;

  const [meetings, totalCount] = await Promise.all([
    prisma.action.findMany({
      where,
      include,
      orderBy: { callbackDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.action.count({ where }),
  ]);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const baseWhere: Prisma.ActionWhereInput = {
    result: { in: ["MEETING_BOOKED", "MEETING_CANCELLED"] },
  };
  if (clientIds.length > 0) baseWhere.campaign = { mission: { clientId: { in: clientIds } } };

  const [upcomingCount, pastCount, cancelledCount, weekCount, monthCount, sdrCounts, feedbackCount] =
    await Promise.all([
      prisma.action.count({
        where: { ...baseWhere, result: "MEETING_BOOKED", callbackDate: { gte: now } },
      }),
      prisma.action.count({
        where: { ...baseWhere, result: "MEETING_BOOKED", callbackDate: { lt: now } },
      }),
      prisma.action.count({
        where: { ...baseWhere, result: "MEETING_CANCELLED" },
      }),
      prisma.action.count({
        where: { ...baseWhere, result: "MEETING_BOOKED", callbackDate: { gte: weekStart } },
      }),
      prisma.action.count({
        where: { ...baseWhere, result: "MEETING_BOOKED", callbackDate: { gte: monthStart } },
      }),
      prisma.action.groupBy({
        by: ["sdrId"],
        where: { ...baseWhere, result: "MEETING_BOOKED" },
        _count: true,
      }),
      prisma.meetingFeedback.count({
        where: {
          action: { ...baseWhere, result: "MEETING_BOOKED" },
        },
      }),
    ]);

  const totalBooked = upcomingCount + pastCount;
  const avgPerSdr = sdrCounts.length > 0 ? Math.round(totalBooked / sdrCounts.length) : 0;
  const conversionRate = totalBooked > 0 ? Math.round((feedbackCount / totalBooked) * 100) : 0;

  const data = meetings.map((m) => ({
    id: m.id,
    result: m.result,
    callbackDate: m.callbackDate,
    meetingType: m.meetingType,
    meetingCategory: m.meetingCategory,
    meetingAddress: m.meetingAddress,
    meetingJoinUrl: m.meetingJoinUrl,
    meetingPhone: m.meetingPhone,
    note: m.note,
    cancellationReason: m.cancellationReason,
    createdAt: m.createdAt,
    duration: m.duration,
    contact: m.contact
      ? {
          id: m.contact.id,
          firstName: m.contact.firstName,
          lastName: m.contact.lastName,
          title: m.contact.title,
          email: m.contact.email,
          phone: m.contact.phone,
          linkedin: m.contact.linkedin,
          customData: m.contact.customData,
        }
      : null,
    company: m.contact?.company
      ? {
          id: m.contact.company.id,
          name: m.contact.company.name,
          industry: m.contact.company.industry,
          country: m.contact.company.country,
          size: m.contact.company.size,
          website: m.contact.company.website,
        }
      : null,
    campaign: { id: m.campaign.id, name: m.campaign.name },
    mission: { id: m.campaign.mission.id, name: m.campaign.mission.name },
    client: m.campaign.mission.client,
    sdr: m.sdr,
    feedback: m.meetingFeedback
      ? {
          outcome: m.meetingFeedback.outcome,
          recontact: m.meetingFeedback.recontactRequested,
          note: m.meetingFeedback.clientNote,
        }
      : null,
  }));

  return successResponse({
    meetings: data,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: page * limit < totalCount,
    },
    aggregates: {
      totalCount: totalBooked + cancelledCount,
      upcomingCount,
      pastCount,
      cancelledCount,
      avgPerSdr,
      conversionRate,
      meetingsThisWeek: weekCount,
      meetingsThisMonth: monthCount,
    },
  });
});
