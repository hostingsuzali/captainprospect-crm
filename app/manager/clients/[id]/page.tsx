import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientDetailShell, type ClientShellData } from "./ClientDetailShell";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect("/login");
    }
    const { id } = await params;

    const client = await prisma.client.findUnique({
        where: { id },
        include: {
            _count: {
                select: {
                    missions: true,
                    users: true,
                    interlocuteurs: true,
                    files: true,
                },
            },
            onboarding: {
                select: {
                    status: true,
                    targetLaunchDate: true,
                    onboardingData: true,
                },
            },
            billingClient: {
                select: { id: true },
            },
        },
    });

    if (!client) {
        notFound();
    }

    const initial: ClientShellData = {
        id: client.id,
        name: client.name,
        industry: client.industry,
        email: client.email,
        phone: client.phone,
        bookingUrl: client.bookingUrl,
        portalShowCallHistory: client.portalShowCallHistory,
        portalShowDatabase: client.portalShowDatabase,
        rdvEmailNotificationsEnabled: client.rdvEmailNotificationsEnabled,
        defaultMailboxId: client.defaultMailboxId,
        salesPlaybook: client.salesPlaybook,
        createdAt: client.createdAt.toISOString(),
        billingClientId: client.billingClient?.id ?? null,
        _count: client._count,
        onboarding: client.onboarding
            ? {
                  status: client.onboarding.status,
                  targetLaunchDate: client.onboarding.targetLaunchDate
                      ? client.onboarding.targetLaunchDate.toISOString()
                      : null,
                  onboardingData: client.onboarding.onboardingData,
              }
            : null,
    };

    return <ClientDetailShell clientId={id} initialClient={initial} />;
}
