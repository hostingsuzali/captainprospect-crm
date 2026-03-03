import { NextRequest, NextResponse } from "next/server";
import {
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import puppeteer from "puppeteer";
import { getAnalyticsReportData } from "../get-report-data";
import { getAnalyticsReportHtml } from "../report-template";

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-large-latest";

// ============================================
// GET /api/analytics/report/pdf
// Query: from, to, missionIds[]?, sdrIds[]?, clientIds[]?
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER", "DEVELOPER"], request);

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from")?.trim();
    const to = searchParams.get("to")?.trim();
    const missionIds = searchParams.getAll("missionIds[]");
    const sdrIds = searchParams.getAll("sdrIds[]");
    const clientIds = searchParams.getAll("clientIds[]");

    if (!from || !to) {
        return NextResponse.json(
            { success: false, error: "from et to sont requis" },
            { status: 400 }
        );
    }

    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    dateFrom.setHours(0, 0, 0, 0);
    dateTo.setHours(23, 59, 59, 999);

    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
        return NextResponse.json(
            { success: false, error: "Dates invalides" },
            { status: 400 }
        );
    }

    if (dateFrom > dateTo) {
        return NextResponse.json(
            { success: false, error: "La date de début doit être avant la date de fin" },
            { status: 400 }
        );
    }

    const raw = await getAnalyticsReportData({
        from,
        to,
        missionIds,
        sdrIds,
        clientIds,
    });

    // AI summary
    let aiSummary = "Aucune donnée suffisante pour générer une analyse.";
    const apiKey = process.env.MISTRAL_API_KEY;
    if (apiKey && (raw.kpis.totalCalls > 0 || raw.notesSample.length > 0)) {
        try {
            const notesText = raw.notesSample
                .slice(0, 20)
                .map((n) => `- ${n.slice(0, 200)}`)
                .join("\n");
            const statsText = `
Statistiques :
- Appels : ${raw.kpis.totalCalls}
- RDV bookés : ${raw.kpis.meetings}
- Taux conversion : ${raw.kpis.conversionRate}%
- Non-réponse : ${raw.kpis.noResponse}
- Rappels/Intéressés : ${raw.kpis.callbacks}
- Talk time total : ${Math.round(raw.kpis.totalTalkTime / 60)} min

${raw.sdrPerformance.length > 0 ? `Top SDR : ${raw.sdrPerformance[0].sdrName} (${raw.sdrPerformance[0].meetings} RDV)` : ""}
${notesText ? `\nNotes d'appel (échantillon) :\n${notesText}` : ""}
`;
            const res = await fetch(MISTRAL_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: MISTRAL_MODEL,
                    messages: [
                        {
                            role: "system",
                            content: `Tu es un analyste commercial expert. À partir des stats et notes de prospection B2B, rédige une synthèse exécutive courte (3 à 5 bullet points ou 1 paragraphe dense, max 150 mots) en français. Inclus : tendances principales, points d'attention, recommandations prioritaires. Style professionnel, concis. Réponds UNIQUEMENT par le texte de synthèse, sans préambule.`,
                        },
                        { role: "user", content: statsText.trim() },
                    ],
                    temperature: 0.4,
                    max_tokens: 500,
                }),
            });
            if (res.ok) {
                const json = await res.json();
                const content = json.choices?.[0]?.message?.content?.trim();
                if (content) aiSummary = content;
            }
        } catch (err) {
            console.error("Mistral report summary error:", err);
        }
    }

    const templateData = {
        ...raw,
        aiSummary,
    };
    const html = getAnalyticsReportHtml(templateData);

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
        });
        const filename = `rapport-analytics-${from}-${to}.pdf`;
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
