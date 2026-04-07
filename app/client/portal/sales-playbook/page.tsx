"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Target, FileText, Info, ChevronDown, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

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

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };
    return (
        <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#8B8BA7] hover:text-[#7C5CFC] transition-colors"
        >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copié !" : "Copier"}
        </button>
    );
}

const SCRIPT_SECTION_STYLES: Record<string, { color: string; bg: string; border: string; label: string }> = {
    intro:     { color: "text-indigo-700",  bg: "bg-indigo-50/60",  border: "border-l-indigo-400",  label: "Introduction" },
    discovery: { color: "text-sky-700",     bg: "bg-sky-50/60",     border: "border-l-sky-400",     label: "Découverte" },
    objection: { color: "text-amber-700",   bg: "bg-amber-50/60",   border: "border-l-amber-400",   label: "Objections" },
    closing:   { color: "text-emerald-700", bg: "bg-emerald-50/60", border: "border-l-emerald-400", label: "Closing" },
};

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
                if (items.length > 0) setSelectedMissionId(items[0].id);
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
        if (!selectedMission) { setCampaign(null); setAdditionalShared(""); return; }
        const activeCampaign = selectedMission.campaigns.find((c) => c.isActive) ?? selectedMission.campaigns[0];
        if (!activeCampaign) { setCampaign(null); setAdditionalShared(""); return; }

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
        { key: "intro",     value: baseScriptSections.intro || "" },
        { key: "discovery", value: baseScriptSections.discovery || "" },
        { key: "objection", value: baseScriptSections.objection || "" },
        { key: "closing",   value: baseScriptSections.closing || "" },
    ].filter((entry) => Boolean(entry.value));

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3" style={{ animation: "playbookFadeUp 0.35s ease both" }}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
                    <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-[#12122A] tracking-tight">Sales Playbook</h1>
                    <p className="text-xs text-[#6B7194] mt-0.5">ICP, cible et scripts de prospection</p>
                </div>
            </div>

            {loadingMissions ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-7 h-7 animate-spin text-[#7C5CFC]" />
                </div>
            ) : missions.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-[#E8EBF0] rounded-2xl py-16 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#F4F5FA] flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-6 h-6 text-[#A0A3BD]" />
                    </div>
                    <p className="text-sm font-semibold text-[#12122A]">Aucune mission active</p>
                    <p className="mt-1 text-xs text-[#6B7194]">Le playbook apparaîtra ici dès qu&apos;une mission sera active.</p>
                </div>
            ) : (
                <>
                    {/* Mission selector */}
                    <div className="max-w-sm" style={{ animation: "playbookFadeUp 0.35s ease both", animationDelay: "40ms" }}>
                        <label className="block text-xs font-bold text-[#6B7194] uppercase tracking-wider mb-1.5">Mission</label>
                        <div className="relative">
                            <select
                                value={selectedMissionId}
                                onChange={(e) => setSelectedMissionId(e.target.value)}
                                className="w-full h-10 px-3 pr-9 rounded-xl border border-[#E8EBF0] bg-white text-sm font-semibold text-[#12122A] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/30 shadow-sm appearance-none"
                            >
                                {missions.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-[#A0A3BD] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    {loadingCampaign ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-[#7C5CFC]" />
                        </div>
                    ) : !campaign ? (
                        <div className="bg-white border border-[#E8EBF0] rounded-2xl p-6 text-sm text-[#6B7194] shadow-sm">
                            Aucune campagne trouvée pour cette mission.
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {/* ICP */}
                            <section
                                className="bg-white border border-[#E8EBF0] rounded-2xl p-5 shadow-sm"
                                style={{ animation: "playbookFadeUp 0.35s ease both", animationDelay: "80ms" }}
                            >
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <Target className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <h2 className="text-sm font-bold text-[#12122A] uppercase tracking-wider">Cible (ICP)</h2>
                                </div>
                                <p className="text-sm text-[#3D3E5C] whitespace-pre-wrap leading-relaxed">{campaign.icp || "Non renseigné"}</p>
                            </section>

                            {/* Mission info */}
                            <section
                                className="bg-white border border-[#E8EBF0] rounded-2xl p-5 shadow-sm"
                                style={{ animation: "playbookFadeUp 0.35s ease both", animationDelay: "110ms" }}
                            >
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <Info className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <h2 className="text-sm font-bold text-[#12122A] uppercase tracking-wider">Infos mission</h2>
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { label: "Mission", value: selectedMission?.name },
                                        { label: "Objectif", value: selectedMission?.objective },
                                        { label: "Campagne", value: campaign.name },
                                    ].map((item) => (
                                        <div key={item.label} className="flex gap-3">
                                            <span className="text-xs font-bold text-[#A0A3BD] uppercase tracking-wide w-20 shrink-0 pt-0.5">{item.label}</span>
                                            <span className="text-sm text-[#3D3E5C] leading-relaxed">{item.value || "Non renseigné"}</span>
                                        </div>
                                    ))}
                                    {campaign.pitch && (
                                        <div className="flex gap-3">
                                            <span className="text-xs font-bold text-[#A0A3BD] uppercase tracking-wide w-20 shrink-0 pt-0.5">Pitch</span>
                                            <span className="text-sm text-[#3D3E5C] whitespace-pre-wrap leading-relaxed">{campaign.pitch}</span>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Script */}
                            {(scriptEntries.length > 0 || additionalShared) && (
                                <section
                                    className="bg-white border border-[#E8EBF0] rounded-2xl p-5 shadow-sm"
                                    style={{ animation: "playbookFadeUp 0.35s ease both", animationDelay: "140ms" }}
                                >
                                    <div className="flex items-center gap-2.5 mb-4">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                            <FileText className="w-4 h-4 text-[#7C5CFC]" />
                                        </div>
                                        <h2 className="text-sm font-bold text-[#12122A] uppercase tracking-wider">Script</h2>
                                    </div>
                                    <div className="space-y-3">
                                        {scriptEntries.map((entry) => {
                                            const style = SCRIPT_SECTION_STYLES[entry.key] ?? SCRIPT_SECTION_STYLES.intro;
                                            return (
                                                <div
                                                    key={entry.key}
                                                    className={cn("rounded-xl border-l-4 p-4", style.bg, style.border)}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <p className={cn("text-[11px] font-bold uppercase tracking-wider", style.color)}>{style.label}</p>
                                                        <CopyButton text={entry.value} />
                                                    </div>
                                                    <p className="text-sm text-[#3D3E5C] whitespace-pre-wrap leading-relaxed">{entry.value}</p>
                                                </div>
                                            );
                                        })}

                                        {additionalShared && (
                                            <div className="rounded-xl border-l-4 border-l-violet-400 bg-violet-50/60 p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Script additionnel partagé</p>
                                                    <CopyButton text={additionalShared} />
                                                </div>
                                                <p className="text-sm text-violet-900 whitespace-pre-wrap leading-relaxed">{additionalShared}</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </>
            )}

            <style jsx global>{`
                @keyframes playbookFadeUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: none; }
                }
            `}</style>
        </div>
    );
}
