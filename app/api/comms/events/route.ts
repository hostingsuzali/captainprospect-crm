// ============================================
// API: /api/comms/events
// Server-Sent Events stream for real-time comms updates
// ============================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscribeToUser, type CommsRealtimePayload } from "@/lib/comms/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.id;
    const encoder = new TextEncoder();
    let keepAliveId: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const send = (payload: CommsRealtimePayload) => {
                try {
                    const data = `data: ${JSON.stringify(payload)}\n\n`;
                    controller.enqueue(encoder.encode(data));
                } catch (_) {
                    /* stream closed */
                }
            };

            send({
                type: "presence_online",
                threadId: "",
                userId,
                userName: session.user.name ?? undefined,
            } as CommsRealtimePayload);

            unsubscribe = subscribeToUser(userId, send);

            keepAliveId = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(": keepalive\n\n"));
                } catch {
                    if (keepAliveId) clearInterval(keepAliveId);
                }
            }, 25000);
        },
        cancel() {
            if (keepAliveId) clearInterval(keepAliveId);
            unsubscribe?.();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
