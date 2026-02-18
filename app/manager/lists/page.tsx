"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
    Edit,
    RefreshCw,
    Download,
} from "lucide-react";
import Link from "next/link";

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
    SUZALI: { label: "Suzali", color: "bg-indigo-50 text-indigo-600" },
    CLIENT: { label: "Client", color: "bg-amber-50 text-amber-600" },
    MIXED: { label: "Mixte", color: "bg-cyan-50 text-cyan-600" },
};

// ============================================
// LISTS PAGE
// ============================================

export default function ListsPage() {
    const router = useRouter();
    const { success, error: showError } = useToast();
    const [lists, setLists] = useState<ListData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingList, setDeletingList] = useState<ListData | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { position, contextData, handleContextMenu, close: closeMenu } = useContextMenu();

    // ============================================
    // FETCH LISTS
    // ============================================

    const fetchLists = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/lists");
            const json = await res.json();

            if (json.success) {
                setLists(json.data);
            } else {
                showError("Erreur", json.error || "Impossible de charger les listes");
            }
        } catch (err) {
            console.error("Failed to fetch lists:", err);
            showError("Erreur", "Impossible de charger les listes");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLists();
    }, []);


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
                fetchLists();
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900">Listes</h1>
                    <p className="text-slate-500 mt-1">
                        Gérez vos listes de sociétés et contacts
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchLists}
                    >
                        <RefreshCw className={`w - 4 h - 4 ${isLoading ? "animate-spin" : ""} `} />
                    </Button>
                    <div className="flex items-center gap-2">
                        <Link href="/manager/lists/import">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Importer CSV
                            </Button>
                        </Link>
                        <Link href="/manager/lists/new">
                            <Button variant="primary" size="sm" className="gap-2">
                                <Plus className="w-4 h-4" />
                                Nouvelle liste
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Stats */}
            {isLoading ? (
                <div className="grid grid-cols-3 gap-4">
                    <Card><div className="h-16 bg-slate-200 rounded animate-pulse" /></Card>
                    <Card><div className="h-16 bg-slate-200 rounded animate-pulse" /></Card>
                    <Card><div className="h-16 bg-slate-200 rounded animate-pulse" /></Card>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-4">
                    <Card className="shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                <List className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                                <p className="text-sm text-slate-500">Listes</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{stats.companies}</p>
                                <p className="text-sm text-slate-500">Sociétés</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                <Users className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{stats.contacts}</p>
                                <p className="text-sm text-slate-500">Contacts</p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card>
                <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Rechercher une liste..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <Select
                        options={[
                            { value: "all", label: "Tous les types" },
                            { value: "SUZALI", label: "Suzali" },
                            { value: "CLIENT", label: "Client" },
                            { value: "MIXED", label: "Mixte" },
                        ]}
                        value={typeFilter}
                        onChange={setTypeFilter}
                        className="w-40"
                    />
                </div>
            </Card>

            {/* Lists Grid */}
            {isLoading && lists.length === 0 ? (
                <div className="grid grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <Card key={i}>
                            <div className="animate-pulse space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                                        <div className="h-3 bg-slate-200 rounded w-1/2" />
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-200 rounded" />
                            </div>
                        </Card>
                    ))}
                </div>
            ) : filteredLists.length === 0 ? (
                <Card className="text-center py-16">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center mx-auto mb-6">
                        <List className="w-10 h-10 text-indigo-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                        {searchQuery || typeFilter !== "all"
                            ? "Aucune liste trouvée"
                            : "Aucune liste créée"}
                    </h3>
                    <p className="text-slate-500 mb-6">
                        {searchQuery || typeFilter !== "all"
                            ? "Essayez d'autres filtres"
                            : "Commencez par importer ou créer votre première liste"}
                    </p>
                    {!searchQuery && typeFilter === "all" && (
                        <div className="flex items-center justify-center gap-3">
                            <Link href="/manager/lists/import">
                                <Button variant="primary" className="gap-2">
                                    <Upload className="w-4 h-4" />
                                    Importer un CSV
                                </Button>
                            </Link>
                            <Link href="/manager/lists/new">
                                <Button variant="secondary" className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    Créer une liste
                                </Button>
                            </Link>
                        </div>
                    )}
                </Card>
            ) : (
                <div className="grid grid-cols-2 gap-6">
                    {filteredLists.map((list) => {
                        const totalContacts = list.stats?.contactCount || 0;
                        const actionablePercent = totalContacts > 0
                            ? Math.round(((list.stats?.completeness?.ACTIONABLE || 0) / totalContacts) * 100)
                            : 0;

                        return (
                            <Card
                                key={list.id}
                                className="hover:border-slate-300 transition-all cursor-pointer hover:shadow-md"
                                onClick={() => router.push(`/manager/lists/${list.id}`)}
                                onContextMenu={(e) => handleContextMenu(e, list)}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                            <List className="w-5 h-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900">{list.name}</h3>
                                            <p className="text-sm text-slate-500">{list.mission?.name || "Sans mission"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-1 rounded-full ${TYPE_STYLES[list.type].color}`}>
                                            {TYPE_STYLES[list.type].label}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleContextMenu(e, list);
                                            }}
                                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            <MoreVertical className="w-4 h-4 text-slate-400" />
                                        </button>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Building2 className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-600">{list._count?.companies || 0} sociétés</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Users className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-600">{totalContacts} contacts</span>
                                    </div>
                                </div>

                                {/* Completeness */}
                                {totalContacts > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500">Complétude</span>
                                            <span className="text-emerald-600">{actionablePercent}% actionnable</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                                            <div
                                                className="h-full bg-red-400"
                                                style={{ width: `${((list.stats?.completeness?.INCOMPLETE || 0) / totalContacts) * 100}%` }}
                                            />
                                            <div
                                                className="h-full bg-amber-400"
                                                style={{ width: `${((list.stats?.completeness?.PARTIAL || 0) / totalContacts) * 100}%` }}
                                            />
                                            <div
                                                className="h-full bg-emerald-500"
                                                style={{ width: `${((list.stats?.completeness?.ACTIONABLE || 0) / totalContacts) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                            <span>🔴 {list.stats?.completeness?.INCOMPLETE || 0}</span>
                                            <span>🟠 {list.stats?.completeness?.PARTIAL || 0}</span>
                                            <span>🟢 {list.stats?.completeness?.ACTIONABLE || 0}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                                    <span>Source: {list.source || "Inconnu"}</span>
                                    <span>Créée le {new Date(list.createdAt).toLocaleDateString("fr-FR")}</span>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

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
