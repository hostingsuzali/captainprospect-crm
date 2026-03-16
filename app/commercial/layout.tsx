"use client";

import { AppLayoutShell } from "@/components/layout/AppLayoutShell";
import { COMMERCIAL_NAV } from "@/lib/navigation/config";

export default function CommercialLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppLayoutShell
            allowedRoles={["COMMERCIAL"]}
            customNavigation={COMMERCIAL_NAV}
        >
            {children}
        </AppLayoutShell>
    );
}
