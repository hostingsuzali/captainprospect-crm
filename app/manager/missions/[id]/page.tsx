"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalFooter, Select, ConfirmModal, ContextMenu, useContextMenu, useToast } from "@/components/ui";
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
    UserMinus,
    FileText,
    Plus,
    X,
    Eye,
    ListChecks,
} from "lucide-react";
import Link from "next/link";

// ============================================
// TYPES
// ============================================

interface Mission {
    id: string;
    name: string;
    objective?: string;
    channel: "CALL" | "EMAIL" | "LINKEDIN";
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
    const [showStatusWorkflowDrawer, setShowStatusWorkflowDrawer] = useState(false);

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

    const channel = CHANNEL_CONFIG[mission.channel];
    const ChannelIcon = channel.icon;

    return (
        <div className="space-y-6">
            {/* Premium Hero Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 text-white">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-50" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <Link
                            href="/manager/missions"
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-xl font-bold">
                            {mission.client?.name?.[0] || "M"}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 flex-wrap mb-1">
                                <h1 className="text-2xl font-bold">{mission.name}</h1>
                                <span className={mission.isActive ? "mgr-badge-active" : "mgr-badge-paused"}>
                                    {mission.isActive ? "Actif" : "Pause"}
                                </span>
                                <span className={`mgr-channel-badge ${channel.className}`}>
                                    <ChannelIcon className="w-3 h-3" />
                                    {channel.label}
                                </span>
                            </div>
                            <p className="text-slate-400">
                                {mission.client?.name}
                                {mission.objective && ` · ${mission.objective}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleActive}
                            disabled={isToggling}
                            className="flex items-center gap-2 h-9 px-4 text-sm font-medium bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg transition-colors"
                        >
                            {isToggling ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : mission.isActive ? (
                                <PauseCircle className="w-4 h-4" />
                            ) : (
                                <PlayCircle className="w-4 h-4" />
                            )}
                            {mission.isActive ? "Pause" : "Activer"}
                        </button>
                        <Link
                            href={`/manager/missions/${mission.id}/edit`}
                            className="flex items-center gap-2 h-9 px-4 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <Edit className="w-4 h-4" />
                            Modifier
                        </Link>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Premium Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                <div className="mgr-stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <Users className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{assignedSDRs.length}</p>
                            <p className="text-sm text-slate-500">SDRs assignés</p>
                        </div>
                    </div>
                </div>
                <div className="mgr-stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                            <Briefcase className="w-6 h-6 text-violet-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{assignedBDs.length}</p>
                            <p className="text-sm text-slate-500">BDs assignés</p>
                        </div>
                    </div>
                </div>
                <div className="mgr-stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <Target className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{mission.campaigns.length > 0 ? "Oui" : "Non"}</p>
                            <p className="text-sm text-slate-500">Stratégie</p>
                        </div>
                    </div>
                </div>
                <div className="mgr-stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                            <ListIcon className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{mission._count.lists}</p>
                            <p className="text-sm text-slate-500">Listes</p>
                        </div>
                    </div>
                </div>
                <div className="mgr-stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-cyan-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-900">
                                {mission.startDate ? new Date(mission.startDate).toLocaleDateString("fr-FR") : "-"}
                            </p>
                            <p className="text-xs text-slate-500">
                                → {mission.endDate ? new Date(mission.endDate).toLocaleDateString("fr-FR") : "En cours"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Team lead: who can see all teammates' rappels and notes */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-amber-500">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Eye className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Responsable d&apos;équipe</h2>
                            <p className="text-sm text-slate-500">Voit tous les rappels et notes des membres de la mission</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 min-w-[220px]">
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
                        {isSavingTeamLead && <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />}
                    </div>
                </div>
            </div>

            {/* Statuts et workflow */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-teal-500">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                            <ListChecks className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Statuts et workflow</h2>
                            <p className="text-sm text-slate-500">Statuts d&apos;appel et priorités pour cette mission</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowStatusWorkflowDrawer(true)}
                        className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                    >
                        Gérer les statuts
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* SDRs & BDs two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: SDRs */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-indigo-500">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-indigo-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900">SDRs</h2>
                        </div>
                        <button
                            onClick={() => {
                                fetchAvailableSDRs();
                                setShowAssignSDRModal(true);
                            }}
                            className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                            <UserPlus className="w-4 h-4" />
                            Assigner
                        </button>
                    </div>
                    {assignedSDRs.length === 0 ? (
                        <div className="text-center py-10">
                            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">Aucun SDR assigné</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar" aria-label="Liste des SDRs assignés">
                            {assignedSDRs.map((assignment) => (
                                <div
                                    key={assignment.id}
                                    className="mgr-mission-card flex items-center gap-4 p-4"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                                        {assignment.sdr.name.split(" ").map(n => n[0]).join("")}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-900 truncate">{assignment.sdr.name}</p>
                                        <p className="text-sm text-slate-500 truncate">{assignment.sdr.email}</p>
                                    </div>
                                    <button
                                        onClick={() => handleUnassign(assignment.sdr.id)}
                                        disabled={unassigningId === assignment.sdr.id}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                                        title="Retirer de la mission"
                                    >
                                        {unassigningId === assignment.sdr.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <UserMinus className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: BDs */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-violet-500">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                                <Briefcase className="w-5 h-5 text-violet-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900">BDs</h2>
                        </div>
                        <button
                            onClick={() => {
                                fetchAvailableBDs();
                                setShowAssignBDModal(true);
                            }}
                            className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                        >
                            <UserPlus className="w-4 h-4" />
                            Assigner
                        </button>
                    </div>
                    {assignedBDs.length === 0 ? (
                        <div className="text-center py-10">
                            <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">Aucun BD assigné</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar" aria-label="Liste des BDs assignés">
                            {assignedBDs.map((assignment) => (
                                <div
                                    key={assignment.id}
                                    className="mgr-mission-card flex items-center gap-4 p-4"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center text-xs font-bold text-violet-600 shrink-0">
                                        {assignment.sdr.name.split(" ").map(n => n[0]).join("")}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-900 truncate">{assignment.sdr.name}</p>
                                        <p className="text-sm text-slate-500 truncate">{assignment.sdr.email}</p>
                                    </div>
                                    <button
                                        onClick={() => handleUnassign(assignment.sdr.id)}
                                        disabled={unassigningId === assignment.sdr.id}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                                        title="Retirer de la mission"
                                    >
                                        {unassigningId === assignment.sdr.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <UserMinus className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Campaigns Section — inline view */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <Target className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Stratégie & Script</h2>
                            <p className="text-sm text-slate-500">ICP, pitch et script de prospection</p>
                        </div>
                    </div>
                    {mission.campaigns.length > 0 && (
                        <Link
                            href={`/manager/campaigns/${mission.campaigns[0].id}`}
                            className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                            <Edit className="w-4 h-4" />
                            Modifier
                        </Link>
                    )}
                </div>

                {mission.campaigns.length === 0 ? (
                    <div className="text-center py-12">
                        <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">Aucune stratégie configurée</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {mission.campaigns.slice(0, 1).map((campaign) => (
                            <div key={campaign.id} className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={campaign.isActive ? "mgr-badge-active" : "mgr-badge-paused"}>
                                        {campaign.isActive ? "Actif" : "Pause"}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500">
                                    Consultez et modifiez l&apos;ICP, le pitch et le script via la page de détails de la campagne.
                                </p>
                                <Link
                                    href={`/manager/campaigns/${campaign.id}`}
                                    className="mgr-mission-card group flex items-center gap-4 p-4 block"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <Target className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">Voir le script & la stratégie</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Lists Section */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
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
                    <div className="text-center py-12">
                        <ListIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">Aucune liste</p>
                    </div>
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
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
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

            {/* Email Templates Section */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-indigo-500">
                <div className="flex items-center justify-between mb-6">
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
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    </div>
                ) : missionTemplates.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-base font-medium text-slate-900 mb-1">Aucun template</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Ajoutez des templates pour permettre l'envoi rapide d'emails
                        </p>
                        <button
                            onClick={() => {
                                fetchAvailableTemplates();
                                setShowAddTemplateModal(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Ajouter un template
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {missionTemplates.map((mt) => (
                            <div
                                key={mt.id}
                                className="group flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-medium text-slate-900 truncate">{mt.template.name}</p>
                                        <span className="px-2 py-0.5 text-xs font-medium text-indigo-600 bg-indigo-100 rounded-full">
                                            {mt.template.category}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 truncate">{mt.template.subject}</p>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setPreviewTemplate(mt.template);
                                            setShowPreviewModal(true);
                                        }}
                                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Prévisualiser"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleRemoveTemplate(mt.template.id)}
                                        disabled={removingTemplateId === mt.template.id}
                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        title="Retirer"
                                    >
                                        {removingTemplateId === mt.template.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <X className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
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
                                    <p className="text-sm text-slate-500">
                                        Créez des templates partagés dans la section Email
                                    </p>
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
