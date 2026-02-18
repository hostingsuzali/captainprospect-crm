import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startSession } from "@/lib/activity/session-manager";

// ============================================
// POST /api/sdr/activity/start - Start activity session
// ============================================

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        // Only SDRs and BUSINESS_DEVELOPERs can start their own activity
        if (!["SDR", "BUSINESS_DEVELOPER"].includes(session.user.role)) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 403 }
            );
        }

        const userId = session.user.id;

        // Use session manager to start session
        const result = await startSession(userId);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: "Failed to start session" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                isActive: true,
                totalActiveSecondsToday: result.totalActiveSeconds,
                currentSessionStartedAt: result.currentSessionStartedAt?.toISOString(),
            },
        });

    } catch (error) {
        console.error("[POST /api/sdr/activity/start] Error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
