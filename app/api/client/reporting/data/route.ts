import { NextRequest, NextResponse } from "next/server";
import {
    requireRole,
    withErrorHandler,
    AuthError,
} from "@/lib/api-utils";
import { getReportData, toReportData } from "../get-report-data";

/**
 * GET /api/client/reporting/data
 * Returns report data for preview (CLIENT only).
 * Query: dateFrom, dateTo, missionId (optional), comparePrevious (optional, default true).
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);
    const clientId = (session.user as { clientId?: string })?.clientId;
    if (!clientId) {
        throw new AuthError("Accès non autorisé", 403);
    }

    const { searchParams } = new URL(request.url);
    const dateFromParam = searchParams.get("dateFrom")?.trim();
    const dateToParam = searchParams.get("dateTo")?.trim();
    const missionId = searchParams.get("missionId")?.trim() || null;
    const comparePrevious = searchParams.get("comparePrevious") !== "false";

    if (!dateFromParam || !dateToParam) {
        return NextResponse.json(
            { success: false, error: "dateFrom et dateTo sont requis" },
            { status: 400 }
        );
    }

    const dateFromDate = new Date(dateFromParam);
    const dateToDate = new Date(dateToParam);
    dateFromDate.setHours(0, 0, 0, 0);
    dateToDate.setHours(23, 59, 59, 999);

    if (Number.isNaN(dateFromDate.getTime()) || Number.isNaN(dateToDate.getTime())) {
        return NextResponse.json(
            { success: false, error: "Dates invalides" },
            { status: 400 }
        );
    }

    if (dateFromDate > dateToDate) {
        return NextResponse.json(
            { success: false, error: "La date de début doit être avant la date de fin" },
            { status: 400 }
        );
    }

    const raw = await getReportData({
        clientId,
        dateFrom: dateFromDate,
        dateTo: dateToDate,
        missionId,
        comparePrevious,
    });

    if (!raw) {
        return NextResponse.json(
            { success: false, error: "Client ou mission introuvable" },
            { status: 404 }
        );
    }

    const data = toReportData(raw, dateFromDate, dateToDate);
    return NextResponse.json({ success: true, data });
});
