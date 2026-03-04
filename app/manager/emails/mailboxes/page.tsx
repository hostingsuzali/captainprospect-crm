"use client";

import React from "react";
import { Card } from "@/components/ui/Card";
import { Inbox, ArrowRight } from "lucide-react";

// ============================================
// MAILBOXES PAGE — Placeholder for Phase 5
// /manager/emails/mailboxes
// ============================================

export default function MailboxesPage() {
    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <Card className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                    <Inbox className="w-8 h-8 text-violet-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                    Gestion des boîtes mail
                </h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                    Configurez vos boîtes mail, suivez leur santé, gérez le warmup
                    et les permissions d&apos;envoi.
                </p>
                <a
                    href="/manager/email/mailboxes"
                    className="inline-flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
                >
                    Voir la page actuelle
                    <ArrowRight className="w-4 h-4" />
                </a>
            </Card>
        </div>
    );
}
