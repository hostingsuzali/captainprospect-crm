import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pauseSession } from "@/lib/activity/session-manager";

// ============================================
// POST /api/sdr/activity/pause - Pause current session
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

        // Only SDRs and BUSINESS_DEVELOPERs can pause their own activity
        if (!["SDR", "BUSINESS_DEVELOPER"].includes(session.user.role)) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 403 }
            );
        }

        const userId = session.user.id;

        // Use session manager for transaction-safe pause
        const result = await pauseSession(userId);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error || "Failed to pause session" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                isActive: false,
                totalActiveSecondsToday: result.totalActiveSeconds,
                sessionSeconds: result.sessionSeconds,
                wasCapped: result.wasCapped,
            },
        });

    } catch (error) {
        console.error("[POST /api/sdr/activity/pause] Error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
