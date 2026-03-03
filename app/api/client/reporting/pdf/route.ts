import { NextRequest, NextResponse } from "next/server";
import {
    requireRole,
    withErrorHandler,
    AuthError,
} from "@/lib/api-utils";
import puppeteer from "puppeteer";
import chromium from "@sparticuz/chromium";
import { getReportHtml } from "./report-template";
import { getReportData, toReportData } from "../get-report-data";

// ============================================
// GET /api/client/reporting/pdf
// Generate PDF report for client (CLIENT only). Query: dateFrom, dateTo, missionId (optional), comparePrevious (optional)
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);
    const clientId = (session.user as { clientId?: string })?.clientId;
    if (!clientId) {
        throw new AuthError("Accès non autorisé", 403);
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom")?.trim();
    const dateTo = searchParams.get("dateTo")?.trim();
    const missionIdParam = searchParams.get("missionId")?.trim() || null;
    const comparePrevious = searchParams.get("comparePrevious") !== "false";

    if (!dateFrom || !dateTo) {
        return NextResponse.json(
            { success: false, error: "dateFrom et dateTo sont requis" },
            { status: 400 }
        );
    }

    const dateFromDate = new Date(dateFrom);
    const dateToDate = new Date(dateTo);
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
        missionId: missionIdParam,
        comparePrevious,
    });

    if (!raw) {
        return NextResponse.json(
            { success: false, error: "Client ou mission introuvable" },
            { status: 404 }
        );
    }

    const reportData = toReportData(raw, dateFromDate, dateToDate);
    const templateData = {
        ...reportData,
        missions: reportData.missions.map(({ id: _id, ...m }) => m),
    };
    const html = getReportHtml(templateData);
    const isVercel = process.env.VERCEL === "1";
    const browser = await puppeteer.launch({
        headless: true,
        args: isVercel ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: isVercel ? await chromium.executablePath() : undefined,
    });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "0", right: "0", bottom: "0", left: "0" },
        });
        const filename = `rapport-${raw.client.name.replace(/[^a-z0-9]/gi, "_")}-${dateFromDate.toISOString().slice(0, 10)}.pdf`;
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": String(pdfBuffer.length),
            },
        });
    } finally {
        await browser.close();
    }
});
