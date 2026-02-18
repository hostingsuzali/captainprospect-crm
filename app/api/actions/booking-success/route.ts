// ============================================
// BOOKING SUCCESS API
// Handles successful booking events from Calendly, etc.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const bookingSuccessSchema = z.object({
    contactId: z.string().min(1, 'Contact ID required'),
    eventData: z.record(z.string(), z.any()).optional(),
});

// ============================================
// POST /api/actions/booking-success
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['SDR', 'BUSINESS_DEVELOPER'], request);
    const { contactId, eventData } = await validateRequest(request, bookingSuccessSchema);

    // Get contact with campaign info
    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
            company: {
                include: {
                    list: {
                        include: {
                            mission: {
                                include: {
                                    campaigns: {
                                        where: { isActive: true },
                                        take: 1,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!contact) {
        return NextResponse.json(
            { success: false, error: 'Contact not found' },
            { status: 404 }
        );
    }

    const campaign = contact.company.list.mission.campaigns[0];
    if (!campaign) {
        return NextResponse.json(
            { success: false, error: 'No active campaign found for this contact' },
            { status: 400 }
        );
    }

    // Extract booking details from event data
    const bookingNote = eventData
        ? `RDV planifié via calendrier: ${JSON.stringify(eventData)}`
        : 'RDV planifié via calendrier';

    // Create action with MEETING_BOOKED result
    const action = await prisma.action.create({
        data: {
            contactId: contact.id,
            sdrId: session.user.id,
            campaignId: campaign.id,
            channel: contact.company.list.mission.channel,
            result: 'MEETING_BOOKED',
            note: bookingNote,
        },
        include: {
            contact: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                },
            },
        },
    });

    return NextResponse.json({
        success: true,
        data: {
            actionId: action.id,
            message: `Rendez-vous enregistré pour ${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        },
    });
});
