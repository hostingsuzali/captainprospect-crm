import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
    NotFoundError,
    ValidationError,
} from '@/lib/api-utils';
import bcrypt from 'bcryptjs';

function generatePassword(length = 12): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// ============================================
// POST /api/clients/[id]/interlocuteurs/[iid]/activate-portal
// Create a COMMERCIAL user account for an interlocuteur
// ============================================

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; iid: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id: clientId, iid: interlocuteurId } = await params;

    const interlocuteur = await prisma.clientInterlocuteur.findUnique({
        where: { id: interlocuteurId },
        include: { portalUser: { select: { id: true, email: true, name: true } } },
    });

    if (!interlocuteur || interlocuteur.clientId !== clientId) {
        throw new NotFoundError('Interlocuteur introuvable');
    }

    // Already has a portal account
    if (interlocuteur.portalUser) {
        return successResponse({
            user: interlocuteur.portalUser,
            alreadyExists: true,
            generatedPassword: null,
        });
    }

    // Pick the primary email or first email
    const emails = Array.isArray(interlocuteur.emails) ? interlocuteur.emails as { value: string; isPrimary: boolean }[] : [];
    const primaryEmail = emails.find((e) => e.isPrimary)?.value ?? emails[0]?.value;

    if (!primaryEmail) {
        throw new ValidationError("L'interlocuteur n'a pas d'email configuré");
    }

    // Check if email is already taken
    const existingUser = await prisma.user.findUnique({ where: { email: primaryEmail } });
    if (existingUser) {
        throw new ValidationError(`L'email ${primaryEmail} est déjà utilisé par un autre compte`);
    }

    const generatedPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(generatedPassword, 12);

    const user = await prisma.user.create({
        data: {
            email: primaryEmail,
            password: hashedPassword,
            name: `${interlocuteur.firstName} ${interlocuteur.lastName}`,
            role: 'COMMERCIAL',
            isActive: true,
            interlocuteurId: interlocuteur.id,
            clientId: clientId,
        },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
        },
    });

    return successResponse({
        user,
        alreadyExists: false,
        generatedPassword,
    }, 201);
});

// ============================================
// DELETE /api/clients/[id]/interlocuteurs/[iid]/activate-portal
// Remove COMMERCIAL portal access for an interlocuteur
// ============================================

export const DELETE = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; iid: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id: clientId, iid: interlocuteurId } = await params;

    const interlocuteur = await prisma.clientInterlocuteur.findUnique({
        where: { id: interlocuteurId },
        include: { portalUser: { select: { id: true } } },
    });

    if (!interlocuteur || interlocuteur.clientId !== clientId) {
        throw new NotFoundError('Interlocuteur introuvable');
    }

    if (!interlocuteur.portalUser) {
        throw new NotFoundError('Aucun compte portail trouvé');
    }

    await prisma.user.delete({ where: { id: interlocuteur.portalUser.id } });

    return successResponse({ deleted: true });
});
