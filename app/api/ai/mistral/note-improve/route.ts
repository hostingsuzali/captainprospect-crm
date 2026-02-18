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
});

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-large-latest';

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireAuth(request);

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        return errorResponse('MISTRAL_API_KEY non configurée', 503);
    }

    const { text } = await validateRequest(request, noteImproveSchema);

    if (!text?.trim()) {
        return errorResponse('Texte requis', 400);
    }

    const systemPrompt = `Tu améliores des notes internes rédigées par un commercial (SDR) après un échange (appel, email, etc.) avec un contact ou une entreprise.

Contexte : la note décrit ce qui s'est passé pendant l'échange — ce que le contact a dit, ce qu'il veut (rappel, démo, etc.), les prochaines étapes. Ce n'est PAS un message envoyé au contact, c'est une note pour l'équipe / pour plus tard.

Ta tâche : corriger l'orthographe et la grammaire, puis reformuler pour que la note soit claire et professionnelle en tant que compte-rendu d'échange (style note interne / compte-rendu).
Contraintes :
- Réponds UNIQUEMENT par le texte amélioré, sans préambule ni explication.
- Garde exactement le même sens et les mêmes infos (dates, noms, décisions, "rappeler à...", "intéressé par...", etc.).
- Maximum 500 caractères.
- Style : note interne sur la conversation, pas un message au contact.`;

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
                    { role: 'user', content: text.trim() },
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
