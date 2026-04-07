export type AssistantMemoryRole = "user" | "assistant";

export interface AssistantMemoryMessage {
    role: AssistantMemoryRole;
    content: string;
    createdAt: string;
}

export interface AssistantMemorySession {
    id: string;
    title: string;
    updatedAt: string;
    summary?: string;
    messages: AssistantMemoryMessage[];
}

export interface AssistantMemoryStore {
    sessions: AssistantMemorySession[];
    activeConversationId?: string;
}

const MAX_SESSIONS = 8;
const MAX_MESSAGES_PER_SESSION = 30;
const MAX_MESSAGE_LENGTH = 2400;

function toSafeString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}

function isRole(value: unknown): value is AssistantMemoryRole {
    return value === "user" || value === "assistant";
}

function clampContent(content: string): string {
    const clean = content.trim();
    return clean.length <= MAX_MESSAGE_LENGTH
        ? clean
        : `${clean.slice(0, MAX_MESSAGE_LENGTH)}...`;
}

function deriveSessionTitle(messages: AssistantMemoryMessage[]): string {
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return "Nouvelle conversation";
    const raw = firstUser.content.replace(/\s+/g, " ").trim();
    return raw.length > 48 ? `${raw.slice(0, 48)}...` : raw;
}

export function normalizeAssistantMemoryStore(raw: unknown): AssistantMemoryStore {
    const data = (raw && typeof raw === "object" ? raw : {}) as {
        sessions?: unknown[];
        activeConversationId?: unknown;
    };

    const sessions = (data.sessions ?? [])
        .filter((s) => !!s && typeof s === "object")
        .map((session) => {
            const s = session as {
                id?: unknown;
                title?: unknown;
                updatedAt?: unknown;
                summary?: unknown;
                messages?: unknown[];
            };
            const messages = (s.messages ?? [])
                .filter((m) => !!m && typeof m === "object")
                .map((msg) => {
                    const m = msg as {
                        role?: unknown;
                        content?: unknown;
                        createdAt?: unknown;
                    };
                    return {
                        role: isRole(m.role) ? m.role : "assistant",
                        content: clampContent(toSafeString(m.content)),
                        createdAt: toSafeString(m.createdAt, new Date().toISOString()),
                    } as AssistantMemoryMessage;
                })
                .filter((m) => m.content.length > 0)
                .slice(-MAX_MESSAGES_PER_SESSION);

            const title = toSafeString(s.title) || deriveSessionTitle(messages);
            return {
                id: toSafeString(s.id),
                title: title || "Nouvelle conversation",
                updatedAt: toSafeString(s.updatedAt, new Date().toISOString()),
                summary: toSafeString(s.summary) || undefined,
                messages,
            } as AssistantMemorySession;
        })
        .filter((s) => s.id.length > 0)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, MAX_SESSIONS);

    return {
        sessions,
        activeConversationId: toSafeString(data.activeConversationId) || sessions[0]?.id,
    };
}

export function upsertConversation(
    store: AssistantMemoryStore,
    conversationId: string,
    incomingMessages: AssistantMemoryMessage[],
    nextSummary?: string
): AssistantMemoryStore {
    const now = new Date().toISOString();
    const safeIncoming = incomingMessages
        .map((m) => ({
            role: m.role,
            content: clampContent(m.content),
            createdAt: m.createdAt || now,
        }))
        .filter((m) => m.content.length > 0);

    const existing = store.sessions.find((s) => s.id === conversationId);
    const mergedMessages = [...(existing?.messages ?? []), ...safeIncoming].slice(
        -MAX_MESSAGES_PER_SESSION
    );
    const title = existing?.title || deriveSessionTitle(mergedMessages);
    const summary = nextSummary || existing?.summary;

    const updated: AssistantMemorySession = {
        id: conversationId,
        title: title || "Nouvelle conversation",
        updatedAt: now,
        summary,
        messages: mergedMessages,
    };

    const sessions = [updated, ...store.sessions.filter((s) => s.id !== conversationId)].slice(
        0,
        MAX_SESSIONS
    );

    return {
        sessions,
        activeConversationId: conversationId,
    };
}

export function buildMemoryContextSnippet(
    store: AssistantMemoryStore,
    activeConversationId?: string
): string {
    const current = store.sessions.find((s) => s.id === activeConversationId) || store.sessions[0];
    if (!current) return "";

    const recent = current.messages.slice(-10);
    const recentText = recent
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

    const historicalSummaries = store.sessions
        .filter((s) => s.id !== current.id && s.summary)
        .slice(0, 3)
        .map((s) => `- ${s.title}: ${s.summary}`)
        .join("\n");

    return [
        `Conversation memory (active thread: ${current.title})`,
        current.summary ? `Active thread summary: ${current.summary}` : "",
        recentText ? `Recent turns:\n${recentText}` : "",
        historicalSummaries ? `Other past thread summaries:\n${historicalSummaries}` : "",
        "Use this memory only to maintain continuity. If new user instruction conflicts with memory, follow the latest user instruction.",
    ]
        .filter(Boolean)
        .join("\n\n");
}

export function buildSessionSummary(messages: AssistantMemoryMessage[]): string {
    const userTurns = messages.filter((m) => m.role === "user").slice(-3);
    if (userTurns.length === 0) return "";
    const condensed = userTurns
        .map((m) => m.content.replace(/\s+/g, " ").trim())
        .join(" | ");
    return condensed.length > 240 ? `${condensed.slice(0, 240)}...` : condensed;
}
