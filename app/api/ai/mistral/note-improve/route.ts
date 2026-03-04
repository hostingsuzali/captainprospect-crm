// ============================================
// POST /api/ai/mistral/note-improve - Fix orthography and rephrase note
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

const noteImproveSchema = z.object({
    text: z.string().max(500, 'Note trop longue'),
    channel: z.enum(['CALL', 'EMAIL', 'LINKEDIN']).optional(),
    resultCode: z.string().optional(),
    resultLabel: z.string().optional(),
});

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-large-latest';

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireAuth(request);

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        return errorResponse('MISTRAL_API_KEY non configurée', 503);
    }

    const { text, channel, resultCode, resultLabel } = await validateRequest(request, noteImproveSchema);

    if (!text?.trim()) {
        return errorResponse('Texte requis', 400);
    }

    const systemPrompt = `Tu travailles dans CaptainProspect, un CRM de prospection B2B.

Tu améliores des notes internes rédigées par un commercial (SDR / business developer) après un échange (appel, email, LinkedIn) avec un contact ou une entreprise.

Contexte :
- La note décrit ce qui s'est passé pendant l'échange : ce que le prospect a dit, son intérêt, les objections, le niveau de qualification, les prochaines étapes (rappel, démo, envoi d'email, etc.).
- Ce n'est PAS un message envoyé au prospect, mais un compte-rendu interne qui sera relu plus tard par le SDR, son manager ou un collègue.
${channel ? `- Canal de l'action: ${channel}` : ''}
${(resultCode || resultLabel) ? `- Résultat CRM (statut sélectionné) : ${resultLabel || resultCode}` : ''}

Ta tâche :
- Corriger l'orthographe et la grammaire.
- Reformuler pour que la note soit claire, concise et professionnelle, tout en restant une note interne (pas un email).

Contraintes :
- Réponds UNIQUEMENT par le texte amélioré, sans préambule ni explication.
- Garde exactement le même sens et les mêmes infos (dates, noms, décisions, "rappeler à...", "intéressé par...", etc.).
- Maximum 500 caractères.
- Style : note interne de compte-rendu d'échange, pas un message adressé au prospect.`;

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
                    {
                        role: 'user',
                        content:
                            `Voici la note brute à améliorer (ne change pas le fond, seulement la forme) :\n\n` +
                            text.trim(),
                    },
                ],
                temperature: 0.3,
                max_tokens: 400,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error('Mistral note-improve error:', err);
            return errorResponse(
                err.error?.message || 'Erreur Mistral AI',
                response.status
            );
        }

        const result = await response.json();
        let improved = result.choices?.[0]?.message?.content?.trim();

        if (!improved) {
            return errorResponse('Réponse vide de Mistral AI', 500);
        }

        // Trim to 500 chars to match note maxLength
        improved = improved.slice(0, 500);

        return successResponse({ improvedText: improved });
    } catch (error) {
        console.error('Mistral note-improve request failed:', error);
        return errorResponse('Erreur de connexion à Mistral AI', 500);
    }
});
