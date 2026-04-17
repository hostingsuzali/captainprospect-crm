import { NextRequest } from "next/server";
import { z } from "zod";
import {
    errorResponse,
    requireRole,
    successResponse,
    validateRequest,
    withErrorHandler,
} from "@/lib/api-utils";
import {
    ASSISTANT_PROMPT_VERSION,
    getCaptainAssistantSystemPrompt,
} from "@/lib/assistant/systemPrompt";
import {
    AssistantRuntimeContext,
    buildAssistantRuntimeContextPrompt,
} from "@/lib/assistant/context";
import { openaiChatComplete } from "@/lib/ai/openai";
import { geminiGenerate } from "@/lib/ai/gemini";
import { prisma } from "@/lib/prisma";
import {
    buildMemoryContextSnippet,
    buildSessionSummary,
    normalizeAssistantMemoryStore,
    upsertConversation,
} from "@/lib/assistant/memory";
import { buildManagerLiveDataContext } from "@/lib/assistant/managerLiveData";
import { buildDocsContext } from "@/lib/assistant/docs/loader";

const messageSchema = z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(8000),
});

const chatRequestSchema = z.object({
    messages: z.array(messageSchema).min(1).max(40),
    context: z
        .object({
            role: z.string().optional(),
            pathname: z.string().optional(),
            missionName: z.string().optional(),
            currentPage: z.string().optional(),
        })
        .optional(),
    sessionId: z.string().max(120).optional(),
    conversationId: z.string().max(120).optional(),
    temperature: z.number().min(0).max(1).optional(),
});

function buildSystemPrompt(
    runtime?: AssistantRuntimeContext,
    memoryContext?: string
): string {
    const base = getCaptainAssistantSystemPrompt();
    const runtimeContext = buildAssistantRuntimeContextPrompt(runtime);
    const safety = `Additional constraints:
- Keep answers concise and actionable.
- If process-oriented, use numbered steps.
- If unsure about a feature state, say "this is coming soon" instead of inventing behavior.
- Ask at most one clarifying question only when absolutely required.
- Respect role boundaries when describing who can access what.
- Use conversation memory when relevant, but prioritize the most recent user instruction.
- When live operational data is provided in context, answer with concrete facts first (names, counts, missions), then optional guidance.
- Do not replace factual answer with generic "go to this page" instructions if data is already available.`;

    return [base, runtimeContext, memoryContext, safety].filter(Boolean).join("\n\n");
}

function truncateConversation(
    messages: Array<{ role: "user" | "assistant"; content: string }>
) {
    return messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content.trim(),
    }));
}

function serializeConversation(
    messages: Array<{ role: "user" | "assistant"; content: string }>
): string {
    return messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");
}

async function callMistralFallback(
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    temperature = 0.35
) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        throw new Error("Mistral fallback unavailable (missing MISTRAL_API_KEY)");
    }

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "mistral-large-latest",
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            temperature,
            max_tokens: 1200,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            (error as { error?: { message?: string } })?.error?.message ||
                "Mistral request failed"
        );
    }

    const result = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
        };
    };

    const text = result.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Mistral returned empty answer");

    return {
        answer: text,
        provider: "mistral",
        usage: result.usage
            ? {
                promptTokens: result.usage.prompt_tokens,
                completionTokens: result.usage.completion_tokens,
                totalTokens: result.usage.total_tokens,
            }
            : undefined,
    };
}

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(
        ["SDR", "MANAGER", "CLIENT", "BUSINESS_DEVELOPER", "DEVELOPER"],
        request
    );

    const startedAt = Date.now();
    const payload = await validateRequest(request, chatRequestSchema);
    const messages = truncateConversation(payload.messages);
    const latestUserQuestion =
        [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const temperature = payload.temperature ?? 0.35;
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const fallbackConversationId =
        payload.conversationId ||
        payload.sessionId ||
        (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `conv-${Date.now()}`);

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferences: true },
    });
    const preferences = ((user?.preferences as Record<string, unknown>) || {});
    const memoryStore = normalizeAssistantMemoryStore(preferences.assistantMemory);
    const conversationId = payload.conversationId || memoryStore.activeConversationId || fallbackConversationId;
    const memoryContext = buildMemoryContextSnippet(memoryStore, conversationId);
    const managerLiveContext =
        session.user.role === "MANAGER" && latestUserQuestion
            ? await buildManagerLiveDataContext(latestUserQuestion)
            : "";

    // Inject how-to docs relevant to the user's current page + question
    const docsContext = latestUserQuestion
        ? buildDocsContext(
              payload.context?.pathname || "",
              latestUserQuestion,
              session.user.role || ""
          )
        : "";

    const systemPrompt = buildSystemPrompt(
        payload.context,
        [memoryContext, docsContext, managerLiveContext].filter(Boolean).join("\n\n")
    );

    if (!openaiKey && !geminiKey && !process.env.MISTRAL_API_KEY) {
        return errorResponse(
            "No AI provider configured (OPENAI_API_KEY, GEMINI_API_KEY, or MISTRAL_API_KEY).",
            500
        );
    }

    try {
        let answer = "";
        let provider = "";
        let model: string | undefined;
        let usage:
            | {
                promptTokens?: number;
                completionTokens?: number;
                totalTokens?: number;
            }
            | undefined;

        if (openaiKey) {
            const result = await openaiChatComplete(
                openaiKey,
                [{ role: "system", content: systemPrompt }, ...messages],
                {
                    temperature,
                    maxTokens: 1200,
                }
            );
            answer = result.text;
            provider = "openai";
            model = result.model ?? "gpt-4.1-mini";
            usage = result.usage;

            console.info("[assistant.chat]", {
                provider,
                promptVersion: ASSISTANT_PROMPT_VERSION,
                sessionId: payload.sessionId ?? null,
                conversationId,
                durationMs: Date.now() - startedAt,
                tokens: result.usage?.totalTokens ?? null,
            });
        } else if (geminiKey) {
            const transcript = serializeConversation(messages);
            const gemini = await geminiGenerate(
                geminiKey,
                systemPrompt,
                transcript,
                {
                    temperature,
                    maxOutputTokens: 1200,
                }
            );
            answer = gemini.text;
            provider = "gemini";
            model = "gemini-2.0-flash";
            usage = gemini.usage;

            console.info("[assistant.chat]", {
                provider,
                promptVersion: ASSISTANT_PROMPT_VERSION,
                sessionId: payload.sessionId ?? null,
                conversationId,
                durationMs: Date.now() - startedAt,
                tokens: gemini.usage?.totalTokens ?? null,
            });
        } else {
            const mistral = await callMistralFallback(systemPrompt, messages, temperature);
            answer = mistral.answer;
            provider = mistral.provider;
            usage = mistral.usage;
            model = "mistral-large-latest";

            console.info("[assistant.chat]", {
                provider,
                promptVersion: ASSISTANT_PROMPT_VERSION,
                sessionId: payload.sessionId ?? null,
                conversationId,
                durationMs: Date.now() - startedAt,
                tokens: usage?.totalTokens ?? null,
            });
        }

        if (latestUserQuestion) {
            const savedStore = upsertConversation(
                memoryStore,
                conversationId,
                [
                    {
                        role: "user",
                        content: latestUserQuestion,
                        createdAt: new Date().toISOString(),
                    },
                    {
                        role: "assistant",
                        content: answer,
                        createdAt: new Date().toISOString(),
                    },
                ],
                undefined
            );
            const targetSession = savedStore.sessions.find((s) => s.id === conversationId);
            if (targetSession) {
                targetSession.summary = buildSessionSummary(targetSession.messages);
            }

            // Non-blocking memory save; do not fail response if persistence fails.
            prisma.user
                .update({
                    where: { id: session.user.id },
                    data: {
                        preferences: {
                            ...preferences,
                            assistantMemory: savedStore,
                        },
                    },
                })
                .catch((e) => console.error("Assistant memory save failed:", e));
        }

        return successResponse({
            answer,
            provider,
            model,
            usage,
            promptVersion: ASSISTANT_PROMPT_VERSION,
            conversationId,
        });
    } catch (error) {
        console.error("Assistant chat error:", error);
        return errorResponse(
            error instanceof Error ? error.message : "Assistant request failed",
            500
        );
    }
});
