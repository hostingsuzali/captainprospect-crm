import { NextRequest } from "next/server";
import { successResponse, requireRole, withErrorHandler } from "@/lib/api-utils";
import { statusConfigService } from "@/lib/services/StatusConfigService";

// ============================================
// GET /api/config/action-statuses
// Returns effective status definitions and next steps for the given scope.
// Query: campaignId=... OR missionId=... OR clientId=...
// Used by SDR action page and drawers to show allowed statuses with correct labels.
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["SDR", "MANAGER", "BUSINESS_DEVELOPER"], request);
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId") || undefined;
    const missionId = searchParams.get("missionId") || undefined;
    const clientId = searchParams.get("clientId") || undefined;

    if (!campaignId && !missionId && !clientId) {
        return successResponse({
            statuses: [],
            nextSteps: [],
            message: "Provide campaignId, missionId, or clientId",
        });
    }

    const config = await statusConfigService.getEffectiveStatusConfig({
        campaignId,
        missionId,
        clientId,
    });

    return successResponse(config);
});
