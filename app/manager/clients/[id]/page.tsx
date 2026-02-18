"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
    Card,
    Button,
    Badge,
    ConfirmModal,
    Modal,
    ModalFooter,
    Skeleton,
    useToast,
    Input
} from "@/components/ui";
import {
    ArrowLeft,
    Edit,
    Trash2,
    Building2,
    Target,
    Users,
    Mail,
    Phone,
    Plus,
    TrendingUp,
    Calendar,
    CheckCircle2,
    XCircle,
    Copy,
    CalendarCheck,
    User,
    Briefcase,
    FileText
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface Mission {
    id: string;
    name: string;
    channel: "CALL" | "EMAIL" | "LINKEDIN";
    isActive: boolean;
    startDate: string;
    endDate?: string;
    _count: {
        campaigns: number;
        lists: number;
    };
}

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
}

interface Client {
    id: string;
    name: string;
    industry?: string;
    email?: string;
    phone?: string;
    createdAt: string;
    _count: {
        missions: number;
        users: number;
    };
    missions?: Mission[];
    users?: User[];
}

interface Meeting {
    id: string;
    createdAt: string;
    contact: {
        id: string;
        firstName?: string;
        lastName?: string;
        title?: string;
        email?: string;
        company: {
            id: string;
            name: string;
            industry?: string;
        };
    };
    campaign: {
        id: string;
        name: string;
        missionId: string;
        mission: {
            id: string;
            name: string;
        };
    };
    sdr: {
        id: string;
        name: string;
        email: string;
    };
}

interface MeetingsData {
    totalMeetings: number;
    byMission: Array<{
        missionId: string;
        missionName: string;
        count: number;
        meetings: Meeting[];
    }>;
    byCampaign: Array<{
        campaignId: string;
        campaignName: string;
        missionId: string;
        missionName: string;
        count: number;
        meetings: Meeting[];
    }>;
    allMeetings: Meeting[];
}

const CHANNEL_LABELS = {
    CALL: "Appel",
    EMAIL: "Email",
    LINKEDIN: "LinkedIn",
};

// ============================================
// CLIENT DETAIL PAGE
// ============================================

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { success, error: showError } = useToast();

    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState({
        name: "",
        industry: "",
        email: "",
        phone: "",
        bookingUrl: "",
    });
    const [meetingsData, setMeetingsData] = useState<MeetingsData | null>(null);
    const [isLoadingMeetings, setIsLoadingMeetings] = useState(true);

    // ============================================
    // FETCH CLIENT
    // ============================================

    const fetchClient = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/clients/${resolvedParams.id}`);
            const json = await res.json();

            if (json.success) {
                setClient(json.data);
                setEditFormData({
                    name: json.data.name,
                    industry: json.data.industry || "",
                    email: json.data.email || "",
                    phone: json.data.phone || "",
                    bookingUrl: json.data.bookingUrl || "",
                });
            } else {
                showError("Erreur", json.error);
                router.push("/manager/clients");
            }
        } catch (err) {
            console.error("Failed to fetch client:", err);
            showError("Erreur", "Impossible de charger le client");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClient();
    }, [resolvedParams.id]);

    // ============================================
    // FETCH MEETINGS
    // ============================================

    const fetchMeetings = async () => {
        if (!resolvedParams.id) return;
        setIsLoadingMeetings(true);
        try {
            const res = await fetch(`/api/clients/${resolvedParams.id}/meetings`);
            const json = await res.json();
            if (json.success) {
                setMeetingsData(json.data);
            }
        } catch (err) {
            console.error("Failed to fetch meetings:", err);
        } finally {
            setIsLoadingMeetings(false);
        }
    };

    useEffect(() => {
        if (client) {
            fetchMeetings();
        }
    }, [client]);

    // ============================================
    // UPDATE CLIENT
    // ============================================

    const handleUpdate = async () => {
        if (!client) return;

        try {
            const res = await fetch(`/api/clients/${client.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editFormData),
            });

            const json = await res.json();

            if (json.success) {
                setClient(json.data);
                setShowEditModal(false);
                success("Client mis à jour", `${editFormData.name} a été mis à jour`);
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            showError("Erreur", "Impossible de mettre à jour le client");
        }
    };

    // ============================================
    // DELETE CLIENT
    // ============================================

    const handleDelete = async () => {
        if (!client) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/clients/${client.id}`, {
                method: "DELETE",
            });

            const json = await res.json();

            if (json.success) {
                success("Client supprimé", `${client.name} a été supprimé`);
                router.push("/manager/clients");
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            showError("Erreur", "Impossible de supprimer le client");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    // ============================================
    // LOADING STATE
    // ============================================

    if (isLoading) {
        return (
            <div className="space-y-8 max-w-7xl mx-auto">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-32 rounded-2xl" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-6">
                        <Skeleton className="h-64 rounded-2xl" />
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                        <Skeleton className="h-96 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (!client) {
        return null;
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <Link href="/manager/clients">
                        <Button variant="ghost" className="h-12 w-12 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 shadow-sm p-0 flex items-center justify-center">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-3xl font-bold text-white">
                            {client.name[0]}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{client.name}</h1>
                            <div className="flex items-center gap-2 mt-1.5">
                                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                                    {client.industry || "Secteur non défini"}
                                </Badge>
                                <span className="text-slate-300">•</span>
                                <span className="text-sm text-slate-500">
                                    Créé le {new Date(client.createdAt).toLocaleDateString("fr-FR")}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => setShowEditModal(true)}
                        className="gap-2 bg-white border border-slate-200 text-slate-600 shadow-sm hover:bg-slate-50"
                    >
                        <Edit className="w-4 h-4" />
                        Modifier
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => setShowDeleteModal(true)}
                        className="gap-2 shadow-sm"
                    >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Missions totales</p>
                            <p className="text-3xl font-bold text-slate-900 mt-2">{client._count.missions}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                            <Target className="w-6 h-6 text-indigo-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Utilisateurs actifs</p>
                            <p className="text-3xl font-bold text-slate-900 mt-2">{client._count.users}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                            <Users className="w-6 h-6 text-emerald-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Missions en cours</p>
                            <p className="text-3xl font-bold text-slate-900 mt-2">
                                {client.missions?.filter(m => m.isActive).length || 0}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-amber-600" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">RDV pris</p>
                            <p className="text-3xl font-bold text-slate-900 mt-2">
                                {meetingsData?.totalMeetings || 0}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                            <CalendarCheck className="w-6 h-6 text-rose-600" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Meetings Section */}
            {meetingsData && meetingsData.totalMeetings > 0 && (
                <Card className="border-slate-200">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-slate-900 flex items-center gap-2">
                                <CalendarCheck className="w-5 h-5 text-rose-500" />
                                Rendez-vous pris ({meetingsData.totalMeetings})
                            </h2>
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                                {meetingsData.byMission.length > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <Target className="w-4 h-4" />
                                        {meetingsData.byMission.length} mission{meetingsData.byMission.length > 1 ? 's' : ''}
                                    </span>
                                )}
                                {meetingsData.byCampaign.length > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <FileText className="w-4 h-4" />
                                        {meetingsData.byCampaign.length} campagne{meetingsData.byCampaign.length > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {/* Compact Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                            {meetingsData.byMission.map((missionGroup) => (
                                <div
                                    key={missionGroup.missionId}
                                    className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <Target className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                            <h4 className="font-semibold text-slate-900 text-sm truncate">
                                                {missionGroup.missionName}
                                            </h4>
                                        </div>
                                        <Badge variant="primary" className="text-xs flex-shrink-0 ml-2">
                                            {missionGroup.count}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {missionGroup.meetings.slice(0, 4).map((meeting) => (
                                            <span
                                                key={meeting.id}
                                                className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-slate-200 text-slate-700"
                                                title={`${meeting.contact.firstName} ${meeting.contact.lastName} - ${meeting.contact.company.name}`}
                                            >
                                                <User className="w-3 h-3 text-slate-400" />
                                                <span className="truncate max-w-[120px]">
                                                    {meeting.contact.firstName} {meeting.contact.lastName}
                                                </span>
                                            </span>
                                        ))}
                                        {missionGroup.meetings.length > 4 && (
                                            <span className="inline-flex items-center text-xs text-slate-500 px-2 py-1">
                                                +{missionGroup.meetings.length - 4}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Compact Meetings Table */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Liste des rendez-vous
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                                {meetingsData.allMeetings.map((meeting) => (
                                    <div
                                        key={meeting.id}
                                        className="px-4 py-3 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                                                    <User className="w-4 h-4 text-rose-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-slate-900 text-sm">
                                                            {meeting.contact.firstName} {meeting.contact.lastName}
                                                        </span>
                                                        {meeting.contact.title && (
                                                            <>
                                                                <span className="text-slate-300">•</span>
                                                                <span className="text-xs text-slate-500">{meeting.contact.title}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-600">
                                                        <span className="flex items-center gap-1">
                                                            <Briefcase className="w-3 h-3 text-slate-400" />
                                                            {meeting.contact.company.name}
                                                        </span>
                                                        {meeting.contact.company.industry && (
                                                            <>
                                                                <span className="text-slate-300">•</span>
                                                                <span>{meeting.contact.company.industry}</span>
                                                            </>
                                                        )}
                                                        <span className="text-slate-300">•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Target className="w-3 h-3 text-slate-400" />
                                                            {meeting.campaign.mission.name}
                                                        </span>
                                                        <span className="text-slate-300">•</span>
                                                        <span>{meeting.campaign.name}</span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Users className="w-3 h-3 text-slate-400" />
                                                            {meeting.sdr.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-xs font-medium text-slate-900">
                                                    {new Date(meeting.createdAt).toLocaleDateString("fr-FR", {
                                                        day: "numeric",
                                                        month: "short",
                                                    })}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {new Date(meeting.createdAt).toLocaleTimeString("fr-FR", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Contact & Team */}
                <div className="space-y-8">
                    {/* Contact Info */}
                    <Card className="overflow-hidden border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="font-semibold text-slate-900">Contact</h2>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-500 mb-0.5">Email</p>
                                    {client.email ? (
                                        <div className="flex items-center gap-2">
                                            <a href={`mailto:${client.email}`} className="text-slate-900 font-medium hover:text-indigo-600 truncate transition-colors">
                                                {client.email}
                                            </a>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(client.email || "");
                                                    success("Copié", "Email copié dans le presse-papier");
                                                }}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 text-sm italic">Non renseigné</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                    <Phone className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-500 mb-0.5">Téléphone</p>
                                    {client.phone ? (
                                        <div className="flex items-center gap-2">
                                            <a href={`tel:${client.phone}`} className="text-slate-900 font-medium hover:text-indigo-600 truncate transition-colors">
                                                {client.phone}
                                            </a>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(client.phone || "");
                                                    success("Copié", "Téléphone copié dans le presse-papier");
                                                }}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 text-sm italic">Non renseigné</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-500 mb-0.5">Secteur</p>
                                    <p className="text-slate-900 font-medium truncate">
                                        {client.industry || <span className="text-slate-400 italic font-normal">Non renseigné</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Team Members */}
                    <Card className="overflow-hidden border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="font-semibold text-slate-900">Utilisateurs</h2>
                        </div>
                        {client.users && client.users.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {client.users.map((user) => (
                                    <div key={user.id} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                                                    {user.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                                                    <p className="text-xs text-slate-500">{user.email}</p>
                                                </div>
                                            </div>
                                            <Badge className="text-xs bg-slate-50 border-slate-200 text-slate-600">
                                                {user.role}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-slate-500">
                                <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                                <p className="text-sm">Aucun utilisateur associé</p>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right Column: Missions */}
                <div className="lg:col-span-2">
                    <Card className="border-slate-200 h-full">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="font-bold text-slate-900 flex items-center gap-2">
                                <Target className="w-5 h-5 text-indigo-500" />
                                Missions
                            </h2>
                            <Link href={`/manager/missions/new?clientId=${client.id}`}>
                                <Button variant="primary" size="sm" className="gap-2 shadow-sm shadow-indigo-500/20">
                                    <Plus className="w-4 h-4" />
                                    Nouvelle mission
                                </Button>
                            </Link>
                        </div>

                        {client.missions && client.missions.length > 0 ? (
                            <div className="p-4 space-y-4">
                                {client.missions.map((mission) => (
                                    <Link key={mission.id} href={`/manager/missions/${mission.id}`}>
                                        <div className="group block bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-200">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                                        mission.isActive ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"
                                                    )}>
                                                        {mission.isActive ? (
                                                            <CheckCircle2 className="w-6 h-6" />
                                                        ) : (
                                                            <XCircle className="w-6 h-6" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                                                            {mission.name}
                                                            {!mission.isActive && (
                                                                <Badge variant="warning" className="text-xs">
                                                                    Inactive
                                                                </Badge>
                                                            )}
                                                        </h3>
                                                        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-sm text-slate-500 mt-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-medium text-slate-700">{CHANNEL_LABELS[mission.channel]}</span>
                                                            </div>
                                                            <span className="text-slate-300">•</span>
                                                            <span>
                                                                {mission._count.campaigns} campagne{mission._count.campaigns > 1 ? "s" : ""}
                                                            </span>
                                                            <span className="text-slate-300">•</span>
                                                            <span>
                                                                {mission._count.lists} liste{mission._count.lists > 1 ? "s" : ""}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex sm:flex-col items-center sm:items-end gap-1.5 text-sm text-slate-500 sm:text-right pl-16 sm:pl-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        <span>Début: {new Date(mission.startDate).toLocaleDateString("fr-FR")}</span>
                                                    </div>
                                                    {mission.endDate && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-3.5 text-center">→</span>
                                                            <span>Fin: {new Date(mission.endDate).toLocaleDateString("fr-FR")}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                    <Target className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="font-medium text-slate-900">Aucune mission</h3>
                                <p className="text-slate-500 mt-1 mb-6 text-sm max-w-xs mx-auto">
                                    Ce client n&apos;a pas encore de mission. Créez-en une pour commencer à prospecter.
                                </p>
                                <Link href={`/manager/missions/new?clientId=${client.id}`}>
                                    <Button variant="ghost" className="gap-2 border border-slate-200">
                                        <Plus className="w-4 h-4" />
                                        Créer une mission
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Edit Modal */}
            <Modal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                title="Modifier le client"
                description="Mettez à jour les informations du client"
            >
                <div className="space-y-5">
                    <Input
                        label="Nom du client *"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <Input
                        label="Secteur d'activité"
                        value={editFormData.industry}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, industry: e.target.value }))}
                    />
                    <Input
                        label="Email de contact"
                        type="email"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                        icon={<Mail className="w-4 h-4 text-slate-400" />}
                    />
                    <Input
                        label="Téléphone"
                        type="tel"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                        icon={<Phone className="w-4 h-4 text-slate-400" />}
                    />
                    <div>
                        <Input
                            label="URL de réservation (Calendly, etc.)"
                            type="url"
                            value={editFormData.bookingUrl}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, bookingUrl: e.target.value }))}
                            placeholder="https://calendly.com/client-name"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Les SDRs pourront utiliser cette URL pour planifier des rendez-vous lors des appels
                        </p>
                    </div>
                </div>
                <ModalFooter>
                    <Button variant="ghost" onClick={() => setShowEditModal(false)}>
                        Annuler
                    </Button>
                    <Button variant="primary" onClick={handleUpdate}>
                        Enregistrer
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Supprimer le client"
                message={`Êtes-vous sûr de vouloir supprimer "${client.name}" ? Toutes les missions et données associées seront également supprimées. Cette action est irréversible.`}
                confirmText="Supprimer"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
