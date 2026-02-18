// ============================================
// COMMS REAL-TIME HELPERS
// Publish events from API routes; resolve participants for typing.
// ============================================

import { prisma } from "@/lib/prisma";
import {
    publishToUser,
    subscribeTypingBroadcast,
    type CommsRealtimePayload,
} from "./events";

let typingFanOutInitialized = false;

async function ensureTypingFanOut(): Promise<void> {
    if (typingFanOutInitialized) return;
    typingFanOutInitialized = true;

    subscribeTypingBroadcast(async (data) => {
        const participants = await prisma.commsParticipant.findMany({
            where: { threadId: data.threadId },
            select: { userId: true },
        });
        const payload: CommsRealtimePayload = {
            type: data.isTyping ? "typing_start" : "typing_stop",
            threadId: data.threadId,
            userId: data.typistUserId,
            userName: data.typistUserName,
        };
        for (const p of participants) {
            if (p.userId === data.typistUserId) continue;
            publishToUser(p.userId, payload);
        }
    });
}

/**
 * Publish "message_created" to all participants of a thread except the author.
 * Includes userName so clients can render instantly without refetch.
 */
export async function publishMessageCreated(
    threadId: string,
    messageId: string,
    authorId: string,
    authorName: string,
    content: string,
    createdAt: string
): Promise<void> {
    const participants = await prisma.commsParticipant.findMany({
        where: { threadId },
        select: { userId: true },
    });
    const payload: CommsRealtimePayload = {
        type: "message_created",
        threadId,
        messageId,
        userId: authorId,
        userName: authorName,
        content,
        createdAt,
    };
    for (const p of participants) {
        if (p.userId === authorId) continue;
        publishToUser(p.userId, payload);
    }
}

/**
 * Publish "message_updated" to all participants.
 */
export async function publishMessageUpdated(
    threadId: string,
    messageId: string,
    content: string
): Promise<void> {
    const participants = await prisma.commsParticipant.findMany({
        where: { threadId },
        select: { userId: true },
    });
    const payload: CommsRealtimePayload = {
        type: "message_updated",
        threadId,
        messageId,
        content,
    };
    for (const p of participants) {
        publishToUser(p.userId, payload);
    }
}

/**
 * Publish "message_deleted" to all participants.
 */
export async function publishMessageDeleted(
    threadId: string,
    messageId: string
): Promise<void> {
    const participants = await prisma.commsParticipant.findMany({
        where: { threadId },
        select: { userId: true },
    });
    const payload: CommsRealtimePayload = {
        type: "message_deleted",
        threadId,
        messageId,
    };
    for (const p of participants) {
        publishToUser(p.userId, payload);
    }
}

/**
 * Publish "thread_status_updated" to all participants.
 */
export async function publishThreadStatusUpdated(
    threadId: string,
    status: string
): Promise<void> {
    const participants = await prisma.commsParticipant.findMany({
        where: { threadId },
        select: { userId: true },
    });
    const payload: CommsRealtimePayload = {
        type: "thread_status_updated",
        threadId,
        status,
    };
    for (const p of participants) {
        publishToUser(p.userId, payload);
    }
}

/**
 * Notify typing to other participants. Call from POST /api/comms/typing.
 */
export async function publishTyping(
    threadId: string,
    typistUserId: string,
    typistUserName: string,
    isTyping: boolean
): Promise<void> {
    await ensureTypingFanOut();
    const { emitTypingBroadcast } = await import("./events");
    emitTypingBroadcast(threadId, typistUserId, typistUserName, isTyping);
}
