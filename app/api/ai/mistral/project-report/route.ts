// ============================================
// POST /api/ai/mistral/project-report - AI project status report
// ============================================

import { NextRequest } from 'next/server';
import {
    successResponse,
    errorResponse,
    requireAuth,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

const projectReportSchema = z.object({
    projectName: z.string().max(200),
    projectDescription: z.string().max(2000).optional(),
    taskStats: z.object({
        total: z.number(),
        completed: z.number(),
        inProgress: z.number(),
        overdue: z.number(),
        completionPercent: z.number(),
    }),
    teamMembers: z.array(z.object({
        name: z.string(),
        tasksCount: z.number(),
        completedCount: z.number(),
    })).optional(),
    recentActivity: z.array(z.string()).max(20).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-large-latest';

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireAuth(request);

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        return errorResponse('MISTRAL_API_KEY non configurée', 503);
    }

    const data = await validateRequest(request, projectReportSchema);

    const systemPrompt = `Tu es un chef de projet expert. Génère un rapport de statut professionnel en markdown pour un projet.

Le rapport doit inclure :
1. **Résumé exécutif** (2-3 phrases)
2. **Progrès** (avancement global, tâches complétées)
3. **Points d'attention** (retards, tâches en retard, risques)
4. **Performance de l'équipe** (si données disponibles)
5. **Recommandations** (2-3 actions prioritaires)
6. **Prévisions** (estimation de fin si dates disponibles)

Contraintes :
- Ton professionnel mais accessible
- Format markdown propre
- Utiliser des indicateurs (✅ ⚠️ 🔴) pour les statuts
- Répondre en français
- Maximum 500 mots`;

    const userContent = `Projet : ${data.projectName}
${data.projectDescription ? `Description : ${data.projectDescription}` : ''}
${data.startDate ? `Date début : ${data.startDate}` : ''}
${data.endDate ? `Date fin prévue : ${data.endDate}` : ''}

Statistiques :
- Total tâches : ${data.taskStats.total}
- Complétées : ${data.taskStats.completed} (${data.taskStats.completionPercent}%)
- En cours : ${data.taskStats.inProgress}
- En retard : ${data.taskStats.overdue}

${data.teamMembers?.length ? `Équipe :\n${data.teamMembers.map(m => `- ${m.name}: ${m.completedCount}/${m.tasksCount} tâches`).join('\n')}` : ''}

${data.recentActivity?.length ? `Activité récente :\n${data.recentActivity.map(a => `- ${a}`).join('\n')}` : ''}`;

    try {
        const response = await fetch(MISTRAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MISTRAL_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent },
                ],
                temperature: 0.4,
                max_tokens: 2000,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error('Mistral project-report error:', err);
            return errorResponse(err.error?.message || 'Erreur Mistral AI', response.status);
        }

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content?.trim();

        if (!content) {
            return errorResponse('Réponse vide de Mistral AI', 500);
        }

        return successResponse({ report: content });
    } catch (error) {
        console.error('Mistral project-report request failed:', error);
        return errorResponse('Erreur de connexion à Mistral AI', 500);
    }
});
