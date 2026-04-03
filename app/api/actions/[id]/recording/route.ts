import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    errorResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
} from "@/lib/api-utils";
import { actionService } from "@/lib/services/ActionService";

const ALLO_HOST = "api.withallo.com";
const ALLO_RECORDINGS_PATH_PREFIX = "/v1/assets/recordings/";

function parseAllowedAlloRecordingUrl(urlString: string): URL {
    let u: URL;
    try {
        u = new URL(urlString.trim());
    } catch {
        throw new NotFoundError("Enregistrement introuvable");
    }
    if (u.protocol !== "https:") throw new NotFoundError("Enregistrement introuvable");
    if (u.hostname !== ALLO_HOST) throw new NotFoundError("Enregistrement introuvable");
    if (!u.pathname.startsWith(ALLO_RECORDINGS_PATH_PREFIX)) {
        throw new NotFoundError("Enregistrement introuvable");
    }
    return u;
}

async function assertCanStreamRecording(
    userId: string,
    role: string,
    action: { sdrId: string; campaign: { missionId: string } },
) {
    if (role === "MANAGER" || role === "BOOKER") return;
    if (role === "SDR" || role === "BUSINESS_DEVELOPER") {
        if (action.sdrId === userId) return;
        const isLead = await actionService.isTeamLeadForMission(userId, action.campaign.missionId);
        if (isLead) return;
    }
    throw new NotFoundError("Enregistrement introuvable");
}

// GET /api/actions/[id]/recording — stream Allo MP3 with server-side API key (browser cannot send Allo auth)
export const GET = withErrorHandler(
    async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
        const session = await requireRole(
            ["MANAGER", "SDR", "BUSINESS_DEVELOPER", "BOOKER"],
            request,
        );
        const { id } = await params;

        const action = await prisma.action.findUnique({
            where: { id },
            select: {
                callRecordingUrl: true,
                sdrId: true,
                campaign: { select: { missionId: true } },
            },
        });

        if (!action?.callRecordingUrl?.trim()) {
            throw new NotFoundError("Enregistrement introuvable");
        }

        await assertCanStreamRecording(session.user.id, session.user.role, action);

        const targetUrl = parseAllowedAlloRecordingUrl(action.callRecordingUrl);
        const apiKey = process.env.ALLO_API_KEY;
        if (!apiKey) {
            return errorResponse("ALLO_API_KEY non configuré", 503);
        }

        const range = request.headers.get("Range") ?? undefined;
        const upstream = await fetch(targetUrl.toString(), {
            headers: {
                Authorization: apiKey,
                ...(range ? { Range: range } : {}),
            },
            cache: "no-store",
        });

        if (!upstream.ok && upstream.status !== 206) {
            return errorResponse("Impossible de lire l'enregistrement", upstream.status >= 500 ? 502 : 404);
        }

        const out = new Headers();
        const ct = upstream.headers.get("Content-Type");
        out.set("Content-Type", ct || "audio/mpeg");
        const ar = upstream.headers.get("Accept-Ranges");
        if (ar) out.set("Accept-Ranges", ar);
        const cr = upstream.headers.get("Content-Range");
        if (cr) out.set("Content-Range", cr);
        const cl = upstream.headers.get("Content-Length");
        if (cl) out.set("Content-Length", cl);
        out.set("Cache-Control", "private, max-age=300");

        return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: out,
        });
    },
);
