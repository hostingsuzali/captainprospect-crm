import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { processTemplate } from '@/lib/email/services/template-variables';

// POST /api/email/quick-send - Send email using template with variable substitution
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
        }

        const body = await req.json();
        const {
            mailboxId,
            templateId,
            to,
            contactId,
            companyId,
            missionId,
            customSubject,
            customBodyHtml,
            customData
        } = body;

        // Validate required fields
        if (!mailboxId) {
            return NextResponse.json(
                { success: false, error: 'mailboxId requis' },
                { status: 400 }
            );
        }

        if (!to || !Array.isArray(to) || to.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Destinataire requis' },
                { status: 400 }
            );
        }

        // Check mailbox ownership
        const mailbox = await prisma.mailbox.findFirst({
            where: {
                id: mailboxId,
                OR: [
                    { ownerId: session.user.id },
                    { permissions: { some: { userId: session.user.id } } }
                ]
            }
        });

        if (!mailbox) {
            return NextResponse.json(
                { success: false, error: 'Mailbox non trouvé ou non autorisé' },
                { status: 404 }
            );
        }

        let subject: string;
        let bodyHtml: string;
        let bodyText: string | null = null;

        // If using a template, fetch and process it
        if (templateId) {
            const template = await prisma.emailTemplate.findUnique({
                where: { id: templateId }
            });

            if (!template) {
                return NextResponse.json(
                    { success: false, error: 'Template non trouvé' },
                    { status: 404 }
                );
            }

            // Process template with variable substitution
            const processed = await processTemplate(
                customSubject || template.subject,
                customBodyHtml || template.bodyHtml,
                template.bodyText,
                {
                    contactId,
                    companyId,
                    customData
                }
            );

            subject = processed.subject;
            bodyHtml = processed.bodyHtml;
            bodyText = processed.bodyText;

            // Update template usage stats
            await prisma.emailTemplate.update({
                where: { id: templateId },
                data: {
                    useCount: { increment: 1 },
                    lastUsedAt: new Date()
                }
            });
        } else {
            // Custom email without template
            if (!customSubject || !customBodyHtml) {
                return NextResponse.json(
                    { success: false, error: 'Template ou contenu personnalisé requis' },
                    { status: 400 }
                );
            }

            // Still process variables if contact/company provided
            const processed = await processTemplate(
                customSubject,
                customBodyHtml,
                null,
                {
                    contactId,
                    companyId,
                    customData
                }
            );

            subject = processed.subject;
            bodyHtml = processed.bodyHtml;
            bodyText = processed.bodyText;
        }

        // Forward to the existing send email endpoint (JSON to avoid FormData boundary issues in server-side fetch)
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const sendPayload = {
            mailboxId,
            to: to.map((e: { email?: string } | string) => (typeof e === 'string' ? { email: e } : { email: e.email })),
            subject,
            bodyHtml,
            bodyText: bodyText || undefined,
            contactId: contactId || undefined,
            missionId: missionId || undefined,
            sentById: session.user.id,
            templateId: templateId || undefined,
        };
        const sendResponse = await fetch(`${baseUrl}/api/email/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                cookie: req.headers.get('cookie') || ''
            },
            body: JSON.stringify(sendPayload),
        });

        const sendResult = await sendResponse.json();

        if (!sendResult.success) {
            return NextResponse.json(
                { success: false, error: sendResult.error || 'Erreur d\'envoi' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                messageId: sendResult.data?.messageId,
                subject,
                to
            }
        });
    } catch (error) {
        console.error('POST /api/email/quick-send error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
