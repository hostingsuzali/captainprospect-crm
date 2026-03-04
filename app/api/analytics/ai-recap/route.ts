/**
 * POST /api/analytics/ai-recap
 * AI-powered analysis of all call notes: status, objections, causes, recommendations.
 * Supports interactive follow-up questions.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireRole, withErrorHandler, errorResponse, successResponse } from "@/lib/api-utils";
import { z } from "zod";

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-large-latest";

const ACTION_RESULT_LABELS: Record<string, string> = {
    NO_RESPONSE: "Pas de réponse",
    BAD_CONTACT: "Mauvais contact",
    INTERESTED: "Intéressé",
    CALLBACK_REQUESTED: "Rappel demandé",
    MEETING_BOOKED: "Meeting booké",
    MEETING_CANCELLED: "Meeting annulé",
    DISQUALIFIED: "Disqualifié",
    NOT_INTERESTED: "Pas intéressé",
    ENVOIE_MAIL: "Envoie mail",
};

const requestSchema = z.object({
    from: z.string(),
    to: z.string(),
    missionIds: z.array(z.string()).optional().default([]),
    sdrIds: z.array(z.string()).optional().default([]),
    clientIds: z.array(z.string()).optional().default([]),
    listIds: z.array(z.string()).optional().default([]),
    followUp: z.string().optional(),
    previousRecap: z.string().optional(), // For follow-up: the assistant's previous recap
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER", "DEVELOPER"], request);

    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Paramètres invalides (from, to requis)", 400);
    }

    const { from, to, missionIds, sdrIds, clientIds, listIds, followUp, previousRecap } =
        parsed.data;

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        return errorResponse("MISTRAL_API_KEY non configurée. L'analyse IA est indisponible.", 503);
    }

    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    dateFrom.setHours(0, 0, 0, 0);
    dateTo.setHours(23, 59, 999);

    const where: Prisma.ActionWhereInput = {
        channel: "CALL",
        createdAt: { gte: dateFrom, lte: dateTo },
    };
    if (sdrIds.length > 0) where.sdrId = { in: sdrIds };
    if (missionIds.length > 0 || clientIds.length > 0) {
        where.campaign = {
            mission: {
                ...(missionIds.length > 0 && { id: { in: missionIds } }),
                ...(clientIds.length > 0 && { clientId: { in: clientIds } }),
            },
        };
    }
    if (listIds.length > 0) {
        where.OR = [
            { company: { listId: { in: listIds } } },
            { contact: { company: { listId: { in: listIds } } } },
        ];
    }

    const [basicStats, statusBreakdown, sdrPerf, actionsWithNotes] = await Promise.all([
        prisma.action.aggregate({
            where,
            _count: { id: true },
            _sum: { duration: true },
        }),
        prisma.action.groupBy({
            by: ["result"],
            where,
            _count: { id: true },
        }),
        prisma.action.findMany({
            where: { ...where, sdrId: { not: undefined } },
            select: { sdr: { select: { name: true } } },
            distinct: ["sdrId"],
        }),
        prisma.action.findMany({
            where: { ...where, note: { not: null } },
            select: { note: true, result: true },
            orderBy: { createdAt: "desc" },
            take: 500,
        }),
    ]);

    const statuses: Record<string, number> = {};
    statusBreakdown.forEach((s) => {
        statuses[s.result] = s._count.id;
    });

    const totalCalls = basicStats._count.id;
    const meetings = statuses["MEETING_BOOKED"] || 0;
    const conversionRate =
        totalCalls > 0 ? Math.round((meetings / totalCalls) * 10000) / 100 : 0;
    const noResponse = statuses["NO_RESPONSE"] || 0;
    const callbacks =
        (statuses["CALLBACK_REQUESTED"] || 0) + (statuses["INTERESTED"] || 0);
    const disqualified = statuses["DISQUALIFIED"] || 0;
    const notInterested = statuses["NOT_INTERESTED"] || 0;

    const notesWithStatus = actionsWithNotes
        .filter((a) => a.note && a.note.trim().length > 3)
        .map((a) => ({
            result: a.result,
            resultLabel: ACTION_RESULT_LABELS[a.result] || a.result,
            note: (a.note || "").trim().slice(0, 400),
        }));

    const periodLabel = `${dateFrom.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    })} – ${dateTo.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    })}`;

    const statsText = `
Période : ${periodLabel}

Statistiques :
- Total appels : ${totalCalls}
- RDV bookés : ${meetings}
- Taux de conversion : ${conversionRate}%
- Non-réponse : ${noResponse}
- Rappels / Intéressés : ${callbacks}
- Disqualifiés : ${disqualified}
- Pas intéressé : ${notInterested}
- Talk time total : ${Math.round((basicStats._sum.duration || 0) / 60)} min

Top SDR : ${sdrPerf[0]?.sdr?.name || "—"}
`;

    const notesText =
        notesWithStatus.length > 0
            ? `
Notes d'appel (chaque note avec son statut) — ${notesWithStatus.length} notes analysées :

${notesWithStatus
    .map(
        (n) =>
            `[${n.resultLabel}] ${n.note}`
    )
    .join("\n\n")}
`
            : "\nAucune note d'appel disponible pour cette période.";

    const systemPrompt = `Tu es un analyste commercial expert en prospection B2B. Tu analyses les notes d'appels SDR pour produire des synthèses actionnables.

Ta mission :
1. Analyser les statuts (non-réponse, disqualifiés, intéressés, meetings, etc.) et leurs tendances
2. Identifier les objections récurrentes mentionnées dans les notes (budget, timing, déjà un prestataire, pas le bon interlocuteur, etc.)
3. Mettre en évidence les causes racines des disqualifications et des refus
4. Donner des recommandations concrètes pour améliorer les résultats

Réponds en français, de façon structurée et professionnelle. Utilise des listes à puces quand c'est pertinent. Sois factuel et basé uniquement sur les données fournies.`;

    const suggestedFollowUps = [
        { id: "objections", label: "Analyser les objections en détail" },
        { id: "causes", label: "Causes des disqualifications" },
        { id: "recommandations", label: "Recommandations d'amélioration" },
        { id: "meetings", label: "Facteurs de succès des RDV bookés" },
        { id: "non_reponse", label: "Stratégies pour réduire la non-réponse" },
    ];

    let messages: { role: string; content: string }[] = [
        { role: "system", content: systemPrompt },
    ];

    const initialUserContent = `Voici les données de prospection pour la période sélectionnée.

${statsText}
${notesText}

Produis une synthèse IA complète : statuts, objections identifiées, causes des disqualifications, et recommandations prioritaires.`;

    if (followUp && previousRecap) {
        messages.push({ role: "user", content: initialUserContent });
        messages.push({ role: "assistant", content: previousRecap });
        messages.push({
            role: "user",
            content: `Question de suivi : ${followUp}\n\nRéponds de façon concise et actionnable à cette question, en t'appuyant sur les données et l'analyse ci-dessus.`,
        });
    } else {
        messages.push({ role: "user", content: initialUserContent });
    }

    try {
        const res = await fetch(MISTRAL_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MISTRAL_MODEL,
                messages,
                temperature: 0.4,
                max_tokens: 1500,
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("Mistral ai-recap error:", err);
            return errorResponse(
                (err as { error?: { message?: string } })?.error?.message || "Erreur Mistral AI",
                res.status
            );
        }

        const json = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
        };
        const recap = json.choices?.[0]?.message?.content?.trim();

        if (!recap) {
            return errorResponse("Réponse vide de Mistral AI", 500);
        }

        return successResponse({
            recap,
            suggestedFollowUps,
            notesCount: notesWithStatus.length,
        });
    } catch (err) {
        console.error("Mistral ai-recap request failed:", err);
        return errorResponse("Erreur de connexion à Mistral AI", 500);
    }
});
