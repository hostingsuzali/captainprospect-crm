// ============================================
// API: /api/comms/events
// REPLACED: SSE long-polling → standard REST polling
// Reason: SSE is incompatible with Vercel serverless (300s hard timeout)
// Now returns VoIP events (call-completed, enrichment-ready) via polling
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const sinceParam = searchParams.get("since");
        const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 30_000);

        // Fetch recent VoIP-enriched actions for this SDR
        const recentActions = await prisma.action.findMany({
            where: {
                sdrId: session.user.id,
                voipEnrichedAt: { gt: since },
            },
            select: {
                id: true,
                voipProvider: true,
                duration: true,
                voipSummary: true,
                voipTranscript: true,
                voipEnrichedAt: true,
                contact: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
                company: {
                    select: {
                        name: true,
                    },
                },
                voipRecordingUrl: true,
            },
            orderBy: { voipEnrichedAt: "asc" },
            take: 20,
        });

        const events = recentActions.map((action) => {
            const contactName =
                action.contact
                    ? `${action.contact.firstName ?? ""} ${action.contact.lastName ?? ""}`.trim()
                    : action.company?.name ?? "Contact inconnu";

            return {
                type: "voip:enrichment-ready" as const,
                actionId: action.id,
                provider: action.voipProvider ?? "unknown",
                duration: action.duration ?? 0,
                summary: action.voipSummary ?? undefined,
                hasTranscript: Boolean(action.voipTranscript),
                contactName,
                enrichmentPending: false,
                recordingUrl: action.voipRecordingUrl ?? undefined,
                autoValidated: false,
                createdAt: action.voipEnrichedAt?.toISOString(),
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                events,
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Error fetching VoIP events:", error);
        return NextResponse.json(
            { error: "Failed to fetch events" },
            { status: 500 }
        );
    }
}
