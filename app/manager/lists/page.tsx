"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, Badge, Button, Select, ConfirmModal, ContextMenu, useContextMenu, useToast } from "@/components/ui";
import {
    List,
    Building2,
    Users,
    Plus,
    Upload,
    Search,
    Filter,
    MoreVertical,
    Eye,
    Trash2,
    RefreshCw,
    Download,
    Database, // newly added for search tab
    Edit,
} from "lucide-react";
import Link from "next/link";
import { ListingSearchTab } from "@/components/listing/ListingSearchTab";
import type { ListingResult } from "@/components/listing/ListingSearchTab";
import { ImportToListModal } from "@/components/listing/ImportToListModal";

// ============================================
// TYPES
// ============================================

interface ListData {
    id: string;
    name: string;
    type: "SUZALI" | "CLIENT" | "MIXED";
    source?: string;
    createdAt: string;
    mission?: {
        id: string;
        name: string;
    };
    _count: {
        companies: number;
    };
    stats?: {
        companyCount: number;
        contactCount: number;
        completeness: {
            INCOMPLETE: number;
            PARTIAL: number;
            ACTIONABLE: number;
        };
    };
}


// ============================================
// TYPE STYLES
// ============================================

const TYPE_STYLES = {
    SUZALI: { label: "Suzali", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    CLIENT: { label: "Client", color: "bg-amber-50 text-amber-700 border-amber-200" },
    MIXED: { label: "Mixte", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
};

// ============================================
// LISTS PAGE
// ============================================

const LISTS_QUERY_KEY = ["manager", "lists"] as const;

async function fetchListsApi(): Promise<ListData[]> {
    const res = await fetch("/api/lists");
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Impossible de charger les listes");
    return json.data;
}

export default function ListsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();
    const { data: lists = [], isLoading, isFetching, refetch } = useQuery({
        queryKey: LISTS_QUERY_KEY,
        queryFn: fetchListsApi,
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingList, setDeletingList] = useState<ListData | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { position, contextData, handleContextMenu, close: closeMenu } = useContextMenu();

    // ============================================
    // TABS (Lists vs Search)
    // ============================================
    const [activeTab, setActiveTab] = useState<"lists" | "search">("lists");
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [resultsToImport, setResultsToImport] = useState<ListingResult[]>([]);

    const handleImportRequest = (results: ListingResult[]) => {
        setResultsToImport(results);
        setImportModalOpen(true);
    };

    const handleImportComplete = () => {
        setImportModalOpen(false);
        setResultsToImport([]);
        setActiveTab("lists");
        queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY });
    };


    // ============================================
    // DELETE LIST
    // ============================================

    const handleDeleteList = async () => {
        if (!deletingList) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/lists/${deletingList.id}`, {
                method: "DELETE",
            });
            const json = await res.json();

            if (json.success) {
                success("Liste supprimée", `${deletingList.name} a été supprimée`);
                queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY });
            } else {
                showError("Erreur", json.error || "Impossible de supprimer");
            }
        } catch (err) {
            showError("Erreur", "Impossible de supprimer la liste");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
            setDeletingList(null);
        }
    };

    // ============================================
    // CONTEXT MENU ITEMS
    // ============================================

    const getContextMenuItems = (list: ListData) => [
        {
            label: "Voir les détails",
            icon: <Eye className="w-4 h-4" />,
            onClick: () => router.push(`/manager/lists/${list.id}`),
        },
        {
            label: "Modifier",
            icon: <Edit className="w-4 h-4" />,
            onClick: () => router.push(`/manager/lists/${list.id}/edit`),
        },
        {
            label: "Exporter CSV",
            icon: <Download className="w-4 h-4" />,
            onClick: () => window.open(`/api/lists/${list.id}/export`, "_blank"),
        },
        {
            label: "Supprimer",
            icon: <Trash2 className="w-4 h-4" />,
            onClick: () => {
                setDeletingList(list);
                setShowDeleteModal(true);
            },
            variant: "danger" as const,
            divider: true,
        },
    ];

    // ============================================
    // FILTER LISTS
    // ============================================

    const filteredLists = lists.filter(list => {
        const matchesSearch = !searchQuery ||
            list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            list.mission?.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = typeFilter === "all" || list.type === typeFilter;

        return matchesSearch && matchesType;
    });

    // ============================================
    // STATS
    // ============================================

    const stats = {
        total: lists.length,
        companies: lists.reduce((acc, l) => acc + (l._count?.companies || 0), 0),
        contacts: lists.reduce((acc, l) => acc + (l.stats?.contactCount || 0), 0),
    };

    return (
        <div className="space-y-6">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Listes & Prospection</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Gérez vos listes de sociétés et recherchez de nouveaux leads
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 shadow-inner mr-2">
                        <button
                            onClick={() => setActiveTab("lists")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === "lists"
                                ? "bg-white text-indigo-700 shadow border-b border-indigo-100"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            <List className={`w-4 h-4 ${activeTab === "lists" ? "text-indigo-500" : "text-slate-400"}`} />
                            Mes Listes
                        </button>
                        <button
                            onClick={() => setActiveTab("search")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === "search"
                                ? "bg-white text-indigo-700 shadow border-b border-indigo-100"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            <Database className={`w-4 h-4 ${activeTab === "search" ? "text-indigo-500" : "text-slate-400"}`} />
                            Recherche de Leads
                        </button>
                    </div>

                    {activeTab === "lists" && (
                        <>
                            <button
                                onClick={() => refetch()}
                                className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors tooltip-trigger"
                                title="Rafraîchir les listes"
                            >
                                <RefreshCw className={`w-4 h-4 text-slate-500 ${isFetching ? "animate-spin" : ""}`} />
                            </button>
                            <Link
                                href="/manager/lists/import"
                                className="flex items-center gap-2 h-10 px-5 text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors shadow-sm"
                            >
                                <Upload className="w-4 h-4" />
                                Importer CSV
                            </Link>
                        </>
                    )}
                </div>
            </div>

            {activeTab === "lists" ? (
                <>
                    {/* Premium Stats Cards */}
                    {isLoading ? (
                        <div className="grid grid-cols-3 gap-5">
                            <div className="mgr-stat-card animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>
                            <div className="mgr-stat-card animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>
                            <div className="mgr-stat-card animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-5">
                            <div className="mgr-stat-card">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                                        <List className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                                        <p className="text-sm font-medium text-slate-500">Listes totales</p>
                                    </div>
                                </div>
                            </div>
                            <div className="mgr-stat-card">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                        <Building2 className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900">{stats.companies}</p>
                                        <p className="text-sm font-medium text-slate-500">Sociétés couvertes</p>
                                    </div>
                                </div>
                            </div>
                            <div className="mgr-stat-card">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                                        <Users className="w-6 h-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900">{stats.contacts}</p>
                                        <p className="text-sm font-medium text-slate-500">Contacts individuels</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Premium Filters */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Rechercher une liste par nom ou par mission..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="mgr-search-input w-full h-11 pl-12 pr-10 text-sm font-medium text-slate-900 bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-lg transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="h-11 px-4 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 cursor-pointer transition-all"
                        >
                            <option value="all">Tous les types</option>
                            <option value="SUZALI">🔮 Suzali</option>
                            <option value="CLIENT">🏢 Client</option>
                            <option value="MIXED">🔄 Mixte</option>
                        </select>
                    </div>

                    {/* Lists Grid */}
                    {isLoading && lists.length === 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse">
                                    <div className="flex items-center gap-4 mb-5">
                                        <div className="w-12 h-12 bg-slate-100 rounded-xl" />
                                        <div className="space-y-2 flex-1">
                                            <div className="h-4 bg-slate-100 rounded w-1/2" />
                                            <div className="h-3 bg-slate-100 rounded w-1/3" />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="h-2 bg-slate-100 rounded w-full" />
                                        <div className="h-8 bg-slate-100 rounded w-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredLists.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100/50 flex items-center justify-center mx-auto mb-6 shadow-sm shadow-indigo-500/5">
                                <List className="w-10 h-10 text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                {searchQuery || typeFilter !== "all"
                                    ? "Aucune liste ne correspond à vos critères"
                                    : "Aucune liste de contacts"}
                            </h3>
                            <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto">
                                {searchQuery || typeFilter !== "all"
                                    ? "Essayez de modifier vos filtres ou votre terme de recherche."
                                    : "Commencez par importer une base de données existante ou créez une nouvelle liste depuis zéro."}
                            </p>
                            {!searchQuery && typeFilter === "all" && (
                                <div className="flex items-center justify-center gap-4">
                                    <Link href="/manager/lists/import" className="flex items-center gap-2 h-11 px-6 text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors shadow-sm">
                                        <Upload className="w-4 h-4" />
                                        Importer un CSV
                                    </Link>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredLists.map((list, index) => {
                                const totalContacts = list.stats?.contactCount || 0;
                                const actionablePercent = totalContacts > 0
                                    ? Math.round(((list.stats?.completeness?.ACTIONABLE || 0) / totalContacts) * 100)
                                    : 0;

                                return (
                                    <div
                                        key={list.id}
                                        onClick={() => router.push(`/manager/lists/${list.id}`)}
                                        onContextMenu={(e) => handleContextMenu(e, list)}
                                        className="group bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 relative overflow-hidden flex flex-col"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        {/* Subtle gradient background effect on hover */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                                        <div className="flex items-start justify-between mb-5 relative z-10">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 group-hover:shadow-md group-hover:border-indigo-200 flex-shrink-0">
                                                    <List className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate text-base">{list.name}</h3>
                                                    <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                                                        {list.mission?.name || <span className="text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">Sans mission assignée</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border ${TYPE_STYLES[list.type].color}`}>
                                                    {TYPE_STYLES[list.type].label}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleContextMenu(e, list);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Stats block */}
                                        <div className="flex items-center gap-4 mb-5 p-3 rounded-xl bg-slate-50/50 border border-slate-100 group-hover:border-indigo-100/50 transition-colors relative z-10">
                                            <div className="flex-1 text-center">
                                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sociétés</span>
                                                </div>
                                                <p className="text-lg font-bold text-slate-900">{list._count?.companies || 0}</p>
                                            </div>
                                            <div className="w-px h-8 bg-slate-200" />
                                            <div className="flex-1 text-center">
                                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contacts</span>
                                                </div>
                                                <p className="text-lg font-bold text-slate-900">{totalContacts}</p>
                                            </div>
                                        </div>

                                        {/* Completeness logic */}
                                        <div className="mt-auto relative z-10">
                                            {totalContacts > 0 ? (
                                                <div className="space-y-2.5">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="font-medium text-slate-500">Qualité de la donnée</span>
                                                        <span className={`font-bold ${actionablePercent >= 80 ? 'text-emerald-600' : actionablePercent >= 50 ? 'text-amber-600' : 'text-slate-600'}`}>
                                                            {actionablePercent}% actionnable
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                                                        <div
                                                            className="h-full bg-rose-400 transition-all duration-1000"
                                                            style={{ width: `${((list.stats?.completeness?.INCOMPLETE || 0) / totalContacts) * 100}%` }}
                                                        />
                                                        <div
                                                            className="h-full bg-amber-400 transition-all duration-1000 delay-100"
                                                            style={{ width: `${((list.stats?.completeness?.PARTIAL || 0) / totalContacts) * 100}%` }}
                                                        />
                                                        <div
                                                            className="h-full bg-emerald-500 transition-all duration-1000 delay-200"
                                                            style={{ width: `${((list.stats?.completeness?.ACTIONABLE || 0) / totalContacts) * 100}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 mt-1">
                                                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-400" /> {list.stats?.completeness?.INCOMPLETE || 0}</span>
                                                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {list.stats?.completeness?.PARTIAL || 0}</span>
                                                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {list.stats?.completeness?.ACTIONABLE || 0}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-[76px] flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                    <p className="text-xs font-medium text-slate-500">Aucun contact importé</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 text-[10px] font-semibold text-slate-400 relative z-10">
                                            <span className="uppercase tracking-wider">Source: {list.source || "Inconnue"}</span>
                                            <span className="uppercase tracking-wider">Créée le {new Date(list.createdAt).toLocaleDateString("fr-FR")}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-h-[600px] flex flex-col">
                    <ListingSearchTab onImport={handleImportRequest} />
                </div>
            )}

            <ImportToListModal
                isOpen={importModalOpen}
                onClose={() => {
                    setImportModalOpen(false);
                    setResultsToImport([]);
                }}
                results={resultsToImport}
                onImportComplete={handleImportComplete}
            />

            {/* Context Menu */}
            <ContextMenu
                items={contextData ? getContextMenuItems(contextData) : []}
                position={position}
                onClose={closeMenu}
            />

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setDeletingList(null);
                }}
                onConfirm={handleDeleteList}
                title="Supprimer la liste ?"
                message={`Êtes-vous sûr de vouloir supprimer "${deletingList?.name}" ? Cette action supprimera également toutes les sociétés et contacts associés.`}
                confirmText="Supprimer"
                variant="danger"
                isLoading={isDeleting}
            />

        </div>
    );
}
