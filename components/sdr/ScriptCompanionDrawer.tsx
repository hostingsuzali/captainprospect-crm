"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Drawer, Tabs, Button, TextSkeleton, useToast } from "@/components/ui";
import {
    sdrScriptCompanionCampaignsKey,
    sdrScriptCompanionDataKey,
} from "@/lib/query-keys";

interface ScriptCompanionDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    missionId?: string;
    missionName?: string;
}

type ScriptTabId = "base" | "additional";

type CampaignSummary = {
    id: string;
    name: string;
};

type CompanionData = {
    campaignId: string;
    campaignName: string;
    baseScript: string;
    additionalDraft: string;
    additionalShared: string;
    sharedUpdatedAt: string | null;
    sharedUpdatedBy: string | null;
};

export function ScriptCompanionDrawer({
    isOpen,
    onClose,
    missionId,
    missionName,
}: ScriptCompanionDrawerProps) {
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();
    const [activeTab, setActiveTab] = useState<ScriptTabId>("base");
    const [additionalDraft, setAdditionalDraft] = useState("");
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const { data: campaigns = [], isFetching: campaignsLoading } = useQuery<CampaignSummary[]>({
        queryKey: sdrScriptCompanionCampaignsKey(isOpen && missionId ? missionId : null),
        queryFn: async () => {
            const res = await fetch(`/api/campaigns?missionId=${missionId}&isActive=true&limit=50`);
            const json = await res.json();
            if (!json.success || !Array.isArray(json.data)) return [];
            return json.data as CampaignSummary[];
        },
        enabled: isOpen && !!missionId,
        staleTime: 60_000,
    });

    const selectedCampaign = campaigns[0] ?? null;

    const {
        data: companionData,
        isFetching: companionLoading,
        refetch: refetchCompanionData,
    } = useQuery<CompanionData | null>({
        queryKey: sdrScriptCompanionDataKey(isOpen && selectedCampaign ? selectedCampaign.id : null),
        queryFn: async () => {
            if (!selectedCampaign) return null;
            const res = await fetch(`/api/campaigns/${selectedCampaign.id}/script-companion`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Impossible de charger le script");
            return json.data as CompanionData;
        },
        enabled: isOpen && !!selectedCampaign,
        staleTime: 15_000,
    });

    useEffect(() => {
        if (companionData) {
            setAdditionalDraft(companionData.additionalDraft || companionData.additionalShared || "");
        } else {
            setAdditionalDraft("");
        }
    }, [companionData]);

    const hasUnsavedChanges = useMemo(
        () => (companionData?.additionalDraft ?? companionData?.additionalShared ?? "") !== additionalDraft,
        [companionData, additionalDraft]
    );

    const handleSaveDraft = async () => {
        if (!selectedCampaign) return;
        setIsSavingDraft(true);
        try {
            const res = await fetch(`/api/campaigns/${selectedCampaign.id}/script-companion`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ draft: additionalDraft }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Impossible de sauvegarder le brouillon");
            await refetchCompanionData();
            success("Brouillon sauvegardé", "Votre script additionel a bien été enregistré.");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Erreur inattendue";
            showError("Sauvegarde", message);
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleShare = async () => {
        if (!selectedCampaign) return;
        setIsPublishing(true);
        try {
            const res = await fetch(`/api/campaigns/${selectedCampaign.id}/script-companion`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: additionalDraft }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Impossible de partager le script");
            await Promise.all([
                refetchCompanionData(),
                queryClient.invalidateQueries({
                    queryKey: sdrScriptCompanionDataKey(selectedCampaign.id),
                }),
            ]);
            success("Script partagé", "Le script additionel est maintenant partagé avec l'équipe.");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Erreur inattendue";
            showError("Partage", message);
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title="Script de campagne"
            description={missionName ? `Mission : ${missionName}` : undefined}
            size="lg"
            side="left"
            closeOnOverlay={false}
            modal={false}
        >
            <div className="space-y-4">
                <Tabs
                    variant="pills"
                    activeTab={activeTab}
                    onTabChange={(tabId) => setActiveTab(tabId as ScriptTabId)}
                    tabs={[
                        { id: "base", label: "Script de base" },
                        { id: "additional", label: "Script additionel" },
                    ]}
                />

                {(campaignsLoading || companionLoading) && (
                    <div className="space-y-3">
                        <TextSkeleton lines={1} className="h-8 w-2/3" />
                        <TextSkeleton lines={6} />
                    </div>
                )}

                {!campaignsLoading && campaigns.length === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                        Aucune campagne active disponible pour cette mission.
                    </div>
                )}

                {!campaignsLoading && campaigns.length > 0 && companionData && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            Campagne : <span className="font-semibold">{companionData.campaignName}</span>
                        </div>

                        {activeTab === "base" ? (
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                {companionData.baseScript ? (
                                    <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-700 font-sans">
                                        {companionData.baseScript}
                                    </pre>
                                ) : (
                                    <p className="text-sm text-slate-500">Aucun script de base configuré sur cette campagne.</p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <textarea
                                    value={additionalDraft}
                                    onChange={(e) => setAdditionalDraft(e.target.value)}
                                    rows={16}
                                    placeholder="Ajoutez votre script additionel ici..."
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>{hasUnsavedChanges ? "Modifications non sauvegardées" : "Brouillon à jour"}</span>
                                    {companionData.sharedUpdatedAt && (
                                        <span>
                                            Partagé le {new Date(companionData.sharedUpdatedAt).toLocaleString("fr-FR")}
                                            {companionData.sharedUpdatedBy ? ` par ${companionData.sharedUpdatedBy}` : ""}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleSaveDraft}
                                        variant="secondary"
                                        disabled={isSavingDraft || isPublishing}
                                        loading={isSavingDraft}
                                    >
                                        Sauvegarder brouillon
                                    </Button>
                                    <Button
                                        onClick={handleShare}
                                        disabled={isPublishing || isSavingDraft || !additionalDraft.trim()}
                                        loading={isPublishing}
                                    >
                                        Partager avec l'equipe
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Drawer>
    );
}
