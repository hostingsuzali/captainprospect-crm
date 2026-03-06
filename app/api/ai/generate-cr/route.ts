import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
  validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

// ============================================
// POST /api/ai/generate-cr
// Generates a Compte Rendu (CR) + summary email from a Leexi transcript.
// Uses Mistral large model.
// Body: { prompt: string }
// Returns: { success: true, data: { text: string } }
// ============================================

const schema = z.object({
  prompt: z.string().min(10, 'Prompt requis'),
});

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-large-latest';

export const POST = withErrorHandler(async (request: NextRequest) => {
  await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return errorResponse('MISTRAL_API_KEY non configurée', 503);
  }

  const { prompt } = await validateRequest(request, schema);

  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('Mistral generate-cr error:', err);
    return errorResponse(
      err?.error?.message || 'Erreur Mistral AI',
      response.status,
    );
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content?.trim();

  if (!text) {
    return errorResponse('Réponse vide de Mistral AI', 500);
  }

  return successResponse({ text });
});
