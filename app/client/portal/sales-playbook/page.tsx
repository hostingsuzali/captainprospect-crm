"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Target, FileText, Info, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui";

type MissionItem = {
    id: string;
    name: string;
    objective?: string | null;
    campaigns: Array<{ id: string; name: string; isActive: boolean }>;
};

type CampaignData = {
    id: string;
    name: string;
    icp: string;
    pitch: string;
    script?: string | null;
};

type CompanionData = {
    additionalShared?: string;
};

type ScriptSections = {
    intro?: string;
    discovery?: string;
    objection?: string;
    closing?: string;
};

function parseBaseScript(script: string | null | undefined): ScriptSections {
    if (!script) return {};
    try {
        const parsed = JSON.parse(script) as ScriptSections;
        if (parsed && typeof parsed === "object") return parsed;
    } catch {
        return { intro: script };
    }
    return {};
}

export default function ClientSalesPlaybookPage() {
    const { error: showError } = useToast();
    const [missions, setMissions] = useState<MissionItem[]>([]);
    const [selectedMissionId, setSelectedMissionId] = useState("");
    const [campaign, setCampaign] = useState<CampaignData | null>(null);
    const [additionalShared, setAdditionalShared] = useState("");
    const [loadingMissions, setLoadingMissions] = useState(true);
    const [loadingCampaign, setLoadingCampaign] = useState(false);

    useEffect(() => {
        (async () => {
            setLoadingMissions(true);
            try {
                const res = await fetch("/api/missions?isActive=true&limit=200");
                const json = await res.json();
                if (!json.success) throw new Error(json.error || "Impossible de charger les missions");
                const items = (json.data ?? []) as MissionItem[];
                setMissions(items);
                if (items.length > 0) {
                    setSelectedMissionId(items[0].id);
                }
            } catch (err) {
                showError("Erreur", err instanceof Error ? err.message : "Impossible de charger les missions");
            } finally {
                setLoadingMissions(false);
            }
        })();
    }, [showError]);

    const selectedMission = useMemo(
        () => missions.find((m) => m.id === selectedMissionId) ?? null,
        [missions, selectedMissionId]
    );

    useEffect(() => {
        if (!selectedMission) {
            setCampaign(null);
            setAdditionalShared("");
            return;
        }
        const activeCampaign = selectedMission.campaigns.find((c) => c.isActive) ?? selectedMission.campaigns[0];
        if (!activeCampaign) {
            setCampaign(null);
            setAdditionalShared("");
            return;
        }

        (async () => {
            setLoadingCampaign(true);
            try {
                const [campaignRes, companionRes] = await Promise.all([
                    fetch(`/api/campaigns/${activeCampaign.id}`),
                    fetch(`/api/campaigns/${activeCampaign.id}/script-companion`),
                ]);
                const campaignJson = await campaignRes.json();
                if (!campaignJson.success) throw new Error(campaignJson.error || "Impossible de charger la campagne");
                setCampaign(campaignJson.data as CampaignData);

                const companionJson = await companionRes.json();
                if (companionJson.success) {
                    const data = companionJson.data as CompanionData;
                    setAdditionalShared(data.additionalShared || "");
                } else {
                    setAdditionalShared("");
                }
            } catch (err) {
                setCampaign(null);
                setAdditionalShared("");
                showError("Erreur", err instanceof Error ? err.message : "Impossible de charger le playbook");
            } finally {
                setLoadingCampaign(false);
            }
        })();
    }, [selectedMission, showError]);

    const baseScriptSections = useMemo(() => parseBaseScript(campaign?.script), [campaign?.script]);
    const scriptEntries = [
        { key: "intro", label: "Introduction", value: baseScriptSections.intro || "" },
        { key: "discovery", label: "Découverte", value: baseScriptSections.discovery || "" },
        { key: "objection", label: "Objections", value: baseScriptSections.objection || "" },
        { key: "closing", label: "Closing", value: baseScriptSections.closing || "" },
    ].filter((entry) => Boolean(entry.value));

    return (
        <div className="min-h-full bg-[#F3F4F8] p-4 md:p-6 space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                        <BookOpen className="w-4 h-4" />
                    </span>
                    Sales Playbook
                </h1>
                <p className="text-sm text-slate-500 mt-1">ICP, cible, informations et scripts de vos missions.</p>
            </div>

            {loadingMissions ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
            ) : missions.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-200 rounded-2xl py-14 px-6 text-center">
                    <p className="text-sm font-medium text-slate-900">Aucune mission active</p>
                    <p className="mt-1 text-xs text-slate-500">Le playbook apparaîtra ici dès qu'une mission sera active.</p>
                </div>
            ) : (
                <>
                    <div className="max-w-md">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Mission</label>
                        <div className="relative">
                            <select
                                value={selectedMissionId}
                                onChange={(e) => setSelectedMissionId(e.target.value)}
                                className="w-full h-10 px-3 pr-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {missions.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    {loadingCampaign ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        </div>
                    ) : !campaign ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-500">
                            Aucune campagne trouvée pour cette mission.
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            <section className="bg-white border border-slate-200 rounded-2xl p-5">
                                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-emerald-600" />
                                    Cible (ICP)
                                </h2>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap mt-3">{campaign.icp || "Non renseigné"}</p>
                            </section>

                            <section className="bg-white border border-slate-200 rounded-2xl p-5">
                                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                    <Info className="w-4 h-4 text-blue-600" />
                                    Infos mission & message
                                </h2>
                                <div className="mt-3 space-y-2 text-sm text-slate-700">
                                    <p><span className="font-medium">Mission:</span> {selectedMission?.name}</p>
                                    <p><span className="font-medium">Objectif:</span> {selectedMission?.objective || "Non renseigné"}</p>
                                    <p><span className="font-medium">Campagne:</span> {campaign.name}</p>
                                    <p className="whitespace-pre-wrap"><span className="font-medium">Pitch:</span> {campaign.pitch || "Non renseigné"}</p>
                                </div>
                            </section>

                            <section className="bg-white border border-slate-200 rounded-2xl p-5">
                                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-600" />
                                    Script
                                </h2>
                                <div className="mt-3 space-y-4">
                                    {scriptEntries.length > 0 ? (
                                        scriptEntries.map((entry) => (
                                            <div key={entry.key} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">{entry.label}</p>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{entry.value}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-500">Aucun script de base défini.</p>
                                    )}

                                    {additionalShared && (
                                        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                                            <p className="text-xs uppercase tracking-wide text-violet-700 font-semibold mb-1">Script additionel partagé</p>
                                            <p className="text-sm text-violet-900 whitespace-pre-wrap">{additionalShared}</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
