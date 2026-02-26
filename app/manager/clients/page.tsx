"use client";

import { useState, useEffect } from "react";
import { useToast, Badge } from "@/components/ui";
import {
    Search,
    Plus,
    Building2,
    Target,
    Users,
    RefreshCw,
    Loader2,
    Mail,
    Phone,
    ArrowRight,
    X,
    FileText,
    ShieldCheck,
    ShieldAlert,
    Mic,
    ChevronDown,
    ChevronUp,
    Clock,
} from "lucide-react";
import Link from "next/link";
import { ClientOnboardingModal } from "@/components/manager/ClientOnboardingModal";
import { ClientDrawer } from "@/components/drawers";

// ============================================
// TYPES
// ============================================

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
}

interface LeexiRecapItem {
    id: string;
    title: string;
    date: string;
    duration: number;
    recapText: string;
    companyName: string;
}

interface LeexiMatchedGroup {
    clientId: string;
    clientName: string;
    recaps: LeexiRecapItem[];
}

interface LeexiRecapsData {
    matched: LeexiMatchedGroup[];
    unmatched: LeexiRecapItem[];
    totalRecaps: number;
    totalMatched: number;
}

// ============================================
// CLIENTS PAGE
// ============================================

export default function ClientsPage() {
    const { success, error: showError } = useToast();
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Onboarding modal
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);
    const [initialRecapText, setInitialRecapText] = useState<string | undefined>(undefined);

    // Drawer state
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [showDrawer, setShowDrawer] = useState(false);

    // Leexi recaps
    const [leexiData, setLeexiData] = useState<LeexiRecapsData | null>(null);
    const [isLoadingLeexi, setIsLoadingLeexi] = useState(false);
    const [leexiError, setLeexiError] = useState<string | null>(null);
    const [showLeexiSection, setShowLeexiSection] = useState(true);
    const [expandedRecapId, setExpandedRecapId] = useState<string | null>(null);

    // ============================================
    // FETCH CLIENTS
    // ============================================

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/clients");
            const json = await res.json();

            if (json.success) {
                setClients(json.data);
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            console.error("Failed to fetch clients:", err);
            showError("Erreur", "Impossible de charger les clients");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLeexiRecaps = async () => {
        setIsLoadingLeexi(true);
        setLeexiError(null);
        try {
            const res = await fetch("/api/leexi/recaps");
            const json = await res.json();
            if (json.success) {
                setLeexiData(json.data);
            } else {
                if (res.status !== 503) {
                    setLeexiError(json.error || "Erreur Leexi");
                }
            }
        } catch {
            // Leexi unavailable -- non-blocking
        } finally {
            setIsLoadingLeexi(false);
        }
    };

    useEffect(() => {
        fetchClients();
        fetchLeexiRecaps();
    }, []);

    // ============================================
    // FILTER CLIENTS
    // ============================================

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.industry?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ============================================
    // STATS
    // ============================================

    const totalClients = clients.length;
    const totalMissions = clients.reduce((acc, c) => acc + c._count.missions, 0);
    const totalUsers = clients.reduce((acc, c) => acc + c._count.users, 0);

    const getClientRecapCount = (clientId: string) => {
        if (!leexiData) return 0;
        const group = leexiData.matched.find((m) => m.clientId === clientId);
        return group?.recaps.length || 0;
    };

    // ============================================
    // HANDLE ONBOARDING SUCCESS
    // ============================================

    const handleOnboardingSuccess = (clientId: string) => {
        fetchClients();
        fetchLeexiRecaps();
    };

    const handleCreateFromRecap = (recapTextContent: string) => {
        setInitialRecapText(recapTextContent);
        setShowOnboardingModal(true);
    };

    const handleClientClick = (client: Client) => {
        setSelectedClient(client);
        setShowDrawer(true);
    };

    const handleClientUpdate = (updatedClient: Client) => {
        setClients(prev => prev.map(c => c.id === updatedClient.id ? { ...c, ...updatedClient } : c));
        setSelectedClient(prev => prev ? { ...prev, ...updatedClient } : null);
    };

    if (isLoading && clients.length === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-sm text-slate-500">Chargement des clients...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Premium Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Gérez votre portefeuille de clients et leurs activités
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchClients}
                        className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                    <Link
                        href="/manager/playbook/import"
                        className="flex items-center gap-2 h-10 px-5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        <FileText className="w-4 h-4" />
                        Importer un playbook
                    </Link>
                    <button
                        onClick={() => setShowOnboardingModal(true)}
                        className="mgr-btn-primary flex items-center gap-2 h-10 px-5 text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Nouveau client
                    </button>
                </div>
            </div>

            {/* Premium Stats */}
            <div className="grid grid-cols-3 gap-5">
                <div className="mgr-stat-card bg-gradient-to-br from-indigo-50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
                            <Building2 className="w-7 h-7 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-slate-900">{totalClients}</p>
                            <p className="text-sm font-medium text-slate-500">Clients totaux</p>
                        </div>
                    </div>
                </div>
                <div className="mgr-stat-card bg-gradient-to-br from-emerald-50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                            <Target className="w-7 h-7 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-slate-900">{totalMissions}</p>
                            <p className="text-sm font-medium text-slate-500">Missions actives</p>
                        </div>
                    </div>
                </div>
                <div className="mgr-stat-card bg-gradient-to-br from-amber-50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
                            <Users className="w-7 h-7 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-slate-900">{totalUsers}</p>
                            <p className="text-sm font-medium text-slate-500">Utilisateurs connectés</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Rechercher par nom, secteur..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mgr-search-input w-full h-12 pl-12 pr-4 text-sm text-slate-900"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                )}
            </div>

            {/* Leexi Recaps Section */}
            {leexiData && leexiData.totalRecaps > 0 && (
                <div className="bg-white border border-violet-200 rounded-2xl overflow-hidden">
                    <button
                        onClick={() => setShowLeexiSection(!showLeexiSection)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-violet-50/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                                <Mic className="w-5 h-5 text-violet-600" />
                            </div>
                            <div className="text-left">
                                <h3 className="text-sm font-semibold text-slate-900">
                                    Récapitulatifs Leexi
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {leexiData.totalMatched} associé{leexiData.totalMatched > 1 ? "s" : ""} · {leexiData.unmatched.length} non associé{leexiData.unmatched.length > 1 ? "s" : ""}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                                {leexiData.totalRecaps} recap{leexiData.totalRecaps > 1 ? "s" : ""}
                            </Badge>
                            {showLeexiSection ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                        </div>
                    </button>

                    {showLeexiSection && (
                        <div className="border-t border-violet-100 px-6 py-4 space-y-3 max-h-80 overflow-y-auto">
                            {leexiData.matched.map((group) => (
                                <div key={group.clientId} className="space-y-2">
                                    {group.recaps.map((recap) => (
                                        <div
                                            key={recap.id}
                                            className="p-3 bg-violet-50/50 border border-violet-100 rounded-xl"
                                        >
                                            <div
                                                className="flex items-center justify-between cursor-pointer"
                                                onClick={() => setExpandedRecapId(expandedRecapId === recap.id ? null : recap.id)}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Mic className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                                                    <span className="text-sm font-medium text-slate-900 truncate">
                                                        {recap.title}
                                                    </span>
                                                    <Badge variant="outline" className="text-[10px] bg-white border-violet-200 text-violet-600 flex-shrink-0">
                                                        {group.clientName}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(recap.date).toLocaleDateString("fr-FR")}
                                                    </span>
                                                    {expandedRecapId === recap.id ? (
                                                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                                    ) : (
                                                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                                    )}
                                                </div>
                                            </div>
                                            {expandedRecapId === recap.id && (
                                                <p className="mt-2 text-xs text-slate-600 whitespace-pre-line border-t border-violet-100 pt-2">
                                                    {recap.recapText.slice(0, 800)}
                                                    {recap.recapText.length > 800 && "..."}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}

                            {leexiData.unmatched.length > 0 && (
                                <div className="pt-2 border-t border-violet-100">
                                    <p className="text-xs font-medium text-slate-500 mb-2">
                                        Non associés ({leexiData.unmatched.length})
                                    </p>
                                    {leexiData.unmatched.slice(0, 5).map((recap) => (
                                        <div
                                            key={recap.id}
                                            className="p-3 bg-slate-50 border border-slate-100 rounded-xl mb-2"
                                        >
                                            <div
                                                className="flex items-center justify-between cursor-pointer"
                                                onClick={() => setExpandedRecapId(expandedRecapId === recap.id ? null : recap.id)}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Mic className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                                    <span className="text-sm font-medium text-slate-700 truncate">
                                                        {recap.title}
                                                    </span>
                                                    {recap.companyName && (
                                                        <span className="text-[10px] text-slate-400">
                                                            ({recap.companyName})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCreateFromRecap(recap.recapText);
                                                        }}
                                                        className="text-[10px] font-medium px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                                                    >
                                                        Créer client
                                                    </button>
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(recap.date).toLocaleDateString("fr-FR")}
                                                    </span>
                                                    {expandedRecapId === recap.id ? (
                                                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                                    ) : (
                                                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                                    )}
                                                </div>
                                            </div>
                                            {expandedRecapId === recap.id && (
                                                <div className="mt-2 border-t border-slate-100 pt-2 space-y-2">
                                                    <p className="text-xs text-slate-600 whitespace-pre-line">
                                                        {recap.recapText.slice(0, 800)}
                                                        {recap.recapText.length > 800 && "..."}
                                                    </p>
                                                    <button
                                                        onClick={() => handleCreateFromRecap(recap.recapText)}
                                                        className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        Créer le client depuis cet appel
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {isLoadingLeexi && !leexiData && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Chargement des récapitulatifs Leexi...
                </div>
            )}

            {leexiError && (
                <div className="text-xs text-red-500 flex items-center gap-1">
                    Leexi: {leexiError}
                </div>
            )}

            {/* Clients Grid */}
            {filteredClients.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <Building2 className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        {searchQuery ? "Aucun résultat trouvé" : "Aucun client"}
                    </h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                        {searchQuery
                            ? "Essayez de modifier vos termes de recherche."
                            : "Commencez par ajouter votre premier client."}
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={() => setShowOnboardingModal(true)}
                            className="mgr-btn-primary inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Ajouter un client
                        </button>
                    )}
                </div>
            ) : (
                <div className="lg">
                    {filteredClients.map((client, index) => {
                        const recapCount = getClientRecapCount(client.id);
                        const hasPortal = client._count.users > 0;
                        const recapPercent = Math.min(100, recapCount * 10);

                        return (
                            <div
                                key={client.id}
                                onClick={() => handleClientClick(client)}
                                className="lc mgr-client-card"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="lc-top">
                                    <div>
                                        <div className="lc-name">{client.name}</div>
                                        <div className="lc-mission">
                                            {client.industry || "Secteur non spécifié"}
                                        </div>
                                    </div>
                                </div>

                                <div className="lc-div" />

                                <div className="lc-met">
                                    <div className="met-col">
                                        <div className="met-v">{client._count.missions}</div>
                                        <div className="met-l">Missions</div>
                                    </div>
                                    <div className="met-sep" />
                                    <div className="met-col">
                                        <div className="met-v">{client._count.users}</div>
                                        <div className="met-l">Utilisateurs</div>
                                    </div>
                                </div>

                                {recapCount > 0 && (
                                    <>
                                        <div className="qr">
                                            <span className="ql">Récaps Leexi</span>
                                            <span className="qv">
                                                {recapCount} recap{recapCount > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="qbar">
                                            <div
                                                className="qfill"
                                                style={{
                                                    width: `${recapPercent}%`,
                                                    background: "var(--accent)",
                                                }}
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="lc-foot">
                                    <span className="tag">
                                        {hasPortal ? "Portail actif" : "Pas d'accès portail"}
                                    </span>
                                    <span className="lc-date">
                                        Créé le{" "}
                                        {new Date(client.createdAt).toLocaleDateString("fr-FR")}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Client Drawer */}
            <ClientDrawer
                isOpen={showDrawer}
                onClose={() => setShowDrawer(false)}
                client={selectedClient}
                onUpdate={handleClientUpdate}
                onDelete={() => {
                    setSelectedClient(null);
                    setShowDrawer(false);
                    fetchClients();
                }}
            />

            {/* Client Onboarding Modal */}
            <ClientOnboardingModal
                isOpen={showOnboardingModal}
                onClose={() => {
                    setShowOnboardingModal(false);
                    setInitialRecapText(undefined);
                }}
                onSuccess={handleOnboardingSuccess}
                initialRecapText={initialRecapText}
            />
        </div>
    );
}
