import { NextRequest } from 'next/server';
import {
    successResponse,
    errorResponse,
    paginatedResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    getPaginationParams,
} from '@/lib/api-utils';
import { actionService } from '@/lib/services/ActionService';
import { statusConfigService } from '@/lib/services/StatusConfigService';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createActionSchema = z.object({
    contactId: z.string().min(1, 'Contact requis').optional(),
    companyId: z.string().min(1, 'Company requis').optional(),
    campaignId: z.string().min(1, 'Campagne requise'),
    channel: z.enum(['CALL', 'EMAIL', 'LINKEDIN']),
    result: z.string().min(1, 'Résultat requis'),
    note: z.string().max(500, 'Note trop longue (max 500 caractères)').optional(),
    callbackDate: z.union([z.string(), z.date()]).optional().transform((s) => (s ? (typeof s === 'string' ? new Date(s) : s) : undefined)),
    duration: z.number().positive().max(7200, 'Durée invalide').optional(),
    meetingType: z.enum(['VISIO', 'PHYSIQUE', 'TELEPHONIQUE']).optional(),
    meetingAddress: z.string().optional(),
}).refine(data => data.contactId || data.companyId, {
    message: 'Contact ou Company requis',
    path: ['contactId'],
});

// ============================================
// MISTRAL NOTE IMPROVEMENT (SERVER-SIDE AUTO-ENHANCE)
// ============================================

async function maybeImproveNoteWithMistral(params: {
    text: string | undefined;
    channel: 'CALL' | 'EMAIL' | 'LINKEDIN';
    resultCode: string;
    resultLabel?: string;
}) {
    const raw = params.text?.trim();
    if (!raw) return undefined;

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) return raw;

    const systemPrompt = `Tu travailles dans CaptainProspect, un CRM de prospection B2B.

Tu améliores des notes internes rédigées par un commercial (SDR / business developer) après un échange (appel, email, LinkedIn) avec un contact ou une entreprise.

Contexte :
- La note décrit ce qui s'est passé pendant l'échange : ce que le prospect a dit, son intérêt, les objections, le niveau de qualification, les prochaines étapes (rappel, démo, envoi d'email, etc.).
- Ce n'est PAS un message envoyé au prospect, mais un compte-rendu interne qui sera relu plus tard par le SDR, son manager ou un collègue.
- Canal de l'action: ${params.channel}
- Résultat CRM (statut sélectionné) : ${params.resultLabel || params.resultCode}

Ta tâche :
- Corriger l'orthographe et la grammaire.
- Reformuler pour que la note soit claire, concise et professionnelle, tout en restant une note interne (pas un email).

Contraintes :
- Réponds UNIQUEMENT par le texte amélioré, sans préambule ni explication.
- Garde exactement le même sens et les mêmes infos (dates, montants, décisions, "rappeler à...", "intéressé par...", etc.).
- Maximum 500 caractères.
- Style : note interne de compte-rendu d'échange, pas un message adressé au prospect.`;

    try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'mistral-large-latest',
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content:
                            `Voici la note brute à améliorer (ne change pas le fond, seulement la forme) :\n\n` +
                            raw,
                    },
                ],
                temperature: 0.3,
                max_tokens: 400,
            }),
        });

        if (!response.ok) {
            // In case of Mistral error, keep original note and don't block the action
            // eslint-disable-next-line no-console
            console.error('Mistral note auto-improve error:', await response.text().catch(() => ''));
            return raw;
        }

        const result = await response.json();
        let improved: string | undefined = result.choices?.[0]?.message?.content?.trim();
        if (!improved) return raw;
        return improved.slice(0, 500);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Mistral note auto-improve request failed:', err);
        return raw;
    }
}

// ============================================
// GET /api/actions - List actions
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['MANAGER', 'SDR', 'BUSINESS_DEVELOPER'], request);
    const { searchParams } = new URL(request.url);
    const { page, limit } = getPaginationParams(searchParams);

    // Build filters
    const filters: any = { page, limit };

    const missionId = searchParams.get('missionId');
    const result = searchParams.get('result');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const contactId = searchParams.get('contactId');
    const companyId = searchParams.get('companyId');
    const voipProvider = searchParams.get('voipProvider');

    if (missionId) filters.missionId = missionId;
    if (voipProvider && ['allo', 'aircall', 'ringover'].includes(voipProvider)) filters.voipProvider = voipProvider;

    // When viewing actions for a specific contact or company (drawer history),
    // show ALL actions from all team members so every role can see notes & history.
    // Only filter by sdrId when listing actions in general (no entity-specific filter).
    const isEntityView = !!(contactId || companyId);

    if (session.user.role === 'SDR' || session.user.role === 'BUSINESS_DEVELOPER') {
        if (!isEntityView) {
            const isTeamLeadForMission = missionId
                ? await actionService.isTeamLeadForMission(session.user.id, missionId)
                : false;
            if (!isTeamLeadForMission) {
                filters.sdrId = session.user.id;
            }
        }
        // When isEntityView (contactId or companyId), no sdrId filter → show all actions
    } else {
        const sdrId = searchParams.get('sdrId');
        if (sdrId) filters.sdrId = sdrId;
    }
    if (result) filters.result = result;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);
    if (contactId) filters.contactId = contactId;
    if (companyId) filters.companyId = companyId;

    // Use service layer
    const { actions, total } = await actionService.getActions(filters);

    return paginatedResponse(actions, total, page, limit);
});

// ============================================
// POST /api/actions - Create new action
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['SDR', 'MANAGER', 'BUSINESS_DEVELOPER'], request);
    const data = await validateRequest(request, createActionSchema);

    // Validate result against effective config
    const allowedCodes = await statusConfigService.getAllowedResultCodes({ campaignId: data.campaignId });
    if (!allowedCodes.includes(data.result)) {
        return errorResponse('Résultat non autorisé pour cette campagne', 400);
    }

    // Validate required note from config
    const config = await statusConfigService.getEffectiveStatusConfig({ campaignId: data.campaignId });
    const statusDef = config.statuses.find((s) => s.code === data.result);
    if (statusDef?.requiresNote && !data.note?.trim()) {
        return errorResponse('Une note est requise pour ce type de résultat', 400);
    }

    // Auto-amélioration de la note (Mistral) côté serveur, en arrière-plan pour l'utilisateur
    const improvedNote = await maybeImproveNoteWithMistral({
        text: data.note,
        channel: data.channel,
        resultCode: data.result,
        resultLabel: statusDef?.label,
    });

    // Use service layer with transaction
    try {
        const action = await actionService.createAction({
            contactId: data.contactId,
            companyId: data.companyId,
            sdrId: session.user.id,
            campaignId: data.campaignId,
            channel: data.channel,
            result: data.result,
            note: improvedNote ?? data.note,
            callbackDate: data.callbackDate,
            duration: data.duration,
            meetingType: data.meetingType,
            meetingAddress: data.meetingAddress,
        }, statusDef);
        return successResponse(action, 201);
    } catch (err) {
        if (err instanceof Error && err.message === 'DUPLICATE_CALLBACK') {
            return errorResponse('Un rappel est déjà en attente pour ce contact/campagne. Traitez-le ou reprogrammez-le avant d\'en créer un nouveau.', 409);
        }
        throw err;
    }
});
