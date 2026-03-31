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
        aiDrafts?: Record<string, { content: string; updatedAt: string }>;
        aiShared?: { content: string; updatedAt: string; updatedBy: string | null };
        defaultTab?: "base" | "additional" | "ai";
    };
};

const upsertDraftSchema = z.object({
    draft: z.string().optional(),
    kind: z.enum(["additional", "ai"]).optional().default("additional"),
    defaultTab: z.enum(["base", "additional", "ai"]).optional(),
});

const publishSchema = z.object({
    content: z.string().optional(),
    kind: z.enum(["additional", "ai"]).optional().default("additional"),
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
        aiDraft: rules.scriptCompanion?.aiDrafts?.[session.user.id]?.content ?? "",
        aiShared: rules.scriptCompanion?.aiShared?.content ?? "",
        defaultTab: rules.scriptCompanion?.defaultTab ?? "base",
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
    const currentAiDrafts = rules.scriptCompanion?.aiDrafts ?? {};

    if (data.draft === undefined && data.defaultTab === undefined) {
        throw new ValidationError("Aucune modification fournie");
    }

    const nextRules: ScriptCompanionRules = {
        ...rules,
        scriptCompanion: {
            drafts:
                data.kind === "additional" && data.draft !== undefined
                    ? {
                        ...currentDrafts,
                        [session.user.id]: {
                            content: data.draft,
                            updatedAt: now,
                        },
                    }
                    : currentDrafts,
            aiDrafts:
                data.kind === "ai" && data.draft !== undefined
                    ? {
                        ...currentAiDrafts,
                        [session.user.id]: {
                            content: data.draft,
                            updatedAt: now,
                        },
                    }
                    : currentAiDrafts,
            shared: rules.scriptCompanion?.shared,
            aiShared: rules.scriptCompanion?.aiShared,
            defaultTab: data.defaultTab ?? rules.scriptCompanion?.defaultTab ?? "base",
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
    const kind = data.kind ?? "additional";
    const draftEntry =
        kind === "ai"
            ? rules.scriptCompanion?.aiDrafts?.[session.user.id]
            : rules.scriptCompanion?.drafts?.[session.user.id];
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
                ...(kind === "additional" ? { [session.user.id]: { content: sharedContent, updatedAt: now } } : {}),
            },
            aiDrafts: {
                ...(rules.scriptCompanion?.aiDrafts ?? {}),
                ...(kind === "ai" ? { [session.user.id]: { content: sharedContent, updatedAt: now } } : {}),
            },
            shared:
                kind === "additional"
                    ? {
                        content: sharedContent,
                        updatedAt: now,
                        updatedBy: session.user.name ?? null,
                    }
                    : rules.scriptCompanion?.shared,
            aiShared:
                kind === "ai"
                    ? {
                        content: sharedContent,
                        updatedAt: now,
                        updatedBy: session.user.name ?? null,
                    }
                    : rules.scriptCompanion?.aiShared,
            defaultTab: rules.scriptCompanion?.defaultTab ?? "base",
        },
    };

    await prisma.campaign.update({
        where: { id },
        data: { rules: nextRules as any },
    });

    return successResponse({ shared: true });
});
