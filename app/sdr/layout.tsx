"use client";

import { AppLayoutShell } from "@/components/layout/AppLayoutShell";
import { SDR_NAV } from "@/lib/navigation/config";

export default function SDRLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppLayoutShell
            allowedRoles={["SDR", "BUSINESS_DEVELOPER"]}
            customNavigation={SDR_NAV}
        >
            {children}
        </AppLayoutShell>
    );
}
