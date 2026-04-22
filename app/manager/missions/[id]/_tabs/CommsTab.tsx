"use client";

import { MessageSquare, AlertCircle } from "lucide-react";
import { CommsInbox } from "@/components/comms/CommsInbox";
import type { MissionShellData } from "../MissionDetailShell";

export function CommsTab({ mission }: { mission: MissionShellData }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-600" /> Communications
                </h2>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                    La boîte de réception est affichée sans filtre par mission. Le filtrage par{" "}
                    <code className="font-mono bg-amber-100 px-1 rounded">missionId</code> sera ajouté dans une
                    prochaine itération.
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <CommsInbox />
            </div>
        </div>
    );
}

export default CommsTab;
