"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Select,
    ConfirmModal,
    ContextMenu,
    useContextMenu,
    useToast,
} from "@/components/ui";
import {
    List,
    Plus,
    Upload,
    Search,
    Eye,
    Trash2,
    Edit,
    RefreshCw,
    Download,
    MoreHorizontal,
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

const TYPE_STYLES: Record<string, { label: string; color: string }> = {
    SUZALI: { label: "Suzali", color: "bg-indigo-50 text-indigo-600" },
    CLIENT: { label: "Client", color: "bg-amber-50 text-amber-600" },
    MIXED: { label: "Mixte", color: "bg-cyan-50 text-cyan-600" },
};

// ============================================
// LISTING LISTS TAB
// ============================================

export function ListingListsTab() {
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
            const res = await fetch(`/api/lists/${deletingList.id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) {
                success("Liste supprimee", `${deletingList.name} a ete supprimee`);
                fetchLists();
            } else {
                showError("Erreur", json.error || "Impossible de supprimer");
            }
        } catch {
            showError("Erreur", "Impossible de supprimer la liste");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
            setDeletingList(null);
        }
    };

    // ============================================
    // CONTEXT MENU
    // ============================================

    const getContextMenuItems = (list: ListData) => [
        {
            label: "Voir les details",
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
    // FILTER
    // ============================================

    const filteredLists = lists.filter(list => {
        const matchesSearch = !searchQuery ||
            list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            list.mission?.name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === "all" || list.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const stats = {
        total: lists.length,
        companies: lists.reduce((acc, l) => acc + (l._count?.companies || 0), 0),
        contacts: lists.reduce((acc, l) => acc + (l.stats?.contactCount || l._count?.companies || 0), 0),
    };

    const formatListDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
        } catch {
            return dateStr;
        }
    };

    const sourceLabel = (src?: string) => src || "CSV Import";
    const sourcePillClass = (src?: string) => {
        if (!src) return "bg-[#F4F6F9] text-[#8B8BA7]";
        if (src.toLowerCase().includes("apollo")) return "bg-[#EEF2FF] text-[#7C5CFC]";
        if (src.toLowerCase().includes("google") || src.toLowerCase().includes("maps")) return "bg-[#F0FDF4] text-[#10B981]";
        if (src.toLowerCase().includes("seamless")) return "bg-[#FFF7ED] text-[#F59E0B]";
        return "bg-[#F4F6F9] text-[#8B8BA7]";
    };

    // ============================================
    // RENDER — mockup table layout
    // ============================================

    return (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="flex items-center justify-between mb-4 pt-2">
                <div className="flex items-center gap-4 text-[13px]">
                    <span className="text-[#12122A] font-semibold">{stats.total} listes</span>
                    <span className="text-[#8B8BA7]">{stats.contacts} contacts</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={fetchLists}
                        className="w-8 h-8 rounded-lg border border-[#E8EBF0] flex items-center justify-center text-[#8B8BA7] hover:text-[#12122A] hover:border-[#C5C8D4] transition-colors duration-150"
                        title="Rafraîchir"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                    <Link
                        href="/manager/lists/import"
                        className="flex items-center gap-1.5 px-3 py-2 border border-[#E8EBF0] rounded-lg text-[12px] font-medium text-[#5A5A7A] hover:text-[#12122A] hover:border-[#C5C8D4] bg-white transition-colors duration-150"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Importer CSV</span>
                    </Link>
                    <Link
                        href="/manager/lists/new"
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#7C5CFC] to-[#6C4CE0] text-white rounded-lg text-[12px] font-semibold shadow-sm shadow-[#7C5CFC]/25 hover:from-[#6C4CE0] hover:to-[#5C3CD0] transition-all duration-150"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Nouvelle liste</span>
                    </Link>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0B3C0]" />
                    <input
                        type="text"
                        placeholder="Rechercher une liste..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E8EBF0] rounded-lg text-[13px] text-[#12122A] placeholder-[#B0B3C0] focus:outline-none focus:border-[#7C5CFC] focus:ring-1 focus:ring-[#7C5CFC]/20 transition-all duration-150"
                    />
                </div>
                <Select
                    options={[
                        { value: "all", label: "Toutes les sources" },
                        { value: "SUZALI", label: "Suzali" },
                        { value: "CLIENT", label: "Client" },
                        { value: "MIXED", label: "Mixte" },
                    ]}
                    value={typeFilter}
                    onChange={setTypeFilter}
                    className="w-40"
                />
            </div>

            {isLoading && lists.length === 0 ? (
                <div className="bg-white rounded-xl border border-[#E8EBF0] p-8 flex items-center justify-center">
                    <div className="animate-pulse flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#F4F6F9]" />
                        <div className="h-4 bg-[#F4F6F9] rounded w-32" />
                    </div>
                </div>
            ) : filteredLists.length === 0 ? (
                <div className="bg-white rounded-xl border border-[#E8EBF0] text-center py-12">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#F4F6F9] flex items-center justify-center">
                        <List className="w-7 h-7 text-[#C5C8D4]" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-[#12122A] mb-1">
                        {searchQuery || typeFilter !== "all" ? "Aucune liste trouvée" : "Aucune liste"}
                    </h3>
                    <p className="text-[13px] text-[#8B8BA7] mb-4">
                        {searchQuery || typeFilter !== "all" ? "Essayez d'autres filtres" : "Importez un CSV ou créez votre première liste"}
                    </p>
                    {!searchQuery && typeFilter === "all" && (
                        <div className="flex items-center justify-center gap-3">
                            <Link href="/manager/lists/import" className="flex items-center gap-1.5 px-3 py-2 border border-[#E8EBF0] rounded-lg text-[12px] font-medium text-[#5A5A7A] hover:text-[#12122A] bg-white transition-colors">
                                <Upload className="w-3.5 h-3.5" /> Importer CSV
                            </Link>
                            <Link href="/manager/lists/new" className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#7C5CFC] to-[#6C4CE0] text-white rounded-lg text-[12px] font-semibold shadow-sm">
                                <Plus className="w-3.5 h-3.5" /> Nouvelle liste
                            </Link>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-[#E8EBF0] overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[#E8EBF0]">
                                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8B8BA7] uppercase tracking-wide">Nom de la liste</th>
                                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8B8BA7] uppercase tracking-wide">Contacts</th>
                                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8B8BA7] uppercase tracking-wide">Source</th>
                                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8B8BA7] uppercase tracking-wide">Mission</th>
                                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#8B8BA7] uppercase tracking-wide">Date</th>
                                <th className="w-10" />
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLists.map((list) => (
                                <tr
                                    key={list.id}
                                    className="border-b border-[#F0F1F4] hover:bg-[#F9FAFB] transition-colors duration-100 cursor-pointer"
                                    onClick={() => router.push(`/manager/lists/${list.id}`)}
                                    onContextMenu={(e) => handleContextMenu(e, list)}
                                >
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center shrink-0">
                                                <List className="w-4 h-4 text-[#7C5CFC]" />
                                            </div>
                                            <span className="text-[13px] font-semibold text-[#12122A]">{list.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="text-[13px] font-medium text-[#12122A]">{list.stats?.contactCount ?? list._count?.companies ?? 0}</span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${sourcePillClass(list.source)}`}>
                                            {sourceLabel(list.source)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="text-[12px] text-[#5A5A7A]">{list.mission?.name || "—"}</span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="text-[12px] text-[#8B8BA7]">{formatListDate(list.createdAt)}</span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <button
                                            className="text-[#C5C8D4] hover:text-[#8B8BA7] transition-colors duration-150 p-1 -m-1 rounded"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleContextMenu(e, list);
                                            }}
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                message={`Supprimer "${deletingList?.name}" ? Toutes les societes et contacts associes seront supprimes.`}
                confirmText="Supprimer"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
