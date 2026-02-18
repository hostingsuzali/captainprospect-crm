"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users,
    Plus,
    Search,
    Ban,
    Check,
    Pencil,
    Trash2,
    Key,
    UserCheck,
    UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal, ModalFooter, ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui";

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    client?: { id: string; name: string } | null;
    _count: {
        assignedMissions: number;
        actions: number;
    };
}

interface Permission {
    id: string;
    code: string;
    name: string;
    description: string | null;
    category: string;
}

const ROLE_COLORS: Record<string, string> = {
    MANAGER: "bg-indigo-100 text-indigo-700",
    SDR: "bg-blue-100 text-blue-700",
    BUSINESS_DEVELOPER: "bg-emerald-100 text-emerald-700",
    DEVELOPER: "bg-purple-100 text-purple-700",
    CLIENT: "bg-slate-100 text-slate-700",
};

const ROLE_LABELS: Record<string, string> = {
    MANAGER: "Manager",
    SDR: "SDR",
    BUSINESS_DEVELOPER: "Business Dev",
    DEVELOPER: "Développeur",
    CLIENT: "Client",
};

export function ReglagesTab() {
    const { success, error: showError } = useToast();

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPermissionsModal, setShowPermissionsModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showStatusConfirm, setShowStatusConfirm] = useState(false);

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "SDR",
        clientId: "",
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [formLoading, setFormLoading] = useState(false);

    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
    const [permissionsLoading, setPermissionsLoading] = useState(false);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (roleFilter) params.set("role", roleFilter);
            if (statusFilter !== "all") params.set("status", statusFilter);
            params.set("excludeSelf", "false");

            const res = await fetch(`/api/users?${params}`);
            const json = await res.json();

            if (json.success) {
                setUsers(json.data.users || json.data);
            }
        } catch (err) {
            console.error("Error fetching users:", err);
        } finally {
            setLoading(false);
        }
    }, [search, roleFilter, statusFilter]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/clients");
                const json = await res.json();
                if (cancelled || !json.success) return;
                const list = json.data?.clients ?? json.data ?? [];
                setClients(Array.isArray(list) ? list : []);
            } catch {
                // ignore
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const fetchAllPermissions = async () => {
        try {
            const res = await fetch("/api/permissions");
            const json = await res.json();
            if (json.success) {
                setAllPermissions(json.data.permissions);
            }
        } catch (err) {
            console.error("Error fetching permissions:", err);
        }
    };

    const fetchUserPermissions = async (userId: string) => {
        try {
            setPermissionsLoading(true);
            const res = await fetch(`/api/users/${userId}/permissions`);
            const json = await res.json();
            if (json.success) {
                setUserPermissions(new Set(json.data));
            }
        } catch (err) {
            console.error("Error fetching user permissions:", err);
        } finally {
            setPermissionsLoading(false);
        }
    };

    const handleCreate = async () => {
        setFormErrors({});

        if (!formData.name.trim()) {
            setFormErrors({ name: "Nom requis" });
            return;
        }
        if (!formData.email.trim()) {
            setFormErrors({ email: "Email requis" });
            return;
        }
        if (formData.role === "CLIENT" && !formData.clientId?.trim()) {
            setFormErrors({ clientId: "Sélectionnez un client pour un utilisateur portail client" });
            return;
        }

        try {
            setFormLoading(true);
            const payload: Record<string, unknown> = {
                name: formData.name,
                email: formData.email,
                password: formData.password || undefined,
                role: formData.role,
            };
            if (formData.role === "CLIENT" && formData.clientId) {
                payload.clientId = formData.clientId;
            }
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (!json.success) {
                setFormErrors({ general: json.error });
                showError("Erreur", json.error || "Impossible de créer l'utilisateur");
                return;
            }

            setShowCreateModal(false);
            resetForm();
            fetchUsers();

            const roleLabel = ROLE_LABELS[formData.role] || formData.role;
            success(
                "Utilisateur créé",
                `${formData.name} a été créé avec le rôle ${roleLabel}. Les permissions par défaut ont été assignées.`
            );
        } catch (err) {
            const errorMessage = "Erreur lors de la création";
            setFormErrors({ general: errorMessage });
            showError("Erreur", errorMessage);
        } finally {
            setFormLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedUser) return;
        setFormErrors({});

        try {
            setFormLoading(true);
            const updateData: Record<string, unknown> = {
                name: formData.name,
                email: formData.email,
                role: formData.role,
            };
            if (formData.password) {
                updateData.password = formData.password;
            }
            if (formData.role === "CLIENT") {
                updateData.clientId = formData.clientId?.trim() || null;
            } else {
                updateData.clientId = null;
            }

            const res = await fetch(`/api/users/${selectedUser.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            });
            const json = await res.json();

            if (!json.success) {
                setFormErrors({ general: json.error });
                return;
            }

            setShowEditModal(false);
            resetForm();
            fetchUsers();
        } catch (err) {
            setFormErrors({ general: "Erreur lors de la mise à jour" });
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedUser) return;

        try {
            setFormLoading(true);
            const res = await fetch(`/api/users/${selectedUser.id}`, {
                method: "DELETE",
            });
            const json = await res.json();

            if (!json.success) {
                alert(json.error);
                return;
            }

            setShowDeleteConfirm(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (err) {
            alert("Erreur lors de la suppression");
        } finally {
            setFormLoading(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!selectedUser) return;

        try {
            setFormLoading(true);
            const res = await fetch(`/api/users/${selectedUser.id}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !selectedUser.isActive }),
            });
            const json = await res.json();

            if (!json.success) {
                alert(json.error);
                return;
            }

            setShowStatusConfirm(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (err) {
            alert("Erreur lors du changement de statut");
        } finally {
            setFormLoading(false);
        }
    };

    const handlePermissionToggle = async (code: string) => {
        if (!selectedUser) return;

        const newPermissions = new Set(userPermissions);
        const granted = !newPermissions.has(code);

        if (granted) {
            newPermissions.add(code);
        } else {
            newPermissions.delete(code);
        }

        setUserPermissions(newPermissions);

        try {
            await fetch(`/api/users/${selectedUser.id}/permissions`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    permissions: [{ code, granted }],
                }),
            });
        } catch (err) {
            console.error("Error updating permission:", err);
            if (granted) {
                newPermissions.delete(code);
            } else {
                newPermissions.add(code);
            }
            setUserPermissions(new Set(newPermissions));
        }
    };

    const resetForm = () => {
        setFormData({ name: "", email: "", password: "", role: "SDR", clientId: "" });
        setFormErrors({});
        setSelectedUser(null);
    };

    const openEditModal = (user: User) => {
        setSelectedUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: "",
            role: user.role,
            clientId: user.client?.id ?? "",
        });
        setShowEditModal(true);
    };

    const openPermissionsModal = async (user: User) => {
        setSelectedUser(user);
        setShowPermissionsModal(true);
        await Promise.all([
            fetchAllPermissions(),
            fetchUserPermissions(user.id),
        ]);
    };

    const groupedPermissions = allPermissions.reduce((acc, perm) => {
        if (!acc[perm.category]) acc[perm.category] = [];
        acc[perm.category].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    const categoryLabels: Record<string, string> = {
        pages: "Pages",
        features: "Fonctionnalités",
        actions: "Actions",
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestion des Utilisateurs"
                subtitle="Gérez les utilisateurs, leurs rôles et permissions"
                actions={
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Nouvel utilisateur
                    </button>
                }
            />

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher par nom ou email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">Tous les rôles</option>
                    <option value="MANAGER">Manager</option>
                    <option value="SDR">SDR</option>
                    <option value="BUSINESS_DEVELOPER">Business Dev</option>
                    <option value="DEVELOPER">Développeur</option>
                    <option value="CLIENT">Client</option>
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="all">Tous les statuts</option>
                    <option value="active">Actifs</option>
                    <option value="inactive">Inactifs</option>
                </select>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Utilisateur</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rôle</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Missions</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions (total)</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-slate-500">Chargement...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500">Aucun utilisateur trouvé</p>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-semibold">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">{user.name}</p>
                                                    <p className="text-sm text-slate-500">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "inline-flex px-2.5 py-1 rounded-full text-xs font-medium",
                                                ROLE_COLORS[user.role] || "bg-slate-100 text-slate-700"
                                            )}>
                                                {ROLE_LABELS[user.role] || user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.isActive ? (
                                                <span className="inline-flex items-center gap-1.5 text-emerald-600">
                                                    <UserCheck className="w-4 h-4" />
                                                    <span className="text-sm font-medium">Actif</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 text-red-600">
                                                    <UserX className="w-4 h-4" />
                                                    <span className="text-sm font-medium">Inactif</span>
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.role === "CLIENT" && user.client ? (
                                                <span className="text-slate-700">{user.client.name}</span>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-900 font-medium">{user._count.assignedMissions}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-900 font-medium">{user._count.actions}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openPermissionsModal(user)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Gérer les permissions"
                                                >
                                                    <Key className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(user)}
                                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                    title="Modifier"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setShowStatusConfirm(true);
                                                    }}
                                                    className={cn(
                                                        "p-2 rounded-lg transition-colors",
                                                        user.isActive
                                                            ? "text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                            : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                                    )}
                                                    title={user.isActive ? "Désactiver" : "Activer"}
                                                >
                                                    {user.isActive ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setShowDeleteConfirm(true);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    resetForm();
                }}
                title="Nouvel utilisateur"
                size="md"
            >
                <div className="space-y-5">
                    {formErrors.general && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {formErrors.general}
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-700">Nom</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="Jean Dupont"
                        />
                        {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-700">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="jean@example.com"
                        />
                        {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-700">
                            Mot de passe <span className="text-slate-400 font-normal">(optionnel)</span>
                        </label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="Laissez vide pour générer automatiquement"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-700">Rôle</label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value, clientId: e.target.value === "CLIENT" ? formData.clientId : "" })}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="SDR">SDR</option>
                            <option value="BUSINESS_DEVELOPER">Business Developer</option>
                            <option value="MANAGER">Manager</option>
                            <option value="DEVELOPER">Développeur</option>
                            <option value="CLIENT">Client</option>
                        </select>
                    </div>
                    {formData.role === "CLIENT" && (
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-700">Client <span className="text-red-500">*</span></label>
                            <select
                                value={formData.clientId}
                                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">Sélectionner un client</option>
                                {clients.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            {formErrors.clientId && <p className="text-red-500 text-xs mt-1">{formErrors.clientId}</p>}
                        </div>
                    )}
                </div>
                <ModalFooter>
                    <button
                        onClick={() => {
                            setShowCreateModal(false);
                            resetForm();
                        }}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={formLoading}
                        className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {formLoading ? "Création..." : "Créer"}
                    </button>
                </ModalFooter>
            </Modal>

            <Modal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    resetForm();
                }}
                title="Modifier l'utilisateur"
                size="md"
            >
                <div className="space-y-5">
                    {formErrors.general && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {formErrors.general}
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-700">Nom</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-700">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-700">
                            Nouveau mot de passe <span className="text-slate-400 font-normal">(laisser vide pour conserver)</span>
                        </label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="Laisser vide pour conserver le mot de passe actuel"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-700">Rôle</label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value, clientId: e.target.value === "CLIENT" ? formData.clientId : "" })}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="SDR">SDR</option>
                            <option value="BUSINESS_DEVELOPER">Business Developer</option>
                            <option value="MANAGER">Manager</option>
                            <option value="DEVELOPER">Développeur</option>
                            <option value="CLIENT">Client</option>
                        </select>
                    </div>
                    {formData.role === "CLIENT" && (
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-700">Client</label>
                            <select
                                value={formData.clientId}
                                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">Aucun client</option>
                                {clients.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500">Lien vers le client pour l'accès portail client.</p>
                        </div>
                    )}
                </div>
                <ModalFooter>
                    <button
                        onClick={() => {
                            setShowEditModal(false);
                            resetForm();
                        }}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleUpdate}
                        disabled={formLoading}
                        className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {formLoading ? "Enregistrement..." : "Enregistrer"}
                    </button>
                </ModalFooter>
            </Modal>

            <Modal
                isOpen={showPermissionsModal}
                onClose={() => {
                    setShowPermissionsModal(false);
                    setSelectedUser(null);
                }}
                title={`Permissions - ${selectedUser?.name}`}
                size="lg"
            >
                {permissionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-6 max-h-[60vh] overflow-y-auto">
                        <p className="text-sm text-slate-500">
                            Activez ou désactivez les permissions pour cet utilisateur.
                            Les modifications sont enregistrées automatiquement.
                        </p>
                        {Object.entries(groupedPermissions).map(([category, perms]) => (
                            <div key={category}>
                                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                                    {categoryLabels[category] || category}
                                </h3>
                                <div className="space-y-2">
                                    {perms.map((perm) => {
                                        const isEnabled = userPermissions.has(perm.code);
                                        return (
                                            <div
                                                key={perm.id}
                                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                            >
                                                <div>
                                                    <p className="font-medium text-slate-900">{perm.name}</p>
                                                    {perm.description && (
                                                        <p className="text-sm text-slate-500">{perm.description}</p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handlePermissionToggle(perm.code)}
                                                    className={cn(
                                                        "relative w-11 h-6 rounded-full transition-colors",
                                                        isEnabled ? "bg-indigo-600" : "bg-slate-300"
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                                                            isEnabled && "translate-x-5"
                                                        )}
                                                    />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <ModalFooter>
                    <button
                        onClick={async () => {
                            if (!selectedUser) return;
                            try {
                                setPermissionsLoading(true);
                                const res = await fetch(`/api/users/${selectedUser.id}/reset-permissions`, {
                                    method: "POST",
                                });
                                const json = await res.json();

                                if (json.success) {
                                    success("Permissions réinitialisées", "Les permissions par défaut ont été assignées.");
                                    await fetchUserPermissions(selectedUser.id);
                                } else {
                                    showError("Erreur", json.error || "Impossible de réinitialiser les permissions");
                                }
                            } catch (err) {
                                showError("Erreur", "Impossible de réinitialiser les permissions");
                            } finally {
                                setPermissionsLoading(false);
                            }
                        }}
                        disabled={permissionsLoading}
                        className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Réinitialiser aux valeurs par défaut
                    </button>
                    <button
                        onClick={() => {
                            setShowPermissionsModal(false);
                            setSelectedUser(null);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Fermer
                    </button>
                </ModalFooter>
            </Modal>

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => {
                    setShowDeleteConfirm(false);
                    setSelectedUser(null);
                }}
                onConfirm={handleDelete}
                title="Supprimer l'utilisateur"
                message={`Êtes-vous sûr de vouloir supprimer "${selectedUser?.name}" ? Cette action est irréversible.`}
                confirmText="Supprimer"
                variant="danger"
                isLoading={formLoading}
            />

            <ConfirmModal
                isOpen={showStatusConfirm}
                onClose={() => {
                    setShowStatusConfirm(false);
                    setSelectedUser(null);
                }}
                onConfirm={handleToggleStatus}
                title={selectedUser?.isActive ? "Désactiver l'utilisateur" : "Activer l'utilisateur"}
                message={
                    selectedUser?.isActive
                        ? `Êtes-vous sûr de vouloir désactiver "${selectedUser?.name}" ? L'utilisateur ne pourra plus se connecter.`
                        : `Êtes-vous sûr de vouloir réactiver "${selectedUser?.name}" ?`
                }
                confirmText={selectedUser?.isActive ? "Désactiver" : "Activer"}
                variant={selectedUser?.isActive ? "warning" : "default"}
                isLoading={formLoading}
            />
        </div>
    );
}
