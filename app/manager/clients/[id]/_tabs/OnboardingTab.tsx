"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Rocket, Save } from "lucide-react";
import { Button, Input, Badge, useToast } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import type { ClientShellData } from "../ClientDetailShell";

type OnboardingData = Record<string, unknown> | null;

export function OnboardingTab({ client }: { client: ClientShellData }) {
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();
    const existing = (client.onboarding?.onboardingData as OnboardingData) ?? null;
    const [icp, setIcp] = useState<string>(typeof existing?.icp === "string" ? (existing.icp as string) : "");
    const [notes, setNotes] = useState<string>(typeof existing?.notes === "string" ? (existing.notes as string) : "");
    const [status, setStatus] = useState<string>(client.onboarding?.status ?? "PENDING");
    const [targetDate, setTargetDate] = useState<string>(
        client.onboarding?.targetLaunchDate
            ? new Date(client.onboarding.targetLaunchDate).toISOString().slice(0, 10)
            : ""
    );

    useEffect(() => {
        const d = (client.onboarding?.onboardingData as OnboardingData) ?? null;
        setIcp(typeof d?.icp === "string" ? (d.icp as string) : "");
        setNotes(typeof d?.notes === "string" ? (d.notes as string) : "");
        setStatus(client.onboarding?.status ?? "PENDING");
        setTargetDate(
            client.onboarding?.targetLaunchDate
                ? new Date(client.onboarding.targetLaunchDate).toISOString().slice(0, 10)
                : ""
        );
    }, [client.onboarding]);

    const save = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/clients/${client.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    icp,
                }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            success("Onboarding mis à jour");
            queryClient.invalidateQueries({ queryKey: qk.client(client.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-indigo-600" />
                    Onboarding
                </h2>
                <Badge variant={status === "COMPLETED" ? "success" : status === "IN_PROGRESS" ? "primary" : "outline"}>
                    {status}
                </Badge>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">ICP / Persona</label>
                    <textarea
                        value={icp}
                        onChange={(e) => setIcp(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        placeholder="Décrivez votre ICP / persona cible..."
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes d&apos;onboarding</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        placeholder="Décisions clés, contraintes, objectifs..."
                    />
                </div>

                <Input
                    label="Date de lancement cible"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                />

                <div className="flex justify-end">
                    <Button variant="primary" onClick={() => save.mutate()} isLoading={save.isPending}>
                        <Save className="w-4 h-4 mr-1" />
                        Enregistrer
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default OnboardingTab;
