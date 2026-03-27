// ============================================
// POST /api/voip/initiate — Provider-agnostic click-to-call
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { requireRole, withErrorHandler, errorResponse } from "@/lib/api-utils";
import { getVoipAdapter } from "@/lib/voip/factory";
import { prisma } from "@/lib/prisma";
import type { VoipProvider } from "@/lib/voip/types";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await requireRole(
    ["SDR", "BUSINESS_DEVELOPER", "MANAGER"],
    request
  );
  const body = await request.json();
  const contactId = body.contactId as string | undefined;
  const companyId = body.companyId as string | undefined;
  const phone = body.phone as string | undefined;
  const missionId = body.missionId as string | undefined;
  const campaignId = body.campaignId as string | undefined;

  if (!phone?.trim()) {
    return errorResponse("Numéro de téléphone requis", 400);
  }
  if (!contactId && !companyId) {
    return errorResponse("contactId ou companyId requis", 400);
  }

  const config = await prisma.userVoipConfig.findUnique({
    where: { userId: session.user.id, active: true },
  });
  if (!config?.provider) {
    return NextResponse.json(
      { success: false, error: "Configurez votre provider VOIP dans les paramètres" },
      { status: 400 }
    );
  }

  const provider = config.provider as VoipProvider;
  if (!["allo", "aircall", "ringover"].includes(provider)) {
    return NextResponse.json(
      { success: false, error: "Provider VOIP invalide" },
      { status: 400 }
    );
  }

  const adapter = getVoipAdapter(provider);
  const effectiveCampaignId =
    campaignId ||
    (contactId
      ? await getDefaultCampaignForContact(contactId)
      : companyId
        ? await getDefaultCampaignForCompany(companyId)
        : null);

  if (!effectiveCampaignId) {
    return errorResponse("Impossible de déterminer la campagne (contact/société)", 400);
  }

  try {
    const result = await adapter.initiateCall({
      provider,
      userId: session.user.id,
      contactId,
      companyId,
      phone: phone.trim(),
      missionId,
      campaignId: effectiveCampaignId,
    });

    // Create CallSession so the webhook processor can link CallRecord to it
    let resolvedMissionId = missionId;
    if (!resolvedMissionId && contactId) {
      const c = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { company: { select: { list: { select: { missionId: true } } } } },
      });
      resolvedMissionId = c?.company?.list?.missionId ?? undefined;
    }
    if (!resolvedMissionId && companyId) {
      const co = await prisma.company.findUnique({
        where: { id: companyId },
        select: { list: { select: { missionId: true } } },
      });
      resolvedMissionId = co?.list?.missionId ?? undefined;
    }
    if (resolvedMissionId) {
      try {
        await prisma.callSession.create({
          data: {
            missionId: resolvedMissionId,
            contactId: contactId ?? undefined,
            companyId: companyId ?? undefined,
            sdrId: session.user.id,
            phoneNumber: phone.trim(),
            status: "pending",
          },
        });
      } catch {
        // Non-blocking: session creation failure shouldn't prevent the call
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...result, provider },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur initiate call";
    const is5xx =
      err instanceof Error &&
      "status" in err &&
      typeof (err as { status?: number }).status === "number" &&
      (err as { status: number }).status >= 500;
    if (is5xx) {
      return NextResponse.json({
        success: true,
        data: {
          actionId: "",
          providerCallId: "",
          callMethod: "tel_link",
          telLink: `tel:${phone.trim()}`,
          provider,
        },
      });
    }
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
});

async function getDefaultCampaignForContact(
  contactId: string
): Promise<string | null> {
  const c = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      company: {
        select: {
          list: {
            select: {
              mission: {
                select: {
                  campaigns: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  return c?.company?.list?.mission?.campaigns?.[0]?.id ?? null;
}

async function getDefaultCampaignForCompany(
  companyId: string
): Promise<string | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      list: {
        select: {
          mission: {
            select: {
              campaigns: {
                take: 1,
                orderBy: { createdAt: "desc" },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });
  return company?.list?.mission?.campaigns?.[0]?.id ?? null;
}
