import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    requireRole,
    withErrorHandler,
    AuthError,
    getPaginationParams,
} from "@/lib/api-utils";

// ============================================
// GET /api/client/sent-emails - List emails sent from client's mailbox (CLIENT only)
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);

    // Get client's mailbox
    const mailbox = await prisma.mailbox.findFirst({
        where: {
            ownerId: session.user.id,
            isActive: true,
        },
    });

    if (!mailbox) {
        return successResponse({
            emails: [],
            pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false },
        });
    }

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams);

    const [emails, total] = await Promise.all([
        prisma.email.findMany({
            where: {
                mailboxId: mailbox.id,
                direction: "OUTBOUND",
                status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
            },
            select: {
                id: true,
                subject: true,
                toAddresses: true,
                sentAt: true,
                openCount: true,
                firstOpenedAt: true,
                status: true,
            },
            orderBy: { sentAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.email.count({
            where: {
                mailboxId: mailbox.id,
                direction: "OUTBOUND",
                status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
            },
        }),
    ]);

    // Map to display format with status derived from tracking
    const formattedEmails = emails.map((e) => {
        let statusLabel = "Envoyé";
        if (e.status === "REPLIED") statusLabel = "Répondu";
        else if (e.openCount > 0 || e.firstOpenedAt) statusLabel = "Ouvert";

        return {
            id: e.id,
            recipient: e.toAddresses[0] || "",
            subject: e.subject,
            date: e.sentAt,
            status: statusLabel,
        };
    });

    return successResponse({
        emails: formattedEmails,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
        },
    });
});
