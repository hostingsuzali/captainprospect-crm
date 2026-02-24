import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, requireRole, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { recomputeConflicts, recalcEffectiveCapacity } from '@/lib/planning/conflictEngine';
import { z } from 'zod';

const createSchema = z.object({
    sdrId: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    type: z.enum(['VACATION', 'SICK', 'TRAINING', 'PUBLIC_HOLIDAY', 'PARTIAL']),
    impactsPlanning: z.boolean().default(true),
    note: z.string().optional(),
});

// Derive all YYYY-MM months that an absence spans
function absenceMonths(startDate: string, endDate: string): string[] {
    const months: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
        months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
        cur.setMonth(cur.getMonth() + 1);
    }
    return months;
}

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const { searchParams } = new URL(request.url);
    const sdrId = searchParams.get('sdrId');
    const month = searchParams.get('month');

    const where: Record<string, unknown> = {};
    if (sdrId) where.sdrId = sdrId;
    if (month) {
        const [y, m] = month.split('-').map(Number);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0);
        where.startDate = { lte: end };
        where.endDate = { gte: start };
    }

    const absences = await prisma.sdrAbsence.findMany({
        where,
        include: {
            sdr: { select: { id: true, name: true } },
        },
        orderBy: { startDate: 'asc' },
    });

    return successResponse(absences);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const data = await validateRequest(request, createSchema);

    const absence = await prisma.sdrAbsence.create({
        data: {
            sdrId: data.sdrId,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            type: data.type,
            impactsPlanning: data.impactsPlanning,
            note: data.note,
        },
        include: { sdr: { select: { id: true, name: true } } },
    });

    // Recalculate capacity and conflicts for all affected months
    const months = absenceMonths(data.startDate, data.endDate);
    for (const month of months) {
        if (data.impactsPlanning) {
            await recalcEffectiveCapacity(data.sdrId, month);
        }
        await recomputeConflicts({ sdrId: data.sdrId, month });
    }

    return successResponse(absence, 201);
});
