"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Save,
    Loader2,
    Tag,
    ListOrdered,
    Plus,
    Pencil,
    Trash2,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";

interface ResultCategory {
    id: string;
    code: string;
    label: string;
    color: string | null;
    sortOrder: number;
    description: string | null;
}

interface GlobalStatus {
    id: string;
    code: string;
    label: string | null;
    color: string | null;
    sortOrder: number;
    resultCategoryCode: string | null;
}

export default function ManagerSettingsStatusesPage() {
    const [categories, setCategories] = useState<ResultCategory[]>([]);
    const [statuses, setStatuses] = useState<GlobalStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [editingCategory, setEditingCategory] = useState<ResultCategory | null>(null);
    const [newCategoryCode, setNewCategoryCode] = useState("");
    const [newCategoryLabel, setNewCategoryLabel] = useState("");
    const [newCategoryColor, setNewCategoryColor] = useState("#64748b");
    const [newCategorySortOrder, setNewCategorySortOrder] = useState(0);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [categorySaving, setCategorySaving] = useState(false);
    const [categoryDeleting, setCategoryDeleting] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            fetch("/api/manager/result-categories").then((r) => r.json()),
            fetch("/api/manager/action-statuses/global").then((r) => r.json()),
        ]).then(([catRes, statusRes]) => {
            if (catRes.success) setCategories(catRes.data);
            if (statusRes.success) setStatuses(statusRes.data);
        }).finally(() => setLoading(false));
    }, []);

    async function handleSaveStatuses() {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/manager/action-statuses/global", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    statuses: statuses.map((s) => ({
                        code: s.code,
                        resultCategoryCode: s.resultCategoryCode,
                        label: s.label,
                        color: s.color,
                        sortOrder: s.sortOrder,
                    })),
                }),
            });
            const json = await res.json();
            if (json.success) {
                setStatuses(json.data);
                setMessage({ type: "success", text: "Statuts enregistrés" });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: "error", text: json.error || "Erreur" });
            }
        } catch {
            setMessage({ type: "error", text: "Erreur de connexion" });
        } finally {
            setSaving(false);
        }
    }

    function setStatusCategory(code: string, resultCategoryCode: string | null) {
        setStatuses((prev) =>
            prev.map((s) => (s.code === code ? { ...s, resultCategoryCode } : s))
        );
    }

    async function handleCreateCategory() {
        if (!newCategoryCode.trim() || !newCategoryLabel.trim()) return;
        const code = newCategoryCode.trim().toUpperCase().replace(/\s+/g, "_");
        setCategorySaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/manager/result-categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code,
                    label: newCategoryLabel.trim(),
                    color: newCategoryColor,
                    sortOrder: newCategorySortOrder,
                }),
            });
            const json = await res.json();
            if (json.success) {
                setCategories((prev) => [...prev, json.data].sort((a, b) => a.sortOrder - b.sortOrder));
                setShowAddCategory(false);
                setNewCategoryCode("");
                setNewCategoryLabel("");
                setNewCategoryColor("#64748b");
                setNewCategorySortOrder(categories.length);
                setMessage({ type: "success", text: "Catégorie créée" });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: "error", text: json.error || "Erreur" });
            }
        } catch {
            setMessage({ type: "error", text: "Erreur de connexion" });
        } finally {
            setCategorySaving(false);
        }
    }

    async function handleUpdateCategory(cat: ResultCategory, updates: Partial<ResultCategory>) {
        setCategorySaving(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/manager/result-categories/${cat.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            const json = await res.json();
            if (json.success) {
                setCategories((prev) =>
                    prev.map((c) => (c.id === cat.id ? json.data : c)).sort((a, b) => a.sortOrder - b.sortOrder)
                );
                setEditingCategory(null);
                setMessage({ type: "success", text: "Catégorie mise à jour" });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: "error", text: json.error || "Erreur" });
            }
        } catch {
            setMessage({ type: "error", text: "Erreur de connexion" });
        } finally {
            setCategorySaving(false);
        }
    }

    async function handleDeleteCategory(cat: ResultCategory) {
        if (!window.confirm("Supprimer cette catégorie ? Les statuts qui y sont rattachés n'auront plus de catégorie.")) return;
        setCategoryDeleting(cat.id);
        setMessage(null);
        try {
            const res = await fetch(`/api/manager/result-categories/${cat.id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) {
                setCategories((prev) => prev.filter((c) => c.id !== cat.id));
                setStatuses((prev) =>
                    prev.map((s) => (s.resultCategoryCode === cat.code ? { ...s, resultCategoryCode: null } : s))
                );
                setMessage({ type: "success", text: "Catégorie supprimée" });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: "error", text: json.error || "Erreur" });
            }
        } catch {
            setMessage({ type: "error", text: "Erreur de connexion" });
        } finally {
            setCategoryDeleting(null);
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm text-slate-500">Chargement…</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
            <div className="flex items-center gap-4">
                <Link
                    href="/manager/settings"
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 text-slate-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <ListOrdered className="w-6 h-6 text-indigo-500" />
                        Statuts et catégories de résultat
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Gérez les catégories de résultat et associez chaque statut d&apos;action à une catégorie (rapports, Activité client).
                    </p>
                </div>
            </div>

            {message && (
                <div
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
                        message.type === "success"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                >
                    {message.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {message.text}
                </div>
            )}

            {/* Catégories de résultat */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <Tag className="w-4 h-4 text-indigo-600" />
                        </div>
                        <span className="font-semibold text-slate-800">Catégories de résultat</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowAddCategory(true)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Nouvelle catégorie
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    {showAddCategory && (
                        <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Code (MAJUSCULES_UNDERSCORE)</label>
                                <input
                                    type="text"
                                    value={newCategoryCode}
                                    onChange={(e) => setNewCategoryCode(e.target.value.toUpperCase().replace(/\s/g, "_"))}
                                    placeholder="EXEMPLE_CATEGORIE"
                                    className="w-48 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Libellé</label>
                                <input
                                    type="text"
                                    value={newCategoryLabel}
                                    onChange={(e) => setNewCategoryLabel(e.target.value)}
                                    placeholder="Exemple catégorie"
                                    className="w-48 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Couleur</label>
                                <input
                                    type="color"
                                    value={newCategoryColor}
                                    onChange={(e) => setNewCategoryColor(e.target.value)}
                                    className="h-9 w-14 rounded border border-slate-200 cursor-pointer"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Ordre</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={newCategorySortOrder}
                                    onChange={(e) => setNewCategorySortOrder(parseInt(e.target.value, 10) || 0)}
                                    className="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleCreateCategory}
                                    disabled={categorySaving || !newCategoryCode.trim() || !newCategoryLabel.trim()}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {categorySaving ? "Création…" : "Créer"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddCategory(false);
                                        setNewCategoryCode("");
                                        setNewCategoryLabel("");
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                className="flex items-center gap-4 py-3 px-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                            >
                                <span
                                    className="w-4 h-4 rounded-full shrink-0 border border-slate-200"
                                    style={{ backgroundColor: cat.color ?? "#e2e8f0" }}
                                />
                                <span className="font-mono text-sm text-slate-700 w-40">{cat.code}</span>
                                {editingCategory?.id === cat.id ? (
                                    <>
                                        <input
                                            type="text"
                                            value={editingCategory.label}
                                            onChange={(e) => setEditingCategory((p) => (p ? { ...p, label: e.target.value } : null))}
                                            className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                                        />
                                        <input
                                            type="color"
                                            value={editingCategory.color ?? "#64748b"}
                                            onChange={(e) => setEditingCategory((p) => (p ? { ...p, color: e.target.value } : null))}
                                            className="w-10 h-8 rounded border border-slate-200 cursor-pointer"
                                        />
                                        <input
                                            type="number"
                                            min={0}
                                            value={editingCategory.sortOrder}
                                            onChange={(e) =>
                                                setEditingCategory((p) =>
                                                    p ? { ...p, sortOrder: parseInt(e.target.value, 10) || 0 } : null
                                                )
                                            }
                                            className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => editingCategory && handleUpdateCategory(cat, editingCategory)}
                                            disabled={categorySaving}
                                            className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                        >
                                            OK
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingCategory(null)}
                                            className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg"
                                        >
                                            Annuler
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-1 text-sm text-slate-800">{cat.label}</span>
                                        <span className="text-xs text-slate-400">Ordre {cat.sortOrder}</span>
                                        <button
                                            type="button"
                                            onClick={() => setEditingCategory({ ...cat })}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                            title="Modifier"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteCategory(cat)}
                                            disabled={categoryDeleting === cat.id}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            title="Supprimer"
                                        >
                                            {categoryDeleting === cat.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Statuts globaux → catégorie */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                            <ListOrdered className="w-4 h-4 text-violet-600" />
                        </div>
                        <span className="font-semibold text-slate-800">Statuts d&apos;action (global)</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleSaveStatuses}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Libellé</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Catégorie de résultat</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statuses.map((s) => (
                                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="py-3 px-4 font-mono text-sm text-slate-700">{s.code}</td>
                                    <td className="py-3 px-4 text-sm text-slate-800">{s.label ?? s.code}</td>
                                    <td className="py-3 px-4">
                                        <select
                                            value={s.resultCategoryCode ?? ""}
                                            onChange={(e) =>
                                                setStatusCategory(s.code, e.target.value || null)
                                            }
                                            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[180px]"
                                        >
                                            <option value="">— Aucune —</option>
                                            {categories.map((c) => (
                                                <option key={c.id} value={c.code}>
                                                    {c.label} ({c.code})
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="px-6 py-3 text-xs text-slate-400 border-t border-slate-100">
                    La catégorie de résultat est utilisée dans le portail client (Activité) et les rapports pour grouper et afficher les comptes par défaut pour chaque mission.
                    Les missions qui ont des statuts personnalisés peuvent définir la catégorie de chaque statut dans <strong>Missions → [Mission] → Statuts et workflow</strong> (drawer).
                </p>
            </div>
        </div>
    );
}
