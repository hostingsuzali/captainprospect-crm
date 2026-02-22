"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalFooter, Select, ConfirmModal, ContextMenu, useContextMenu, useToast, Tabs } from "@/components/ui";
import { MissionStatusWorkflowDrawer } from "@/components/drawers";
import {
    ArrowLeft,
    Target,
    Users,
    Calendar,
    Phone,
    Mail,
    Linkedin,
    Edit,
    Trash2,
    UserPlus,
    PlayCircle,
    PauseCircle,
    Loader2,
    ListIcon,
    ChevronRight,
    Sparkles,
    Briefcase,
    FileText,
    Plus,
    X,
    Eye,
    ExternalLink,
    Activity,
    TrendingUp,
    Save,
    Wand2,
    Copy,
    CheckCircle2,
    BarChart3,
} from "lucide-react";
import Link from "next/link";
import { MissionPlanForm } from "./_components/MissionPlanForm";
import { EditMissionDialog } from "./_components/EditMissionDialog";

// ============================================
// TYPES
// ============================================

interface Mission {
    id: string;
    name: string;
    objective?: string;
    channel: "CALL" | "EMAIL" | "LINKEDIN";
    channels?: ("CALL" | "EMAIL" | "LINKEDIN")[];
    isActive: boolean;
    startDate?: string;
    endDate?: string;
    client?: {
        id: string;
        name: string;
    };
    teamLeadSdrId?: string | null;
    teamLeadSdr?: { id: string; name: string; email: string } | null;
    sdrAssignments: Array<{
        id: string;
        sdr: {
            id: string;
            name: string;
            email: string;
            role: string;
            selectedListId?: string | null;
            selectedMissionId?: string | null;
        };
    }>;
    campaigns: Array<{
        id: string;
        name: string;
        isActive: boolean;
    }>;
    lists: Array<{
        id: string;
        name: string;
        type: string;
        _count?: { companies: number; contacts: number };
    }>;
    _count: {
        sdrAssignments: number;
        campaigns: number;
        lists: number;
    };
    stats?: {
        totalActions: number;
        meetingsBooked: number;
        opportunities: number;
    };
}

interface AssignableUser {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    bodyHtml: string;
    category: string;
    variables: string[];
    createdBy?: {
        id: string;
        name: string;
    };
}

interface MissionTemplate {
    id: string;
    order: number;
    template: EmailTemplate;
}

interface CampaignData {
    id: string;
    name: string;
    icp: string;
    pitch: string;
    script?: string | null;
    isActive: boolean;
}

interface ScriptSections {
    intro: string;
    discovery: string;
    objection: string;
    closing: string;
}

type ScriptSectionKey = keyof ScriptSections;

const SCRIPT_TABS = [
    { id: "intro", label: "Introduction" },
    { id: "discovery", label: "Découverte" },
    { id: "objection", label: "Objections" },
    { id: "closing", label: "Closing" },
];

// ============================================
// CHANNEL CONFIG
// ============================================

const CHANNEL_CONFIG = {
    CALL: { icon: Phone, label: "Appel", className: "mgr-channel-call" },
    EMAIL: { icon: Mail, label: "Email", className: "mgr-channel-email" },
    LINKEDIN: { icon: Linkedin, label: "LinkedIn", className: "mgr-channel-linkedin" },
};

// ============================================
// MISSION DETAIL PAGE
// ============================================

export default function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { success, error: showError } = useToast();

    const [mission, setMission] = useState<Mission | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isToggling, setIsToggling] = useState(false);

    // Modals
    const [showEditMissionDialog, setShowEditMissionDialog] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDeleteListModal, setShowDeleteListModal] = useState(false);
    const [listToDelete, setListToDelete] = useState<Mission["lists"][0] | null>(null);
    const [isDeletingList, setIsDeletingList] = useState(false);
    const [showAssignSDRModal, setShowAssignSDRModal] = useState(false);
    const [showAssignBDModal, setShowAssignBDModal] = useState(false);
    const [availableSDRs, setAvailableSDRs] = useState<AssignableUser[]>([]);
    const [availableBDs, setAvailableBDs] = useState<AssignableUser[]>([]);
    const [selectedSDRId, setSelectedSDRId] = useState<string>("");
    const [selectedBDId, setSelectedBDId] = useState<string>("");
    const [isAssigning, setIsAssigning] = useState(false);
    const [unassigningId, setUnassigningId] = useState<string | null>(null);
    const { position: listMenuPosition, contextData: listMenuData, handleContextMenu: handleListContextMenu, close: closeListMenu } = useContextMenu();

    // Email Templates
    const [missionTemplates, setMissionTemplates] = useState<MissionTemplate[]>([]);
    const [availableTemplates, setAvailableTemplates] = useState<EmailTemplate[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
    const [selectedTemplateToAdd, setSelectedTemplateToAdd] = useState<string>("");
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);
    const [removingTemplateId, setRemovingTemplateId] = useState<string | null>(null);

    // Team lead: SDR who can see all teammates' rappels and notes in this mission
    const [teamLeadSdrId, setTeamLeadSdrId] = useState<string>("");
    const [isSavingTeamLead, setIsSavingTeamLead] = useState(false);
    const [activeTab, setActiveTab] = useState("general");
    const [showStatusWorkflowDrawer, setShowStatusWorkflowDrawer] = useState(false);

    // Inline Strategy (Campaign) state
    const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
    const [isStrategyEditing, setIsStrategyEditing] = useState(false);
    const [isSavingStrategy, setIsSavingStrategy] = useState(false);
    const [strategyForm, setStrategyForm] = useState({ icp: "", pitch: "" });
    const [scriptSections, setScriptSections] = useState<ScriptSections>({ intro: "", discovery: "", objection: "", closing: "" });
    const [activeScriptTab, setActiveScriptTab] = useState("intro");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatingSection, setGeneratingSection] = useState<string | null>(null);
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiRequestedSection, setAiRequestedSection] = useState<"all" | ScriptSectionKey>("all");
    const [aiActiveTab, setAiActiveTab] = useState<ScriptSectionKey>("intro");
    const [aiSuggestions, setAiSuggestions] = useState<Partial<Record<ScriptSectionKey, string[]>>>({});
    const [aiSelectedIndex, setAiSelectedIndex] = useState<Record<ScriptSectionKey, number>>({ intro: 0, discovery: 0, objection: 0, closing: 0 });

    // Plan de mission (schedule plan)
    const [missionPlan, setMissionPlan] = useState<{
        id: string;
        missionId: string;
        frequency: number;
        preferredDays: string[];
        timePreference: string;
        customStartTime: string | null;
        customEndTime: string | null;
        startDate: string;
        endDate: string | null;
        status: string;
        assignedSdrs: Array<{ sdrId: string; sdr: { id: string; name: string; email: string; role?: string } }>;
    } | null>(null);

    // ============================================
    // FETCH MISSION
    // ============================================

    const fetchMission = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/missions/${resolvedParams.id}`);
            const json = await res.json();

            if (json.success) {
                const m = json.data;
                setMission(m);
                setTeamLeadSdrId(m?.teamLeadSdrId ?? "");
            } else {
                showError("Erreur", json.error || "Mission non trouvée");
                router.push("/manager/missions");
            }
        } catch (err) {
            console.error("Failed to fetch mission:", err);
            showError("Erreur", "Impossible de charger la mission");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMission();
    }, [resolvedParams.id]);

    const fetchMissionPlan = async () => {
        if (!mission?.id) return;
        try {
            const res = await fetch(`/api/mission-plans?missionId=${mission.id}`);
            const json = await res.json();
            if (json.success && json.data) {
                const p = json.data;
                setMissionPlan({
                    id: p.id,
                    missionId: p.missionId,
                    frequency: p.frequency,
                    preferredDays: p.preferredDays ?? [],
                    timePreference: p.timePreference,
                    customStartTime: p.customStartTime ?? null,
                    customEndTime: p.customEndTime ?? null,
                    startDate: p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : "",
                    endDate: p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : null,
                    status: p.status,
                    assignedSdrs: (p.assignedSdrs ?? []).map((a: { sdrId: string; sdr: { id: string; name: string; email: string; role?: string } }) => ({
                        sdrId: a.sdrId,
                        sdr: a.sdr,
                    })),
                });
            } else {
                setMissionPlan(null);
            }
        } catch {
            setMissionPlan(null);
        }
    };

    useEffect(() => {
        if (mission?.id) fetchMissionPlan();
    }, [mission?.id]);

    // ============================================
    // FETCH / SAVE STRATEGY (Campaign)
    // ============================================

    const fetchCampaignStrategy = async () => {
        if (!mission?.id || mission.campaigns.length === 0) return;
        try {
            const res = await fetch(`/api/campaigns/${mission.campaigns[0].id}`);
            const json = await res.json();
            if (json.success) {
                const c: CampaignData = json.data;
                setCampaignData(c);
                setStrategyForm({ icp: c.icp || "", pitch: c.pitch || "" });
                if (c.script) {
                    try {
                        const parsed = JSON.parse(c.script);
                        if (typeof parsed === "object") {
                            setScriptSections({
                                intro: parsed.intro || "",
                                discovery: parsed.discovery || "",
                                objection: parsed.objection || "",
                                closing: parsed.closing || "",
                            });
                        } else {
                            setScriptSections({ intro: c.script, discovery: "", objection: "", closing: "" });
                        }
                    } catch {
                        setScriptSections({ intro: c.script, discovery: "", objection: "", closing: "" });
                    }
                }
            }
        } catch (err) {
            console.error("Failed to fetch campaign strategy:", err);
        }
    };

    useEffect(() => {
        if (mission?.id) fetchCampaignStrategy();
    }, [mission?.id]);

    const handleSaveStrategy = async () => {
        if (!campaignData) return;
        setIsSavingStrategy(true);
        try {
            const res = await fetch(`/api/campaigns/${campaignData.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    icp: strategyForm.icp,
                    pitch: strategyForm.pitch,
                    script: { intro: scriptSections.intro, discovery: scriptSections.discovery, objection: scriptSections.objection, closing: scriptSections.closing },
                }),
            });
            const json = await res.json();
            if (json.success) {
                success("Stratégie sauvegardée", "Le script et le message ont été mis à jour");
                setIsStrategyEditing(false);
                fetchCampaignStrategy();
            } else {
                showError("Erreur", json.error);
            }
        } catch {
            showError("Erreur", "Impossible de sauvegarder");
        } finally {
            setIsSavingStrategy(false);
        }
    };

    const generateWithMistral = async (section: "all" | ScriptSectionKey) => {
        if (!mission) return;
        if (!strategyForm.icp.trim() || !strategyForm.pitch.trim()) {
            showError("Erreur", "Veuillez renseigner l'ICP et le pitch avant de générer");
            return;
        }
        setIsGenerating(true);
        setGeneratingSection(section);
        try {
            const res = await fetch("/api/ai/mistral/script", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channel: mission.channel,
                    clientName: mission.client?.name,
                    missionName: mission.name,
                    campaignName: campaignData?.name || mission.name,
                    campaignDescription: mission.objective,
                    icp: strategyForm.icp,
                    pitch: strategyForm.pitch,
                    section,
                    suggestionsCount: 3,
                }),
            });
            const json = await res.json();
            if (json.success && (json.data?.suggestions || json.data?.script)) {
                const suggestions = json.data?.suggestions || {};
                const fallbackScript = json.data?.script || {};
                const merged: Partial<Record<ScriptSectionKey, string[]>> = { ...suggestions };
                (["intro", "discovery", "objection", "closing"] as ScriptSectionKey[]).forEach((k) => {
                    if (!merged[k] || merged[k]?.length === 0) {
                        const v = fallbackScript?.[k];
                        if (typeof v === "string" && v.trim()) merged[k] = [v];
                    }
                });
                setAiSuggestions(merged);
                setAiRequestedSection(section);
                setAiActiveTab(section === "all" ? "intro" : section);
                setAiSelectedIndex({ intro: 0, discovery: 0, objection: 0, closing: 0 });
                setAiModalOpen(true);
            } else {
                showError("Erreur", json.error || "Impossible de générer le script");
            }
        } catch {
            showError("Erreur", "Erreur de connexion à Mistral AI");
        } finally {
            setIsGenerating(false);
            setGeneratingSection(null);
        }
    };

    const applySelectedSuggestions = (mode: "all" | ScriptSectionKey) => {
        const applyOne = (key: ScriptSectionKey) => {
            const list = aiSuggestions[key] || [];
            const idx = aiSelectedIndex[key] ?? 0;
            const value = list[idx] ?? "";
            setScriptSections((prev) => ({ ...prev, [key]: value }));
        };
        if (mode === "all") {
            (["intro", "discovery", "objection", "closing"] as ScriptSectionKey[]).forEach(applyOne);
            success("Suggestions appliquées", "Les sections ont été appliquées");
        } else {
            applyOne(mode);
            success("Suggestion appliquée", "La suggestion a été appliquée");
        }
        setAiModalOpen(false);
    };

    const copyScript = () => {
        const full = Object.entries(scriptSections)
            .filter(([, c]) => c)
            .map(([k, c]) => `--- ${k.toUpperCase()} ---\n${c}`)
            .join("\n\n");
        navigator.clipboard.writeText(full);
        success("Script copié", "Copié dans le presse-papier");
    };

    // ============================================
    // FETCH AVAILABLE SDRS / BDS
    // ============================================

    const assignedSDRs = mission?.sdrAssignments.filter(a => a.sdr.role === "SDR") || [];
    const assignedBDs = mission?.sdrAssignments.filter(a => a.sdr.role === "BUSINESS_DEVELOPER") || [];

    const fetchAvailableSDRs = async () => {
        try {
            const res = await fetch("/api/users?role=SDR&status=active&excludeSelf=false");
            const json = await res.json();
            if (json.success && json.data?.users) {
                const ids = mission?.sdrAssignments.map(a => a.sdr.id) || [];
                const available = json.data.users.filter((u: AssignableUser) => !ids.includes(u.id));
                setAvailableSDRs(available);
            }
        } catch (err) {
            console.error("Failed to fetch SDRs:", err);
        }
    };

    const fetchAvailableBDs = async () => {
        try {
            const res = await fetch("/api/users?role=BUSINESS_DEVELOPER&status=active&excludeSelf=false");
            const json = await res.json();
            if (json.success && json.data?.users) {
                const ids = mission?.sdrAssignments.map(a => a.sdr.id) || [];
                const available = json.data.users.filter((u: AssignableUser) => !ids.includes(u.id));
                setAvailableBDs(available);
            }
        } catch (err) {
            console.error("Failed to fetch BDs:", err);
        }
    };

    // ============================================
    // EMAIL TEMPLATES
    // ============================================

    const fetchMissionTemplates = async () => {
        if (!mission) return;
        setIsLoadingTemplates(true);
        try {
            const res = await fetch(`/api/missions/${mission.id}/templates`);
            const json = await res.json();
            if (json.success) {
                setMissionTemplates(json.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch mission templates:", err);
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const fetchAvailableTemplates = async () => {
        try {
            const res = await fetch("/api/email/templates?isShared=true");
            const json = await res.json();
            if (json.success) {
                // Filter out already assigned templates
                const assignedIds = missionTemplates.map(mt => mt.template.id);
                const available = (json.data || []).filter((t: EmailTemplate) => !assignedIds.includes(t.id));
                setAvailableTemplates(available);
            }
        } catch (err) {
            console.error("Failed to fetch available templates:", err);
        }
    };

    useEffect(() => {
        if (mission) {
            fetchMissionTemplates();
        }
    }, [mission?.id]);

    const handleAddTemplate = async () => {
        if (!mission || !selectedTemplateToAdd) return;
        setIsAddingTemplate(true);
        try {
            const res = await fetch(`/api/missions/${mission.id}/templates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ templateId: selectedTemplateToAdd }),
            });
            const json = await res.json();
            if (json.success) {
                success("Template ajouté", "Le template a été assigné à la mission");
                setShowAddTemplateModal(false);
                setSelectedTemplateToAdd("");
                fetchMissionTemplates();
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            showError("Erreur", "Impossible d'ajouter le template");
        } finally {
            setIsAddingTemplate(false);
        }
    };

    const handleRemoveTemplate = async (templateId: string) => {
        if (!mission) return;
        setRemovingTemplateId(templateId);
        try {
            const res = await fetch(`/api/missions/${mission.id}/templates?templateId=${templateId}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (json.success) {
                success("Template retiré", "Le template a été retiré de la mission");
                fetchMissionTemplates();
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            showError("Erreur", "Impossible de retirer le template");
        } finally {
            setRemovingTemplateId(null);
        }
    };

    // ============================================
    // TOGGLE ACTIVE STATUS
    // ============================================

    const toggleActive = async () => {
        if (!mission) return;

        setIsToggling(true);
        try {
            const res = await fetch(`/api/missions/${mission.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !mission.isActive }),
            });

            const json = await res.json();

            if (json.success) {
                setMission(prev => prev ? { ...prev, isActive: !prev.isActive } : null);
                success(
                    mission.isActive ? "Mission mise en pause" : "Mission activée",
                    `${mission.name} est maintenant ${!mission.isActive ? "active" : "en pause"}`
                );
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            showError("Erreur", "Impossible de modifier le statut");
        } finally {
            setIsToggling(false);
        }
    };

    // ============================================
    // DELETE MISSION
    // ============================================

    const handleDelete = async () => {
        if (!mission) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/missions/${mission.id}`, {
                method: "DELETE",
            });

            const json = await res.json();

            if (json.success) {
                success("Mission supprimée", `${mission.name} a été supprimée`);
                router.push("/manager/missions");
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            showError("Erreur", "Impossible de supprimer la mission");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleDeleteList = async () => {
        if (!listToDelete) return;

        setIsDeletingList(true);
        try {
            const res = await fetch(`/api/lists/${listToDelete.id}`, { method: "DELETE" });
            const json = await res.json();

            if (json.success) {
                success("Liste supprimée", `${listToDelete.name} a été supprimée`);
                setShowDeleteListModal(false);
                setListToDelete(null);
                fetchMission();
            } else {
                showError("Erreur", json.error || "Impossible de supprimer la liste");
            }
        } catch (err) {
            showError("Erreur", "Impossible de supprimer la liste");
        } finally {
            setIsDeletingList(false);
        }
    };

    const listContextMenuItems = listMenuData
        ? [
            {
                label: "Supprimer",
                icon: <Trash2 className="w-4 h-4" />,
                onClick: () => {
                    setListToDelete(listMenuData);
                    setShowDeleteListModal(true);
                },
                variant: "danger" as const,
            },
        ]
        : [];

    // ============================================
    // ASSIGN SDR
    // ============================================

    const handleAssignSDR = async () => {
        if (!mission || !selectedSDRId) return;
        setIsAssigning(true);
        try {
            const res = await fetch(`/api/missions/${mission.id}/assign`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sdrId: selectedSDRId }),
            });
            const json = await res.json();
            if (json.success) {
                success("SDR assigné", "Le SDR a été assigné à la mission");
                setShowAssignSDRModal(false);
                setSelectedSDRId("");
                fetchMission();
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            showError("Erreur", "Impossible d'assigner le SDR");
        } finally {
            setIsAssigning(false);
        }
    };

    const handleAssignBD = async () => {
        if (!mission || !selectedBDId) return;
        setIsAssigning(true);
        try {
            const res = await fetch(`/api/missions/${mission.id}/assign`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sdrId: selectedBDId }),
            });
            const json = await res.json();
            if (json.success) {
                success("BD assigné", "Le Business Developer a été assigné à la mission");
                setShowAssignBDModal(false);
                setSelectedBDId("");
                fetchMission();
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            showError("Erreur", "Impossible d'assigner le BD");
        } finally {
            setIsAssigning(false);
        }
    };

    const handleUnassign = async (sdrId: string) => {
        if (!mission) return;
        setUnassigningId(sdrId);
        try {
            const res = await fetch(`/api/missions/${mission.id}/assign?sdrId=${sdrId}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) {
                success("Retiré", "L'utilisateur a été retiré de la mission");
                fetchMission();
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            showError("Erreur", "Impossible de retirer l'assignation");
        } finally {
            setUnassigningId(null);
        }
    };

    const handleTeamLeadChange = async (newTeamLeadSdrId: string) => {
        if (!mission) return;
        setIsSavingTeamLead(true);
        try {
            const res = await fetch(`/api/missions/${mission.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamLeadSdrId: newTeamLeadSdrId || null }),
            });
            const json = await res.json();
            if (json.success) {
                setTeamLeadSdrId(newTeamLeadSdrId);
                setMission((prev) => prev ? { ...prev, teamLeadSdrId: newTeamLeadSdrId || null, teamLeadSdr: json.data?.teamLeadSdr ?? prev.teamLeadSdr } : null);
                success("Responsable d'équipe", newTeamLeadSdrId ? "Mis à jour : il pourra voir tous les rappels et notes de l'équipe." : "Aucun responsable.");
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            showError("Erreur", "Impossible de enregistrer le responsable d'équipe");
        } finally {
            setIsSavingTeamLead(false);
        }
    };

    // ============================================
    // LOADING STATE
    // ============================================

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-sm text-slate-500">Chargement de la mission...</p>
                </div>
            </div>
        );
    }

    if (!mission) {
        return null;
    }

    const channelsList = mission.channels?.length ? mission.channels : [mission.channel];
    const channel = CHANNEL_CONFIG[mission.channel];
    const ChannelIcon = channel.icon;

    const dateRangeStr = mission.startDate
        ? `${new Date(mission.startDate).toLocaleDateString("fr-FR")} → ${mission.endDate ? new Date(mission.endDate).toLocaleDateString("fr-FR") : "En cours"}`
        : "—";

    return (
        <div className="space-y-6">
            {/* Compact header with inline stats */}
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white">
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Link
                            href="/manager/missions"
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-lg font-bold shrink-0">
                            {mission.client?.name?.[0] || "M"}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <h1 className="text-xl font-bold">{mission.name}</h1>
                                <span className={mission.isActive ? "mgr-badge-active" : "mgr-badge-paused"}>
                                    {mission.isActive ? "Actif" : "Pause"}
                                </span>
                                {channelsList.length === 1 ? (
                                    <span className={`mgr-channel-badge ${channel.className}`}>
                                        <ChannelIcon className="w-3 h-3" />
                                        {channel.label}
                                    </span>
                                ) : (
                                    channelsList.map((ch) => {
                                        const cfg = CHANNEL_CONFIG[ch];
                                        const Icon = cfg?.icon ?? ChannelIcon;
                                        return (
                                            <span key={ch} className={`mgr-channel-badge ${cfg?.className ?? channel.className}`}>
                                                <Icon className="w-3 h-3" />
                                                {cfg?.label ?? ch}
                                            </span>
                                        );
                                    })
                                )}
                            </div>
                            <p className="text-sm text-slate-400">
                                {assignedSDRs.length} SDR{assignedSDRs.length !== 1 ? "s" : ""} · {assignedBDs.length} BD{assignedBDs.length !== 1 ? "s" : ""} · {mission._count.lists} liste{mission._count.lists !== 1 ? "s" : ""} · {dateRangeStr}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleActive}
                            disabled={isToggling}
                            className="flex items-center gap-2 h-9 px-3 text-sm font-medium bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg transition-colors"
                        >
                            {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : mission.isActive ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                            {mission.isActive ? "Pause" : "Activer"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowEditMissionDialog(true)}
                            className="flex items-center gap-2 h-9 px-3 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <Edit className="w-4 h-4" />
                            Modifier
                        </button>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="flex items-center gap-2 h-9 px-3 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>


            {/* TABS NAVIGATION */}
            <div className="mt-6 border-b border-slate-200">
                <Tabs
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    tabs={[
                        { id: "general", label: "Général", icon: <Activity className="w-4 h-4" /> },
                        { id: "strategy", label: "Stratégie & Scripts", icon: <Target className="w-4 h-4" /> },
                        { id: "planning", label: "Planification & Équipe", icon: <Calendar className="w-4 h-4" /> },
                        { id: "audience", label: "Audiences", icon: <Users className="w-4 h-4" /> },
                    ]}
                />
            </div>

            {/* TAB CONTENT */}
            <div className="mt-8">
                {activeTab === "general" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* KPI Dashboard — Real Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                        <Activity className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <span className="px-2 py-1 text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg flex items-center gap-1">
                                        total
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900">{mission.stats?.totalActions ?? 0}</h3>
                                <p className="text-sm text-slate-500 font-medium">Actions réalisées</p>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                        <Target className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <span className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> RDV
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900">{mission.stats?.meetingsBooked ?? 0}</h3>
                                <p className="text-sm text-slate-500 font-medium">Rendez-vous bookés</p>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                                        <BarChart3 className="w-5 h-5 text-violet-600" />
                                    </div>
                                    <span className="px-2 py-1 text-xs font-semibold text-violet-700 bg-violet-50 rounded-lg flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> Opps
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900">{mission.stats?.opportunities ?? 0}</h3>
                                <p className="text-sm text-slate-500 font-medium">Opportunités créées</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Infos mission */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Infos mission</h2>
                                <dl className="space-y-3 text-sm">
                                    <div>
                                        <dt className="text-slate-500 font-medium">Canal</dt>
                                        <dd className="text-slate-900 flex items-center gap-2 mt-0.5">
                                            <ChannelIcon className="w-4 h-4 text-slate-500" />
                                            {channel.label}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-slate-500 font-medium">Client</dt>
                                        <dd className="text-slate-900 mt-0.5">{mission.client?.name ?? "—"}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-slate-500 font-medium">Début</dt>
                                        <dd className="text-slate-900 mt-0.5">
                                            {mission.startDate ? new Date(mission.startDate).toLocaleDateString("fr-FR") : "—"}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-slate-500 font-medium">Fin</dt>
                                        <dd className="text-slate-900 mt-0.5">
                                            {mission.endDate ? new Date(mission.endDate).toLocaleDateString("fr-FR") : "En cours"}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "strategy" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* Inline Strategy Editor */}
                        {mission.campaigns.length === 0 ? (
                            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                                    <Target className="w-8 h-8 text-emerald-400" />
                                </div>
                                <p className="text-slate-500 text-sm">Aucune stratégie configurée pour cette mission.</p>
                            </div>
                        ) : (
                            <>
                                {/* ICP & Pitch */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                                <Target className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-semibold text-slate-900">Cible & Message</h2>
                                                <p className="text-sm text-slate-500">ICP et pitch de prospection</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isStrategyEditing ? (
                                                <>
                                                    <button
                                                        onClick={() => setIsStrategyEditing(false)}
                                                        className="h-9 px-4 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                                    >
                                                        Annuler
                                                    </button>
                                                    <button
                                                        onClick={handleSaveStrategy}
                                                        disabled={isSavingStrategy}
                                                        className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors"
                                                    >
                                                        {isSavingStrategy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                        Enregistrer
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => setIsStrategyEditing(true)}
                                                    className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                    Modifier
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">ICP (Profil Client Idéal)</label>
                                            {isStrategyEditing ? (
                                                <textarea
                                                    value={strategyForm.icp}
                                                    onChange={(e) => setStrategyForm(prev => ({ ...prev, icp: e.target.value }))}
                                                    rows={3}
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm"
                                                    placeholder="Décrivez votre client idéal..."
                                                />
                                            ) : (
                                                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg min-h-[60px]">{campaignData?.icp || <span className="text-slate-400 italic">Non défini</span>}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Pitch</label>
                                            {isStrategyEditing ? (
                                                <textarea
                                                    value={strategyForm.pitch}
                                                    onChange={(e) => setStrategyForm(prev => ({ ...prev, pitch: e.target.value }))}
                                                    rows={3}
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm"
                                                    placeholder="Votre message clé..."
                                                />
                                            ) : (
                                                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg min-h-[60px]">{campaignData?.pitch || <span className="text-slate-400 italic">Non défini</span>}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Script Editor */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                                                <Sparkles className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-semibold text-slate-900">Script d'appel</h2>
                                                <p className="text-sm text-slate-500">Introduction, découverte, objections, closing</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isStrategyEditing && (
                                                <button
                                                    onClick={() => generateWithMistral("all")}
                                                    disabled={isGenerating || !strategyForm.icp || !strategyForm.pitch}
                                                    className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-indigo-700 bg-gradient-to-r from-purple-50 to-indigo-50 border border-indigo-200 hover:from-purple-100 hover:to-indigo-100 disabled:opacity-50 rounded-lg transition-colors"
                                                >
                                                    {isGenerating && generatingSection === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                                    Générer avec IA
                                                </button>
                                            )}
                                            {!isStrategyEditing && (
                                                <button onClick={copyScript} className="flex items-center gap-2 h-9 px-3 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                                                    <Copy className="w-4 h-4" />
                                                    Copier
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <Tabs tabs={SCRIPT_TABS} activeTab={activeScriptTab} onTabChange={setActiveScriptTab} className="mb-4" />

                                    {isStrategyEditing ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => generateWithMistral(activeScriptTab as ScriptSectionKey)}
                                                    disabled={isGenerating || !strategyForm.icp || !strategyForm.pitch}
                                                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                                                >
                                                    {isGenerating && generatingSection === activeScriptTab ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                                    Générer cette section
                                                </button>
                                            </div>
                                            <textarea
                                                value={scriptSections[activeScriptTab as ScriptSectionKey]}
                                                onChange={(e) => setScriptSections(prev => ({ ...prev, [activeScriptTab]: e.target.value }))}
                                                rows={10}
                                                placeholder={`Script de ${SCRIPT_TABS.find(t => t.id === activeScriptTab)?.label.toLowerCase()}...`}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
                                            />
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 min-h-[180px]">
                                            {scriptSections[activeScriptTab as ScriptSectionKey] ? (
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{scriptSections[activeScriptTab as ScriptSectionKey]}</p>
                                            ) : (
                                                <div className="text-center py-8 text-sm text-slate-400">
                                                    <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                    Aucun script pour cette section
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Email Templates */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-indigo-500">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
                                        <Mail className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Email Templates</h2>
                                        <p className="text-sm text-slate-500">Templates pour envoi rapide</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        fetchAvailableTemplates();
                                        setShowAddTemplateModal(true);
                                    }}
                                    className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Ajouter
                                </button>
                            </div>
                            {isLoadingTemplates ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                </div>
                            ) : missionTemplates.length === 0 ? (
                                <p className="text-sm text-slate-500 mb-3">Aucun template.</p>
                            ) : (
                                <div className="grid gap-2">
                                    {missionTemplates.map((mt) => (
                                        <div
                                            key={mt.id}
                                            className="group flex items-center gap-4 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                                                <Sparkles className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 truncate text-sm">{mt.template.name}</p>
                                                <p className="text-xs text-slate-500 truncate">{mt.template.subject}</p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setPreviewTemplate(mt.template); setShowPreviewModal(true); }}
                                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                    title="Prévisualiser"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveTemplate(mt.template.id)}
                                                    disabled={removingTemplateId === mt.template.id}
                                                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                                                    title="Retirer"
                                                >
                                                    {removingTemplateId === mt.template.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {missionTemplates.length === 0 && (
                                <a
                                    href="/manager/email/templates"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 mt-2 text-sm font-medium text-indigo-600 hover:underline"
                                >
                                    <Plus className="w-4 h-4" />
                                    Créer un template
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "planning" && (
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="space-y-6">
                            {/* Plan de mission — largest, top */}
                            <div id="plan" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-cyan-500">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-cyan-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Plan de mission</h2>
                                        <p className="text-sm text-slate-500">Fréquence, jours et SDRs pour générer le planning</p>
                                    </div>
                                </div>
                                <MissionPlanForm
                                    missionId={mission.id}
                                    missionName={mission.name}
                                    sdrAssignments={mission.sdrAssignments}
                                    existingPlan={missionPlan}
                                    onPlanSaved={fetchMissionPlan}
                                />
                            </div>

                        </div>
                        <div className="space-y-6">
                            {/* Équipe (unified: responsable + SDRs + BDs) */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-indigo-500">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Équipe</h2>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Responsable</p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 min-w-0">
                                                <Select
                                                    placeholder="Aucun"
                                                    value={teamLeadSdrId}
                                                    onChange={(v) => handleTeamLeadChange(v)}
                                                    disabled={isSavingTeamLead || (mission.sdrAssignments.length === 0)}
                                                    options={[
                                                        { value: "", label: "Aucun" },
                                                        ...mission.sdrAssignments.map((a) => ({
                                                            value: a.sdr.id,
                                                            label: `${a.sdr.name}${a.sdr.role === "BUSINESS_DEVELOPER" ? " (BD)" : ""}`,
                                                        })),
                                                    ]}
                                                />
                                            </div>
                                            {isSavingTeamLead && <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">SDRs assignés ({assignedSDRs.length})</p>
                                            <button
                                                onClick={() => { fetchAvailableSDRs(); setShowAssignSDRModal(true); }}
                                                className="text-xs font-medium text-indigo-600 hover:underline"
                                            >
                                                + Assigner
                                            </button>
                                        </div>
                                        {assignedSDRs.length === 0 ? (
                                            <p className="text-sm text-slate-500">Aucun SDR</p>
                                        ) : (
                                            <div className="flex flex-col gap-3">
                                                {assignedSDRs.map((assignment) => {
                                                    const activeList = mission.lists.find((l: any) => l.id === assignment.sdr.selectedListId);
                                                    const isCurrentlyWorkingHere = assignment.sdr.selectedMissionId === mission.id && activeList;

                                                    return (
                                                        <div key={assignment.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-colors">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                                                                    {assignment.sdr.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-slate-900 truncate">{assignment.sdr.name}</p>
                                                                    {isCurrentlyWorkingHere ? (
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <div className="relative flex h-2 w-2 flex-shrink-0">
                                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                                            </div>
                                                                            <p className="text-xs text-emerald-600 font-medium truncate" title={`Table active: ${activeList.name}`}>
                                                                                Table : {activeList.name}
                                                                            </p>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-slate-500 mt-0.5 truncate">Hors ligne ou autre table</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleUnassign(assignment.sdr.id)}
                                                                disabled={unassigningId === assignment.sdr.id}
                                                                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-red-500 disabled:opacity-50 transition-colors flex-shrink-0"
                                                                title="Retirer"
                                                            >
                                                                {unassigningId === assignment.sdr.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">BDs ({assignedBDs.length})</p>
                                            <button
                                                onClick={() => { fetchAvailableBDs(); setShowAssignBDModal(true); }}
                                                className="text-xs font-medium text-violet-600 hover:underline"
                                            >
                                                + Assigner
                                            </button>
                                        </div>
                                        {assignedBDs.length === 0 ? (
                                            <p className="text-sm text-slate-500">Aucun BD</p>
                                        ) : (
                                            <div className="flex flex-col gap-3">
                                                {assignedBDs.map((assignment) => {
                                                    const activeList = mission.lists.find((l: any) => l.id === assignment.sdr.selectedListId);
                                                    const isCurrentlyWorkingHere = assignment.sdr.selectedMissionId === mission.id && activeList;

                                                    return (
                                                        <div key={assignment.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-violet-100 transition-colors">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700">
                                                                    {assignment.sdr.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-slate-900 truncate">{assignment.sdr.name}</p>
                                                                    {isCurrentlyWorkingHere ? (
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <div className="relative flex h-2 w-2 flex-shrink-0">
                                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                                            </div>
                                                                            <p className="text-xs text-emerald-600 font-medium truncate" title={`Table active: ${activeList.name}`}>
                                                                                Table : {activeList.name}
                                                                            </p>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-slate-500 mt-0.5 truncate">Hors ligne ou autre table</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleUnassign(assignment.sdr.id)}
                                                                disabled={unassigningId === assignment.sdr.id}
                                                                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-red-500 disabled:opacity-50 transition-colors flex-shrink-0"
                                                                title="Retirer"
                                                            >
                                                                {unassigningId === assignment.sdr.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Statuts et workflow */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-teal-500">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Statuts et workflow</h2>
                                        <p className="text-sm text-slate-500">Statuts d&apos;appel et priorités</p>
                                    </div>
                                    <button
                                        onClick={() => setShowStatusWorkflowDrawer(true)}
                                        className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors shrink-0"
                                    >
                                        Gérer les statuts
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {activeTab === "audience" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* Listes de contacts */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                        <ListIcon className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-slate-900">Listes de contacts</h2>
                                </div>
                                <Link
                                    href={`/manager/lists/new?missionId=${mission.id}`}
                                    className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                                >
                                    <ListIcon className="w-4 h-4" />
                                    Nouvelle
                                </Link>
                            </div>
                            {mission.lists.length === 0 ? (
                                <p className="text-sm text-slate-500">Aucune liste</p>
                            ) : (
                                <div className="space-y-2">
                                    {mission.lists.map((list) => (
                                        <div
                                            key={list.id}
                                            className="relative"
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                handleListContextMenu(e, list);
                                            }}
                                        >
                                            <Link
                                                href={`/manager/lists/${list.id}`}
                                                className="mgr-mission-card group flex items-center gap-4 p-4 block"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <ListIcon className="w-5 h-5 text-amber-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">{list.name}</p>
                                                    <p className="text-sm text-slate-500">
                                                        {list._count?.companies || 0} sociétés · {list._count?.contacts || 0} contacts
                                                    </p>
                                                </div>
                                                <span className="text-xs font-medium text-slate-500 px-2 py-1 bg-slate-100 rounded">{list.type}</span>
                                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>

            {/* Add Template Modal */}
            {showAddTemplateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowAddTemplateModal(false)} />
                    <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-lg font-semibold text-white">Ajouter un template</h2>
                            </div>
                            <button
                                onClick={() => setShowAddTemplateModal(false)}
                                className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {availableTemplates.length === 0 ? (
                                <div className="text-center py-8">
                                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-600 mb-2">Aucun template disponible</p>
                                    <p className="text-sm text-slate-500 mb-4">
                                        Créez des templates partagés dans la section Email
                                    </p>
                                    <a
                                        href="/manager/email/templates"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Créer un template
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {availableTemplates.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => setSelectedTemplateToAdd(template.id)}
                                            className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${selectedTemplateToAdd === template.id
                                                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20"
                                                : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedTemplateToAdd === template.id
                                                ? "bg-indigo-500 text-white"
                                                : "bg-slate-100 text-slate-500"
                                                }`}>
                                                <Sparkles className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 truncate">{template.name}</p>
                                                <p className="text-sm text-slate-500 truncate">{template.subject}</p>
                                            </div>
                                            <span className="px-2 py-0.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-full flex-shrink-0">
                                                {template.category}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={() => setShowAddTemplateModal(false)}
                                className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleAddTemplate}
                                disabled={!selectedTemplateToAdd || isAddingTemplate}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-lg disabled:opacity-50 transition-all"
                            >
                                {isAddingTemplate ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Ajout...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Ajouter
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Preview Modal */}
            {showPreviewModal && previewTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowPreviewModal(false)} />
                    <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                    <Eye className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">{previewTemplate.name}</h2>
                                    <p className="text-sm text-white/80">{previewTemplate.category}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="mb-4">
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Objet</label>
                                <p className="mt-1 text-lg font-medium text-slate-900">{previewTemplate.subject}</p>
                            </div>
                            {previewTemplate.variables.length > 0 && (
                                <div className="mb-4">
                                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Variables</label>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {previewTemplate.variables.map((v) => (
                                            <span key={v} className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-md">
                                                {`{{${v}}}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Contenu</label>
                                <div
                                    className="mt-2 p-4 bg-slate-50 rounded-xl border border-slate-200 prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: previewTemplate.bodyHtml }}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Suggestions Modal */}
            <Modal
                isOpen={aiModalOpen}
                onClose={() => setAiModalOpen(false)}
                title="Suggestions IA"
                description="Choisissez une proposition avant de l'appliquer à votre script."
                size="xl"
            >
                {aiRequestedSection === "all" && (
                    <Tabs
                        tabs={SCRIPT_TABS}
                        activeTab={aiActiveTab}
                        onTabChange={(t) => setAiActiveTab(t as ScriptSectionKey)}
                        className="mb-4"
                    />
                )}

                {(() => {
                    const currentSection: ScriptSectionKey =
                        aiRequestedSection === "all" ? aiActiveTab : aiRequestedSection;
                    const items = aiSuggestions[currentSection] || [];

                    return (
                        <div className="space-y-3">
                            {items.length === 0 ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                    Aucune suggestion reçue pour cette section. Réessayez la génération.
                                </div>
                            ) : (
                                items.map((text, idx) => {
                                    const selected = (aiSelectedIndex[currentSection] ?? 0) === idx;
                                    return (
                                        <button
                                            key={`${currentSection}-${idx}`}
                                            type="button"
                                            onClick={() =>
                                                setAiSelectedIndex((prev) => ({ ...prev, [currentSection]: idx }))
                                            }
                                            className={`w-full text-left rounded-xl border p-4 transition-all ${selected
                                                ? "border-indigo-300 bg-indigo-50"
                                                : "border-slate-200 bg-white hover:bg-slate-50"}`}
                                        >
                                            <div className="flex items-center justify-between gap-3 mb-2">
                                                <div className="text-xs font-bold tracking-wide uppercase text-slate-500">
                                                    Suggestion {idx + 1}
                                                </div>
                                                <div className={`text-[11px] font-bold px-2 py-1 rounded-full ${selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                                                    {selected ? "Sélectionnée" : "Choisir"}
                                                </div>
                                            </div>
                                            <div className="text-sm text-slate-800 whitespace-pre-wrap">{text}</div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    );
                })()}

                <ModalFooter>
                    <button
                        onClick={() => setAiModalOpen(false)}
                        className="h-9 px-4 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={() => applySelectedSuggestions(aiRequestedSection === "all" ? "all" : aiRequestedSection)}
                        className="h-9 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                    >
                        {aiRequestedSection === "all" ? "Appliquer tout" : "Appliquer"}
                    </button>
                </ModalFooter>
            </Modal>

            <EditMissionDialog
                isOpen={showEditMissionDialog}
                onClose={() => setShowEditMissionDialog(false)}
                mission={mission}
                onSaved={fetchMission}
            />


            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Supprimer la mission ?"
                message={`Êtes-vous sûr de vouloir supprimer "${mission.name}" ? Cette action est irréversible.`}
                confirmText="Supprimer"
                variant="danger"
                isLoading={isDeleting}
            />

            {/* Statuts et workflow drawer */}
            <MissionStatusWorkflowDrawer
                isOpen={showStatusWorkflowDrawer}
                onClose={() => setShowStatusWorkflowDrawer(false)}
                missionId={mission.id}
                missionName={mission.name}
            />

            {/* List right-click context menu (delete) */}
            <ContextMenu
                items={listContextMenuItems}
                position={listMenuPosition}
                onClose={closeListMenu}
            />

            {/* Delete list confirmation */}
            <ConfirmModal
                isOpen={showDeleteListModal}
                onClose={() => {
                    setShowDeleteListModal(false);
                    setListToDelete(null);
                    closeListMenu();
                }}
                onConfirm={handleDeleteList}
                title="Supprimer la liste ?"
                message={listToDelete ? `Êtes-vous sûr de vouloir supprimer "${listToDelete.name}" ? Les sociétés et contacts associés seront également supprimés.` : ""}
                confirmText="Supprimer"
                variant="danger"
                isLoading={isDeletingList}
            />

            {/* Assign SDR Modal */}
            {showAssignSDRModal && (
                <div className="fixed inset-0 dev-modal-overlay z-50 flex items-center justify-center p-4">
                    <div className="dev-modal w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                                <Users className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Assigner un SDR</h2>
                                <p className="text-sm text-slate-500">Sélectionnez un SDR à assigner</p>
                            </div>
                        </div>
                        <Select
                            label="SDR"
                            placeholder="Sélectionner un SDR..."
                            options={availableSDRs.map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                            value={selectedSDRId}
                            onChange={setSelectedSDRId}
                            searchable
                        />
                        {availableSDRs.length === 0 && (
                            <p className="text-sm text-slate-500 mt-2">Tous les SDRs sont déjà assignés à cette mission</p>
                        )}
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
                            <button onClick={() => setShowAssignSDRModal(false)} className="h-10 px-5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Annuler</button>
                            <button onClick={handleAssignSDR} disabled={!selectedSDRId || isAssigning} className="mgr-btn-primary h-10 px-5 text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                                {isAssigning ? <><Loader2 className="w-4 h-4 animate-spin" /> Assignation...</> : <><UserPlus className="w-4 h-4" /> Assigner</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign BD Modal */}
            {showAssignBDModal && (
                <div className="fixed inset-0 dev-modal-overlay z-50 flex items-center justify-center p-4">
                    <div className="dev-modal w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                                <Briefcase className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Assigner un BD</h2>
                                <p className="text-sm text-slate-500">Sélectionnez un Business Developer à assigner</p>
                            </div>
                        </div>
                        <Select
                            label="BD"
                            placeholder="Sélectionner un BD..."
                            options={availableBDs.map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                            value={selectedBDId}
                            onChange={setSelectedBDId}
                            searchable
                        />
                        {availableBDs.length === 0 && (
                            <p className="text-sm text-slate-500 mt-2">Tous les BDs sont déjà assignés à cette mission</p>
                        )}
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
                            <button onClick={() => setShowAssignBDModal(false)} className="h-10 px-5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Annuler</button>
                            <button onClick={handleAssignBD} disabled={!selectedBDId || isAssigning} className="h-10 px-5 text-sm font-medium text-violet-600 bg-violet-100 hover:bg-violet-200 rounded-lg disabled:opacity-50 flex items-center gap-2">
                                {isAssigning ? <><Loader2 className="w-4 h-4 animate-spin" /> Assignation...</> : <><UserPlus className="w-4 h-4" /> Assigner</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
