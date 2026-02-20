"use client";

import { BillingSubNav } from "@/components/billing/BillingSubNav";

export default function BillingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Facturation
                </p>
                <BillingSubNav />
            </div>
            {children}
        </div>
    );
}
