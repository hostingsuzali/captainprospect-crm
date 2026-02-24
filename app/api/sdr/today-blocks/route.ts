import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non autorisé' },
                { status: 401 }
            );
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const blocks = await prisma.scheduleBlock.findMany({
            where: {
                sdrId: session.user.id,
                date: { gte: today, lt: tomorrow },
                status: { not: 'CANCELLED' },
                OR: [
                    { suggestionStatus: null },
                    { suggestionStatus: 'CONFIRMED' },
                ],
            },
            include: {
                mission: {
                    select: {
                        id: true,
                        name: true,
                        channel: true,
                        client: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: [{ startTime: 'asc' }],
        });

        // Also fetch this week's blocks for context
        const weekStart = new Date(today);
        const dow = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 5);

        const weekBlocks = await prisma.scheduleBlock.findMany({
            where: {
                sdrId: session.user.id,
                date: { gte: weekStart, lt: weekEnd },
                status: { not: 'CANCELLED' },
                OR: [
                    { suggestionStatus: null },
                    { suggestionStatus: 'CONFIRMED' },
                ],
            },
            select: {
                id: true,
                date: true,
                startTime: true,
                endTime: true,
                mission: {
                    select: { id: true, name: true, channel: true },
                },
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        });

        const todayMissionIds = [...new Set(blocks.map((b) => b.mission.id))];

        return NextResponse.json({
            success: true,
            data: {
                todayBlocks: blocks,
                todayMissionIds,
                weekBlocks,
                hasBlocksToday: blocks.length > 0,
            },
        });
    } catch (error) {
        console.error('Error fetching today blocks:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
