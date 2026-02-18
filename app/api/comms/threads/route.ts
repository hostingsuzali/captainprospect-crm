// ============================================
// API: /api/comms/threads
// List threads (inbox) and create new threads
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    getInboxThreads,
    createThread,
    canAccessChannel,
} from "@/lib/comms/service";
import type {
    CreateThreadRequest,
    CommsInboxFilters,
    CommsChannelType,
    CommsThreadStatus,
} from "@/lib/comms/types";

// GET /api/comms/threads - List threads (inbox)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1", 10);
        const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

        const filters: CommsInboxFilters = {
            type: searchParams.get("type") as CommsChannelType | undefined,
            status: searchParams.get("status") as CommsThreadStatus | undefined,
            unreadOnly: searchParams.get("unreadOnly") === "true",
            search: searchParams.get("search") || undefined,
        };

        const result = await getInboxThreads(session.user.id, filters, page, pageSize);

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching threads:", error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération des discussions" },
            { status: 500 }
        );
    }
}

// POST /api/comms/threads - Create a new thread
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const body: CreateThreadRequest = await request.json();

        // Validate required fields
        if (!body.channelType || !body.subject || !body.initialMessage) {
            return NextResponse.json(
                { error: "channelType, subject, and initialMessage are required" },
                { status: 400 }
            );
        }

        // Check permission to create thread in this channel
        const canAccess = await canAccessChannel(
            session.user.id,
            session.user.role,
            body.channelType,
            body.anchorId
        );

        if (!canAccess) {
            return NextResponse.json(
                { error: "Vous n'avez pas accès à ce canal" },
                { status: 403 }
            );
        }

        // Only managers can create broadcasts
        if (body.isBroadcast && session.user.role !== "MANAGER") {
            return NextResponse.json(
                { error: "Seuls les managers peuvent créer des annonces" },
                { status: 403 }
            );
        }

        const threadId = await createThread(body, session.user.id);

        return NextResponse.json({ id: threadId }, { status: 201 });
    } catch (error) {
        console.error("Error creating thread:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erreur lors de la création" },
            { status: 500 }
        );
    }
}
