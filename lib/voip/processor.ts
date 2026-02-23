// ============================================
// VOIP PROCESSOR — Unified handling after webhook
// ============================================

import { prisma } from "@/lib/prisma";
import { publishToUser } from "@/lib/comms/events";
import type { VoipAdapter, NormalizedCall } from "./types";
import type { Action, Contact, Company } from "@prisma/client";

const VOIP_CHANNEL_PREFIX = "comms:user:";

/** Normalize phone for matching (strip spaces, keep digits and +) */
function normalizePhone(phone: string): string {
  return phone.replace(/\s/g, "").replace(/^00/, "+");
}

/** Resolve contact and company by called number (toNumber = prospect) */
export async function matchContactByPhone(
  toNumber: string
): Promise<{ contact: Contact | null; company: Company | null }> {
  const normalized = normalizePhone(toNumber);
  const last9 = normalized.slice(-9).replace(/\D/g, "");
  const contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { phone: { not: null }, phone: { contains: last9 } },
        { phone: normalized },
      ],
    },
    include: { company: true },
  });
  if (contact) return { contact, company: contact.company };
  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { phone: { not: null }, phone: { contains: last9 } },
        { phone: normalized },
      ],
    },
  });
  return { contact: null, company };
}

/** Get a default campaign for a contact (first campaign from contact's list mission) */
async function getDefaultCampaignForContact(
  contactId: string
): Promise<string | null> {
  const contact = await prisma.contact.findUnique({
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
  const campaignId =
    contact?.company?.list?.mission?.campaigns?.[0]?.id ?? null;
  return campaignId;
}

/** Get default campaign for company */
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

export interface ProcessNormalizedCallParams {
  normalizedCall: NormalizedCall;
  existing: Action | null;
  sdrId: string | null;
  contact: Contact | null;
  company: Company | null;
  adapter: VoipAdapter;
}

export async function processNormalizedCall({
  normalizedCall,
  existing,
  sdrId,
  contact,
  company,
  adapter,
}: ProcessNormalizedCallParams): Promise<void> {
  const {
    providerCallId,
    provider,
    durationSeconds,
    status,
    recordingUrl,
    aiSummary,
    aiTranscript,
    enrichmentPending,
  } = normalizedCall;

  let action: Action;

  if (existing) {
    action = await prisma.action.update({
      where: { id: existing.id },
      data: {
        voipCallId: providerCallId || existing.voipCallId,
        duration: durationSeconds,
        voipRecordingUrl: recordingUrl ?? undefined,
        voipSummary: aiSummary ?? undefined,
        voipTranscript: (aiTranscript ?? undefined) as object | undefined,
        note: aiSummary ?? existing.note,
        actionStatus: "PENDING_VALIDATION",
      },
    });
  } else {
    if (!sdrId) return;
    let campaignId: string | null = null;
    if (contact?.id) campaignId = await getDefaultCampaignForContact(contact.id);
    if (!campaignId && company?.id)
      campaignId = await getDefaultCampaignForCompany(company.id);
    if (!campaignId) return;

    action = await prisma.action.create({
      data: {
        sdrId,
        contactId: contact?.id ?? null,
        companyId: company?.id ?? null,
        campaignId,
        channel: "CALL",
        result: "NO_RESPONSE",
        actionStatus: "PENDING_VALIDATION",
        voipProvider: provider,
        voipCallId: providerCallId,
        duration: durationSeconds,
        voipRecordingUrl: recordingUrl ?? undefined,
        voipSummary: aiSummary ?? undefined,
        voipTranscript: (aiTranscript ?? undefined) as object | undefined,
        note: aiSummary ?? undefined,
      },
    });
  }

  if (sdrId) {
    publishToUser(sdrId, {
      type: "voip:call-completed",
      threadId: "",
      actionId: action.id,
      provider,
      duration: durationSeconds,
      summary: aiSummary,
      hasTranscript: !!(aiTranscript?.length),
      contactName: contact
        ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
          normalizedCall.toNumber
        : normalizedCall.toNumber,
      enrichmentPending,
      recordingUrl: recordingUrl ?? undefined,
    } as Parameters<typeof publishToUser>[1]);
  }

  if (enrichmentPending && adapter.fetchEnrichment) {
    scheduleEnrichment(action.id, providerCallId, adapter, sdrId);
  }
}

function scheduleEnrichment(
  actionId: string,
  callId: string,
  adapter: VoipAdapter,
  sdrId: string | null,
  attempt = 1
): void {
  const delay = attempt === 1 ? 35_000 : attempt * 20_000;
  setTimeout(async () => {
    try {
      const enriched = await adapter.fetchEnrichment!(callId);
      await prisma.action.update({
        where: { id: actionId },
        data: {
          voipSummary: enriched.aiSummary,
          voipTranscript: (enriched.aiTranscript ?? undefined) as
            | object
            | undefined,
          voipSentiment: enriched.aiSentiment ?? undefined,
          voipTopics: (enriched.aiTopics ?? undefined) as object | undefined,
          voipActionItems: (enriched.aiActionItems ?? undefined) as
            | object
            | undefined,
          voipEnrichedAt: new Date(),
          note: enriched.aiSummary,
        },
      });
      if (sdrId) {
        publishToUser(sdrId, {
          type: "voip:enrichment-ready",
          threadId: "",
          actionId,
          summary: enriched.aiSummary,
        } as Parameters<typeof publishToUser>[1]);
      }
    } catch {
      if (attempt < 3)
        scheduleEnrichment(actionId, callId, adapter, sdrId, attempt + 1);
    }
  }, delay);
}
