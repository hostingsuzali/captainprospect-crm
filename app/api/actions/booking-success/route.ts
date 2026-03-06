// ============================================
// BOOKING SUCCESS API
// Handles successful booking events from Calendly, etc.
// Meeting formats: VISIO (meetingJoinUrl), PHYSIQUE (meetingAddress), TELEPHONIQUE (meetingPhone/contact fallback).
// Regression: (1) Book with each format from UnifiedActionDrawer (2) Confirm CTAs in SDR, client portal, manager client (3) Cancel/reschedule/feedback unchanged.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { createClientPortalNotification, sendNewRdvEmailNotification } from '@/lib/notifications';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const bookingSuccessSchema = z.object({
    contactId: z.string().min(1, 'Contact ID required'),
    eventData: z.record(z.string(), z.any()).optional(),
    rdvDate: z.string().optional(),
    meetingType: z.enum(['VISIO', 'PHYSIQUE', 'TELEPHONIQUE']).optional(),
    meetingCategory: z.enum(['EXPLORATOIRE', 'BESOIN']).optional(),
    meetingAddress: z.string().max(500).optional(),
    meetingJoinUrl: z.string().url('Lien de rejoindre invalide').max(2000).optional(),
    meetingPhone: z.string().max(50).optional(),
}).refine(
    (data) => {
        if (!data.meetingType) return true;
        if (data.meetingType === 'PHYSIQUE') return !!data.meetingAddress?.trim();
        return true;
    },
    { message: 'PHYSIQUE requiert une adresse.', path: ['meetingType'] }
);

function normalizeUrlCandidate(value: string | null | undefined): string | null {
    const raw = value?.trim();
    if (!raw) return null;

    try {
        const url = new URL(raw);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        return url.toString();
    } catch {
        return null;
    }
}

function isLikelyJoinLink(value: string): boolean {
    const candidate = normalizeUrlCandidate(value);
    if (!candidate) return false;

    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    const full = candidate.toLowerCase();

    if (host.includes('calendly.com') || host.endsWith('.cal.com') || host === 'cal.com') {
        return false;
    }

    return /(zoom|meet|teams|webex|whereby|jitsi|hangout|video|conference|join)/i.test(full);
}

function collectNestedUrls(input: unknown, seen = new Set<unknown>(), depth = 0): string[] {
    if (input == null || depth > 6 || seen.has(input)) return [];
    if (typeof input === 'string') {
        return isLikelyJoinLink(input) ? [input] : [];
    }

    if (typeof input !== 'object') return [];
    seen.add(input);

    if (Array.isArray(input)) {
        return input.flatMap((item) => collectNestedUrls(item, seen, depth + 1));
    }

    return Object.entries(input as Record<string, unknown>).flatMap(([key, value]) => {
        const matchesKey = /(join|meeting|conference|meet|zoom|teams|webex|whereby|jitsi|hangout|video|url|location)/i.test(key);
        if (typeof value === 'string' && matchesKey && isLikelyJoinLink(value)) {
            return [value];
        }
        return collectNestedUrls(value, seen, depth + 1);
    });
}

function extractScheduledStartTime(eventData: Record<string, unknown> | undefined): Date | null {
    if (!eventData) return null;
    const candidates = [
        eventData.invitee_start_time,
        eventData.start_time,
        eventData.startTime,
        eventData.scheduled_start,
        eventData.start,
        (eventData.payload as Record<string, unknown> | undefined)?.invitee_start_time,
        (eventData.payload as Record<string, unknown> | undefined)?.start_time,
        (eventData.event as Record<string, unknown> | undefined)?.start_time,
        (eventData.event as Record<string, unknown> | undefined)?.startTime,
    ];
    for (const c of candidates) {
        if (typeof c === 'string') {
            const d = new Date(c);
            if (!Number.isNaN(d.getTime())) return d;
        }
        if (c instanceof Date && !Number.isNaN(c.getTime())) return c;
    }
    return null;
}

function extractMeetingJoinUrl(eventData: Record<string, unknown> | undefined): string | null {
    if (!eventData) return null;

    const directCandidates = [
        eventData.join_url,
        eventData.joinUrl,
        eventData.meetingJoinUrl,
        eventData.meeting_join_url,
        eventData.meetingUrl,
        eventData.meeting_url,
        eventData.videoCallUrl,
        eventData.hangoutLink,
        eventData.location,
        (eventData.location as Record<string, unknown> | undefined)?.join_url,
        (eventData.location as Record<string, unknown> | undefined)?.joinUrl,
        (eventData.conferenceData as Record<string, unknown> | undefined)?.conferenceSolution,
        ((eventData.conferenceData as Record<string, unknown> | undefined)?.entryPoints as Array<Record<string, unknown>> | undefined)?.[0]?.uri,
        (eventData.event as Record<string, unknown> | undefined)?.location,
        ((eventData.event as Record<string, unknown> | undefined)?.location as Record<string, unknown> | undefined)?.join_url,
        ((eventData.event as Record<string, unknown> | undefined)?.location as Record<string, unknown> | undefined)?.joinUrl,
    ];

    for (const candidate of directCandidates) {
        if (typeof candidate === 'string' && isLikelyJoinLink(candidate)) {
            return normalizeUrlCandidate(candidate);
        }
    }

    const nestedCandidate = collectNestedUrls(eventData)[0];
    return normalizeUrlCandidate(nestedCandidate);
}

// ============================================
// POST /api/actions/booking-success
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['SDR', 'BUSINESS_DEVELOPER'], request);
    const { contactId, eventData, rdvDate, meetingType, meetingCategory, meetingAddress, meetingJoinUrl, meetingPhone } = await validateRequest(request, bookingSuccessSchema);

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

    // Parse rdvDate into a Date object (used as callbackDate = scheduled meeting date)
    // Prefer SDR-selected rdvDate; fallback to calendar payload start time so RDV shows scheduled date, not call date
    const scheduledAt = rdvDate
        ? new Date(rdvDate)
        : extractScheduledStartTime(eventData);

    const resolvedMeetingJoinUrl =
        meetingType === 'VISIO'
            ? normalizeUrlCandidate(meetingJoinUrl) ?? extractMeetingJoinUrl(eventData)
            : null;

    // Create action with MEETING_BOOKED result and optional meeting format metadata
    const action = await prisma.action.create({
        data: {
            contactId: contact.id,
            sdrId: session.user.id,
            campaignId: campaign.id,
            channel: contact.company.list.mission.channel,
            result: 'MEETING_BOOKED',
            note: bookingNote,
            callbackDate: scheduledAt ?? undefined,
            meetingType: meetingType ?? null,
            meetingCategory: meetingCategory ?? null,
            meetingAddress: meetingAddress ?? null,
            meetingJoinUrl: resolvedMeetingJoinUrl,
            meetingPhone: meetingPhone ?? null,
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

    const clientId = contact.company.list.mission.clientId;
    if (clientId) {
        await createClientPortalNotification(clientId, {
            title: 'Nouveau RDV réservé',
            message: 'Un nouveau rendez-vous a été réservé pour une de vos missions.',
            type: 'success',
            link: '/client/portal/meetings',
        });

        void sendNewRdvEmailNotification(clientId, {
            contactFirstName: contact.firstName,
            contactLastName: contact.lastName,
            companyName: contact.company?.name ?? undefined,
            missionName: contact.company.list.mission.name,
            scheduledAt: scheduledAt ?? undefined,
            meetingType: meetingType ?? undefined,
            meetingJoinUrl: resolvedMeetingJoinUrl ?? undefined,
            meetingAddress: meetingAddress ?? undefined,
            meetingPhone: meetingPhone ?? undefined,
        });
    }

    return NextResponse.json({
        success: true,
        data: {
            actionId: action.id,
            message: `Rendez-vous enregistré pour ${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        },
    });
});
