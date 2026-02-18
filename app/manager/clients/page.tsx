"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui";
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

    // Drawer state
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [showDrawer, setShowDrawer] = useState(false);

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

    useEffect(() => {
        fetchClients();
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

    // ============================================
    // HANDLE ONBOARDING SUCCESS
    // ============================================

    const handleOnboardingSuccess = (clientId: string) => {
        fetchClients();
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredClients.map((client, index) => (
                        <div
                            key={client.id}
                            onClick={() => handleClientClick(client)}
                            className="mgr-client-card group block cursor-pointer"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-xl font-bold text-indigo-600 group-hover:scale-110 transition-transform duration-300">
                                        {client.name[0]}
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-slate-300 -rotate-45 group-hover:rotate-0 group-hover:text-indigo-500 transition-all duration-300" />
                                </div>

                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                        {client.name}
                                    </h3>
                                    <p className="text-sm text-slate-500 font-medium">
                                        {client.industry || "Secteur non spécifié"}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    {client.email && (
                                        <div className="flex items-center gap-2.5 text-sm text-slate-600">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                                <Mail className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <span className="truncate">{client.email}</span>
                                        </div>
                                    )}
                                    {client.phone && (
                                        <div className="flex items-center gap-2.5 text-sm text-slate-600">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                                <Phone className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <span>{client.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-6">
                                <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Missions</p>
                                    <p className="text-lg font-bold text-slate-900">{client._count.missions}</p>
                                </div>
                                <div className="w-px h-8 bg-slate-200" />
                                <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Utilisateurs</p>
                                    <p className="text-lg font-bold text-slate-900">{client._count.users}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Client Drawer */}
            <ClientDrawer
                isOpen={showDrawer}
                onClose={() => setShowDrawer(false)}
                client={selectedClient}
                onUpdate={handleClientUpdate}
            />

            {/* Client Onboarding Modal */}
            <ClientOnboardingModal
                isOpen={showOnboardingModal}
                onClose={() => setShowOnboardingModal(false)}
                onSuccess={handleOnboardingSuccess}
            />
        </div>
    );
}
