import { NextRequest } from "next/server";
import { requireRole, successResponse, withErrorHandler } from "@/lib/api-utils";
import { deleteOldAuthEvents } from "@/lib/auth-event";
import { prisma } from "@/lib/prisma";

// Retention cleanup — DEVELOPER only (can be called by cron or manually).
// Reads retention period from SystemConfig key "authEventRetentionDays" (default 90).
export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["DEVELOPER"], request);

    const config = await prisma.systemConfig.findUnique({
        where: { key: "authEventRetentionDays" },
    });
    const retentionDays = config?.value ? parseInt(config.value, 10) : 90;

    const deleted = await deleteOldAuthEvents(
        isNaN(retentionDays) || retentionDays < 1 ? 90 : retentionDays
    );

    return successResponse({ deleted, retentionDays });
});
