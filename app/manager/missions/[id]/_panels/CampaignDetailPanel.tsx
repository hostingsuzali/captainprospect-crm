"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ExternalLink, Save, Wand2 } from "lucide-react";
import { Button, Badge, Skeleton, Tabs, Input, useToast } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";

interface Campaign {
    id: string;
    name: string;
    isActive: boolean;
    icp?: string | null;
    pitch?: string | null;
    script?:
        | string
        | { intro?: string; discovery?: string; objection?: string; closing?: string }
        | null;
    mission?: { id: string; name: string };
}

export function CampaignDetailPanel({ campaignId, missionId }: { campaignId: string; missionId: string }) {
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();
    const [innerTab, setInnerTab] = useState<"details" | "script" | "actions" | "comms">("details");

    const query = useQuery({
        queryKey: qk.missionCampaign(missionId, campaignId),
        queryFn: async () => {
            const res = await fetch(`/api/campaigns/${campaignId}`);
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json.data as Campaign;
        },
        enabled: !!campaignId,
    });

    const campaign = query.data;

    const [name, setName] = useState("");
    const [icp, setIcp] = useState("");
    const [pitch, setPitch] = useState("");
    const [intro, setIntro] = useState("");
    const [discovery, setDiscovery] = useState("");
    const [objection, setObjection] = useState("");
    const [closing, setClosing] = useState("");

    useEffect(() => {
        if (!campaign) return;
        setName(campaign.name);
        setIcp(campaign.icp ?? "");
        setPitch(campaign.pitch ?? "");
        const script = campaign.script;
        if (script && typeof script === "object" && !Array.isArray(script)) {
            setIntro(script.intro ?? "");
            setDiscovery(script.discovery ?? "");
            setObjection(script.objection ?? "");
            setClosing(script.closing ?? "");
        } else if (typeof script === "string") {
            setIntro(script);
            setDiscovery("");
            setObjection("");
            setClosing("");
        }
    }, [campaign]);

    const save = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/campaigns/${campaignId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    icp,
                    pitch,
                    script: { intro, discovery, objection, closing },
                }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            success("Campagne enregistrée");
            queryClient.invalidateQueries({ queryKey: qk.missionCampaign(missionId, campaignId) });
            queryClient.invalidateQueries({ queryKey: qk.missionCampaigns(missionId) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    if (query.isLoading) {
        return (
            <div className="p-5 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    if (query.error || !campaign) {
        return (
            <div className="p-5">
                <ErrorCard message="Impossible de charger la campagne" onRetry={() => query.refetch()} />
            </div>
        );
    }

    return (
        <div className="p-5 space-y-4">
            <div>
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-slate-900">{campaign.name}</h3>
                    <IdChip id={campaign.id} />
                    <Badge variant={campaign.isActive ? "success" : "outline"}>
                        {campaign.isActive ? "Active" : "Inactive"}
                    </Badge>
                </div>
                <Link
                    href={`/manager/campaigns/${campaign.id}`}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1"
                >
                    Ouvrir la campagne <ExternalLink className="w-3 h-3" />
                </Link>
            </div>

            <Tabs
                tabs={[
                    { id: "details", label: "Détails" },
                    { id: "script", label: "Script" },
                    { id: "actions", label: "Actions" },
                    { id: "comms", label: "Comms" },
                ]}
                activeTab={innerTab}
                onTabChange={(id) => setInnerTab(id as typeof innerTab)}
                variant="pills"
            />

            {innerTab === "details" && (
                <div className="space-y-3">
                    <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1.5 block">ICP</label>
                        <textarea
                            value={icp}
                            onChange={(e) => setIcp(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1.5 block">Pitch</label>
                        <textarea
                            value={pitch}
                            onChange={(e) => setPitch(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        />
                    </div>
                </div>
            )}

            {innerTab === "script" && (
                <div className="space-y-3">
                    <ScriptSection label="Intro" value={intro} onChange={setIntro} />
                    <ScriptSection label="Découverte" value={discovery} onChange={setDiscovery} />
                    <ScriptSection label="Objections" value={objection} onChange={setObjection} />
                    <ScriptSection label="Closing" value={closing} onChange={setClosing} />
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Wand2 className="w-3 h-3" />
                        La génération IA du script se fait depuis la page campagne.
                    </p>
                </div>
            )}

            {innerTab === "actions" && (
                <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
                    Les actions détaillées s&apos;affichent depuis l&apos;onglet <strong>Actions</strong> de la mission.
                </div>
            )}

            {innerTab === "comms" && (
                <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
                    Les communications filtrées par campagne arrivent dans une prochaine itération.
                </div>
            )}

            <div className="sticky bottom-0 bg-white pt-3 border-t border-slate-200 flex justify-end">
                <Button variant="primary" onClick={() => save.mutate()} isLoading={save.isPending}>
                    <Save className="w-4 h-4 mr-1" />
                    Enregistrer
                </Button>
            </div>
        </div>
    );
}

function ScriptSection({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">{label}</label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
        </div>
    );
}

export default CampaignDetailPanel;
