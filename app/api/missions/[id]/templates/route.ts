import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/missions/[id]/templates - List templates for a mission
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
        }

        const { id } = await params;

        const missionTemplates = await prisma.missionEmailTemplate.findMany({
            where: { missionId: id },
            include: {
                template: {
                    include: {
                        createdBy: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                }
            },
            orderBy: { order: 'asc' }
        });

        return NextResponse.json({
            success: true,
            data: missionTemplates.map(mt => ({
                id: mt.id,
                order: mt.order,
                createdAt: mt.createdAt,
                template: mt.template
            }))
        });
    } catch (error) {
        console.error('GET /api/missions/[id]/templates error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// POST /api/missions/[id]/templates - Add template to mission
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { templateId, order } = body;

        if (!templateId) {
            return NextResponse.json(
                { success: false, error: 'templateId requis' },
                { status: 400 }
            );
        }

        // Check if mission exists
        const mission = await prisma.mission.findUnique({ where: { id } });
        if (!mission) {
            return NextResponse.json(
                { success: false, error: 'Mission non trouvée' },
                { status: 404 }
            );
        }

        // Check if template exists
        const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
        if (!template) {
            return NextResponse.json(
                { success: false, error: 'Template non trouvé' },
                { status: 404 }
            );
        }

        // Check if already assigned
        const existing = await prisma.missionEmailTemplate.findUnique({
            where: { missionId_templateId: { missionId: id, templateId } }
        });
        if (existing) {
            return NextResponse.json(
                { success: false, error: 'Template déjà assigné à cette mission' },
                { status: 400 }
            );
        }

        // Get max order
        const maxOrder = await prisma.missionEmailTemplate.findFirst({
            where: { missionId: id },
            orderBy: { order: 'desc' },
            select: { order: true }
        });

        const missionTemplate = await prisma.missionEmailTemplate.create({
            data: {
                missionId: id,
                templateId,
                order: order ?? (maxOrder?.order ?? 0) + 1
            },
            include: {
                template: {
                    include: {
                        createdBy: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                id: missionTemplate.id,
                order: missionTemplate.order,
                createdAt: missionTemplate.createdAt,
                template: missionTemplate.template
            }
        }, { status: 201 });
    } catch (error) {
        console.error('POST /api/missions/[id]/templates error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// DELETE /api/missions/[id]/templates?templateId=xxx - Remove template from mission
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const templateId = searchParams.get('templateId');

        if (!templateId) {
            return NextResponse.json(
                { success: false, error: 'templateId requis' },
                { status: 400 }
            );
        }

        const deleted = await prisma.missionEmailTemplate.deleteMany({
            where: {
                missionId: id,
                templateId
            }
        });

        if (deleted.count === 0) {
            return NextResponse.json(
                { success: false, error: 'Assignation non trouvée' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/missions/[id]/templates error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
