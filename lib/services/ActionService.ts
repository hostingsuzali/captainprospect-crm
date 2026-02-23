import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { parseDateFromNote } from '@/lib/utils/parseDateFromNote';
import { createClientPortalNotification } from '@/lib/notifications';
import type { EffectiveStatusDefinition } from './StatusConfigService';

// ============================================
// ACTION SERVICE
// ============================================
// Centralized business logic for actions
// Replaces scattered logic in API routes
// ============================================

export interface CreateActionInput {
    contactId?: string;
    companyId?: string;
    sdrId: string;
    campaignId: string;
    channel: 'CALL' | 'EMAIL' | 'LINKEDIN';
    result: string;
    note?: string;
    /** When result triggers callback: set from calendar UI; if not provided, parsed from note. */
    callbackDate?: Date;
    duration?: number;
}

export interface ActionWithRelations {
    id: string;
    contact: {
        id: string;
        firstName?: string | null;
        lastName?: string | null;
        company: {
            id: string;
            name: string;
        };
    };
    result: string;
    createdAt: Date;
}

export class ActionService {
    // ============================================
    // CREATE ACTION WITH TRANSACTION
    // ============================================
    async createAction(
        input: CreateActionInput,
        statusDef?: EffectiveStatusDefinition | null
    ): Promise<ActionWithRelations> {
        const triggersCallback = statusDef?.triggersCallback ?? (input.result === 'CALLBACK_REQUESTED');
        const triggersOpportunity = statusDef?.triggersOpportunity ?? 
            (input.result === 'MEETING_BOOKED' || input.result === 'INTERESTED');

        // Use transaction to ensure atomicity
        return await prisma.$transaction(async (tx) => {
            // Validate that either contactId or companyId is provided
            if (!input.contactId && !input.companyId) {
                throw new Error('Either contactId or companyId must be provided');
            }

            // Callback date: from calendar (callbackDate) or parsed from note
            let callbackDate: Date | null = null;
            let noteToStore = input.note;
            if (triggersCallback) {
                if (input.callbackDate) {
                    callbackDate = input.callbackDate;
                    // Keep note in sync with calendar so note and callbackDate don't diverge
                    const scheduledText = `Rappel programmé: ${callbackDate.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`;
                    noteToStore = (input.note?.trim() ? `${input.note.trim()} (${scheduledText})` : scheduledText).slice(0, 500);
                } else if (input.note) {
                    callbackDate = parseDateFromNote(input.note);
                }
            }

            // Duplicate prevention: one pending callback per contact/company per campaign.
            // "Pending" = callbackDate null or <= now; we only block when such an action exists.
            if (triggersCallback) {
                const existingPending = await tx.action.findFirst({
                    where: {
                        campaignId: input.campaignId,
                        result: input.result as any,
                        ...(input.contactId ? { contactId: input.contactId } : { companyId: input.companyId! }),
                        OR: [{ callbackDate: null }, { callbackDate: { lte: new Date() } }],
                    },
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, createdAt: true },
                });
                if (existingPending) {
                    // Only block if no newer action supersedes it (same contact/company, later createdAt)
                    const newerAction = await tx.action.findFirst({
                        where: {
                            ...(input.contactId ? { contactId: input.contactId } : { companyId: input.companyId! }),
                            createdAt: { gt: existingPending.createdAt },
                        },
                        select: { id: true },
                    });
                    if (!newerAction) {
                        throw new Error('DUPLICATE_CALLBACK');
                    }
                }
            }

            // 1. Create the action
            const action = await tx.action.create({
                data: {
                    contactId: input.contactId || null,
                    companyId: input.companyId || null,
                    sdrId: input.sdrId,
                    campaignId: input.campaignId,
                    channel: input.channel,
                    result: input.result,
                    note: noteToStore,
                    callbackDate: callbackDate,
                    duration: input.duration,
                },
                include: {
                    contact: input.contactId ? {
                        include: { company: true },
                    } : undefined,
                    company: input.companyId ? true : undefined,
                },
            });

            // 2. Auto-create opportunity for positive outcomes (only for contacts)
            if (input.contactId && triggersOpportunity && input.note?.trim()) {
                const existing = await tx.opportunity.findFirst({
                    where: { contactId: input.contactId },
                });
                if (!existing) {
                    await this.createOpportunityFromAction(tx, action, input.note!);
                }
            }

            // 3. Update contact completeness if enriched (only for contacts)
            if (input.contactId && input.note && input.result === 'BAD_CONTACT') {
                await this.handleBadContact(tx, input.contactId, input.note);
            }

            return action;
        });

        // 4. Notify client portal (outside transaction)
        if (action.result === 'MEETING_BOOKED' || action.result === 'INTERESTED') {
            const campaign = await prisma.campaign.findUnique({
                where: { id: action.campaignId },
                select: { mission: { select: { clientId: true } } },
            });
            const clientId = campaign?.mission?.clientId;
            if (clientId) {
                if (action.result === 'MEETING_BOOKED') {
                    await createClientPortalNotification(clientId, {
                        title: 'Nouveau RDV réservé',
                        message: 'Un nouveau rendez-vous a été réservé pour une de vos missions.',
                        type: 'success',
                        link: '/client/portal/meetings',
                    });
                } else {
                    await createClientPortalNotification(clientId, {
                        title: 'Nouvelle opportunité',
                        message: 'Un nouveau contact qualifié est disponible sur votre tableau de bord.',
                        type: 'info',
                        link: '/client/portal',
                    });
                }
            }
        }
        return action;
    }

    // ============================================
    // OPPORTUNITY CREATION LOGIC
    // ============================================
    private shouldCreateOpportunity(result: string, note?: string): boolean {
        return (result === 'MEETING_BOOKED' || result === 'INTERESTED') && !!note;
    }

    private async createOpportunityFromAction(
        tx: Prisma.TransactionClient,
        action: any,
        note: string
    ): Promise<void> {
        // Check if opportunity already exists
        const existing = await tx.opportunity.findFirst({
            where: { contactId: action.contactId },
        });

        if (existing) return; // Don't create duplicate

        await tx.opportunity.create({
            data: {
                contactId: action.contactId,
                companyId: action.contact.companyId,
                needSummary: note,
                urgency: action.result === 'MEETING_BOOKED' ? 'SHORT' : 'MEDIUM',
            },
        });
    }

    // ============================================
    // BAD CONTACT HANDLING
    // ============================================
    private async handleBadContact(
        tx: Prisma.TransactionClient,
        contactId: string,
        note: string
    ): Promise<void> {
        // If note indicates contact left company, mark as INCOMPLETE
        const leftCompanyKeywords = ['quitté', 'parti', 'left', 'no longer'];
        const shouldMarkIncomplete = leftCompanyKeywords.some(keyword =>
            note.toLowerCase().includes(keyword)
        );

        if (shouldMarkIncomplete) {
            await tx.contact.update({
                where: { id: contactId },
                data: { status: 'INCOMPLETE' },
            });
        }
    }

    // ============================================
    // TEAM LEAD HELPERS
    // ============================================
    async isTeamLeadForMission(userId: string, missionId: string): Promise<boolean> {
        const mission = await prisma.mission.findUnique({
            where: { id: missionId },
            select: { teamLeadSdrId: true },
        });
        return mission?.teamLeadSdrId === userId;
    }

    // ============================================
    // GET ACTIONS WITH FILTERS
    // ============================================
    async getActions(filters: {
        sdrId?: string;
        missionId?: string;
        result?: string;
        from?: Date;
        to?: Date;
        contactId?: string;
        companyId?: string;
        voipProvider?: string;
        page?: number;
        limit?: number;
    }) {
        const { page = 1, limit = 20, ...where } = filters;
        const skip = (page - 1) * limit;

        const whereClause: any = {};

        if (where.sdrId) whereClause.sdrId = where.sdrId;
        if (where.result) whereClause.result = where.result;
        if (where.contactId) whereClause.contactId = where.contactId;
        if (where.companyId) whereClause.companyId = where.companyId;
        if (where.voipProvider) whereClause.voipProvider = where.voipProvider;
        if (where.missionId) {
            whereClause.campaign = { missionId: where.missionId };
        }
        if (where.from || where.to) {
            whereClause.createdAt = {};
            if (where.from) whereClause.createdAt.gte = where.from;
            if (where.to) whereClause.createdAt.lte = where.to;
        }

        const [actions, total] = await Promise.all([
            prisma.action.findMany({
                where: whereClause,
                include: {
                    contact: {
                        include: { company: true },
                    },
                    sdr: {
                        select: { id: true, name: true },
                    },
                    campaign: {
                        select: { id: true, name: true, missionId: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.action.count({ where: whereClause }),
        ]);

        return { actions, total, page, limit };
    }

    // ============================================
    // STATS CALCULATION
    // ============================================
    async getActionStats(filters: {
        sdrId?: string;
        missionId?: string;
        channel?: 'CALL' | 'EMAIL' | 'LINKEDIN';
        from?: Date;
        to?: Date;
    }) {
        const whereClause: any = {};

        if (filters.sdrId) whereClause.sdrId = filters.sdrId;
        if (filters.missionId) {
            whereClause.campaign = { missionId: filters.missionId };
        }
        if (filters.channel) whereClause.channel = filters.channel;
        if (filters.from || filters.to) {
            whereClause.createdAt = {};
            if (filters.from) whereClause.createdAt.gte = filters.from;
            if (filters.to) whereClause.createdAt.lte = filters.to;
        }

        const [total, byResult, avgDuration] = await Promise.all([
            prisma.action.count({ where: whereClause }),
            prisma.action.groupBy({
                by: ['result'],
                where: whereClause,
                _count: true,
            }),
            prisma.action.aggregate({
                where: { ...whereClause, duration: { not: null } },
                _avg: { duration: true },
            }),
        ]);

        const resultBreakdown: Record<string, number> = {};
        byResult.forEach(item => {
            resultBreakdown[item.result] = item._count;
        });

        const conversionRate = total > 0
            ? ((resultBreakdown.MEETING_BOOKED ?? 0) / total * 100).toFixed(2)
            : '0.00';

        const sent = (resultBreakdown.ENVOIE_MAIL ?? 0) + (resultBreakdown.CONNECTION_SENT ?? 0) + (resultBreakdown.MESSAGE_SENT ?? 0);
        const replied = resultBreakdown.REPLIED ?? 0;
        const repliedRate = total > 0 ? ((replied / total) * 100).toFixed(2) : '0.00';

        return {
            total,
            resultBreakdown,
            avgDuration: Math.round(avgDuration._avg.duration || 0),
            conversionRate,
            sent,
            replied,
            repliedRate,
        };
    }
}

/** Get mission stats with optional channel filter. Reusable for Email + LinkedIn + Calls. */
export async function getMissionStats(missionId: string, channel?: 'CALL' | 'EMAIL' | 'LINKEDIN') {
    return actionService.getActionStats({ missionId, channel });
}

// Export singleton instance
export const actionService = new ActionService();
