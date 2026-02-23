// ============================================
// POST /api/integrations/voip/webhook/[provider]
// Single webhook endpoint per provider (allo | aircall | ringover)
// Respond quickly (<5s); enrichment runs async.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getVoipAdapter } from "@/lib/voip/factory";
import { processNormalizedCall, matchContactByPhone } from "@/lib/voip/processor";
import { prisma } from "@/lib/prisma";
import type { VoipProvider } from "@/lib/voip/types";

const VALID_PROVIDERS: VoipProvider[] = ["allo", "aircall", "ringover"];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await context.params;
  const provider = rawProvider as VoipProvider;

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const adapter = getVoipAdapter(provider);
  const normalizedCall = adapter.parseWebhook(body);
  if (!normalizedCall) return NextResponse.json({ ok: true });

  if (normalizedCall.direction === "inbound") return NextResponse.json({ ok: true });

  const [sdrId, { contact, company }] = await Promise.all([
    adapter.matchSdr(normalizedCall),
    matchContactByPhone(normalizedCall.toNumber),
  ]);

  let existing = await prisma.action.findFirst({
    where: {
      voipProvider: provider,
      voipCallId: normalizedCall.providerCallId,
    },
  });

  // Allo: initiate creates action with voipCallId "pending:uuid"; webhook has real id. Link by SDR + contact.
  if (!existing && provider === "allo" && normalizedCall.providerCallId && sdrId && (contact?.id || company?.id)) {
    existing = await prisma.action.findFirst({
      where: {
        voipProvider: "allo",
        sdrId,
        actionStatus: "IN_PROGRESS",
        OR: [
          { voipCallId: "" },
          { voipCallId: null },
          { voipCallId: { startsWith: "pending:" } },
        ],
        ...(contact?.id ? { contactId: contact.id } : { companyId: company!.id }),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  await processNormalizedCall({
    normalizedCall,
    existing,
    sdrId,
    contact,
    company,
    adapter,
  });

  return NextResponse.json({ ok: true });
}
