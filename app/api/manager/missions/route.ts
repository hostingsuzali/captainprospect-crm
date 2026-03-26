import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, successResponse, withErrorHandler } from '@/lib/api-utils';

// ============================================
// GET /api/manager/missions
// Returns simple list of active missions for dropdowns
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(['MANAGER'], request);

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  const missions = await prisma.mission.findMany({
    where: {
      isActive: true,
      ...(clientId && { clientId }),
    },
    select: {
      id: true,
      name: true,
      client: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  // Format with client name for better identification
  const formattedMissions = missions.map((m) => ({
    id: m.id,
    name: `${m.name} (${m.client.name})`,
  }));

  return successResponse(formattedMissions);
});
