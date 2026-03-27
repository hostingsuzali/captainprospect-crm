import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    NotFoundError,
    ValidationError,
} from "@/lib/api-utils";
import { z } from "zod";

type ScriptCompanionRules = {
    scriptCompanion?: {
        drafts?: Record<string, { content: string; updatedAt: string }>;
        shared?: { content: string; updatedAt: string; updatedBy: string | null };
    };
};

const upsertDraftSchema = z.object({
    draft: z.string(),
});

const publishSchema = z.object({
    content: z.string().optional(),
});

function parseScriptContent(script: string | null): string {
    if (!script) return "";
    try {
        const parsed = JSON.parse(script) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return script;
        const ordered = ["intro", "discovery", "objection", "closing"]
            .map((key) => {
                const value = parsed[key];
                return typeof value === "string" ? value.trim() : "";
            })
            .filter(Boolean);
        return ordered.join("\n\n");
    } catch {
        return script;
    }
}

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(["SDR", "BOOKER", "MANAGER", "BUSINESS_DEVELOPER", "CLIENT"], request);
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
        where: { id },
        select: { id: true, name: true, script: true, rules: true },
    });

    if (!campaign) throw new NotFoundError("Campagne introuvable");

    const rules = (campaign.rules ?? {}) as ScriptCompanionRules;
    const draftEntry = rules.scriptCompanion?.drafts?.[session.user.id];
    const sharedEntry = rules.scriptCompanion?.shared;

    return successResponse({
        campaignId: campaign.id,
        campaignName: campaign.name,
        baseScript: parseScriptContent(campaign.script ?? null),
        additionalDraft: draftEntry?.content ?? "",
        additionalShared: sharedEntry?.content ?? "",
        sharedUpdatedAt: sharedEntry?.updatedAt ?? null,
        sharedUpdatedBy: sharedEntry?.updatedBy ?? null,
    });
});

export const PUT = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(["SDR", "BOOKER", "MANAGER", "BUSINESS_DEVELOPER"], request);
    const { id } = await params;
    const data = await validateRequest(request, upsertDraftSchema);

    const campaign = await prisma.campaign.findUnique({
        where: { id },
        select: { id: true, rules: true },
    });
    if (!campaign) throw new NotFoundError("Campagne introuvable");

    const now = new Date().toISOString();
    const rules = (campaign.rules ?? {}) as ScriptCompanionRules;
    const currentDrafts = rules.scriptCompanion?.drafts ?? {};

    const nextRules: ScriptCompanionRules = {
        ...rules,
        scriptCompanion: {
            drafts: {
                ...currentDrafts,
                [session.user.id]: {
                    content: data.draft,
                    updatedAt: now,
                },
            },
            shared: rules.scriptCompanion?.shared,
        },
    };

    await prisma.campaign.update({
        where: { id },
        data: { rules: nextRules as any },
    });

    return successResponse({ saved: true });
});

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole(["SDR", "BOOKER", "MANAGER", "BUSINESS_DEVELOPER"], request);
    const { id } = await params;
    const data = await validateRequest(request, publishSchema);

    const campaign = await prisma.campaign.findUnique({
        where: { id },
        select: { id: true, rules: true },
    });
    if (!campaign) throw new NotFoundError("Campagne introuvable");

    const rules = (campaign.rules ?? {}) as ScriptCompanionRules;
    const draftEntry = rules.scriptCompanion?.drafts?.[session.user.id];
    const sharedContent = (data.content ?? draftEntry?.content ?? "").trim();

    if (!sharedContent) {
        throw new ValidationError("Aucun contenu à partager");
    }

    const now = new Date().toISOString();
    const nextRules: ScriptCompanionRules = {
        ...rules,
        scriptCompanion: {
            drafts: {
                ...(rules.scriptCompanion?.drafts ?? {}),
                [session.user.id]: { content: sharedContent, updatedAt: now },
            },
            shared: {
                content: sharedContent,
                updatedAt: now,
                updatedBy: session.user.name ?? null,
            },
        },
    };

    await prisma.campaign.update({
        where: { id },
        data: { rules: nextRules as any },
    });

    return successResponse({ shared: true });
});
