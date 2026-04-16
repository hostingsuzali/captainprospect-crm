import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { resolveGatewayDestination } from "@/lib/gateway";
import GatewayClient from "./GatewayClient";

type PageProps = {
    searchParams: Promise<{ next?: string | string[] }>;
};

export default async function GatewayPage({ searchParams }: PageProps) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.role) {
        redirect("/login?callbackUrl=/gateway");
    }

    const sp = await searchParams;
    const role = session.user.role as UserRole;
    const destination = resolveGatewayDestination(sp.next, role);

    return (
        <GatewayClient
            role={role}
            firstName={session.user.name || "vous"}
            destination={destination}
        />
    );
}
