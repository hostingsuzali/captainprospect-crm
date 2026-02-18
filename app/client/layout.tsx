"use client";

import { AppLayoutShell } from "@/components/layout/AppLayoutShell";
import { CLIENT_NAV } from "@/lib/navigation/config";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppLayoutShell
            allowedRoles={["CLIENT"]}
            customNavigation={CLIENT_NAV}
        >
            {children}
        </AppLayoutShell>
    );
}
