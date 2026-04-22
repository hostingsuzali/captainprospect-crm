"use client";

import { Info, MessageSquare } from "lucide-react";
import { CommsInbox } from "@/components/comms/CommsInbox";
import type { ClientShellData } from "../ClientDetailShell";

export function CommsTab({ client }: { client: ClientShellData }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-600" />
                    Communications
                </h2>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                    L&apos;inbox affichée ci-dessous n&apos;est pas filtrée sur ce client.
                    Le filtrage par client sera ajouté dans une prochaine itération côté <code>CommsInbox</code>.
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <CommsInbox />
            </div>
        </div>
    );
}

export default CommsTab;
