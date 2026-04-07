import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    requireRole,
    successResponse,
    errorResponse,
    withErrorHandler,
} from "@/lib/api-utils";
import {
    normalizeAssistantMemoryStore,
    upsertConversation,
} from "@/lib/assistant/memory";

type UserPreferences = Record<string, unknown> & {
    assistantMemory?: unknown;
};

function createConversationId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(
        ["SDR", "MANAGER", "CLIENT", "BUSINESS_DEVELOPER", "DEVELOPER"],
        request
    );

    const conversationId = request.nextUrl.searchParams.get("conversationId");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferences: true },
    });

    const prefs = (user?.preferences as UserPreferences) || {};
    const memory = normalizeAssistantMemoryStore(prefs.assistantMemory);

    const selected =
        (conversationId && memory.sessions.find((s) => s.id === conversationId)) ||
        memory.sessions.find((s) => s.id === memory.activeConversationId) ||
        memory.sessions[0] ||
        null;

    return successResponse({
        sessions: memory.sessions.map((s) => ({
            id: s.id,
            title: s.title,
            updatedAt: s.updatedAt,
            summary: s.summary ?? null,
            messageCount: s.messages.length,
        })),
        activeConversationId: selected?.id ?? null,
        messages: selected?.messages ?? [],
    });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(
        ["SDR", "MANAGER", "CLIENT", "BUSINESS_DEVELOPER", "DEVELOPER"],
        request
    );
    const body = (await request.json().catch(() => ({}))) as {
        action?: "new" | "setActive";
        conversationId?: string;
        title?: string;
    };

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferences: true },
    });

    const prefs = (user?.preferences as UserPreferences) || {};
    const memory = normalizeAssistantMemoryStore(prefs.assistantMemory);

    if (body.action === "setActive" && body.conversationId) {
        const exists = memory.sessions.some((s) => s.id === body.conversationId);
        if (!exists) return errorResponse("Conversation introuvable", 404);

        const updatedMemory = { ...memory, activeConversationId: body.conversationId };
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                preferences: {
                    ...(prefs || {}),
                    assistantMemory: updatedMemory,
                },
            },
        });

        const selected = updatedMemory.sessions.find((s) => s.id === body.conversationId)!;
        return successResponse({
            conversationId: selected.id,
            title: selected.title,
            messages: selected.messages,
        });
    }

    if (body.action !== "new") {
        return errorResponse("Action invalide", 400);
    }

    const conversationId = createConversationId();
    const updatedMemory = upsertConversation(
        memory,
        conversationId,
        [],
        undefined
    );
    if (body.title?.trim()) {
        const target = updatedMemory.sessions.find((s) => s.id === conversationId);
        if (target) target.title = body.title.trim();
    }

    await prisma.user.update({
        where: { id: session.user.id },
        data: {
            preferences: {
                ...(prefs || {}),
                assistantMemory: updatedMemory,
            },
        },
    });

    return successResponse({
        conversationId,
        title:
            updatedMemory.sessions.find((s) => s.id === conversationId)?.title ||
            "Nouvelle conversation",
        messages: [],
    });
});
