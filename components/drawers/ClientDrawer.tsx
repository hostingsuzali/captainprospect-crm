"use client";

import { useState, useEffect } from "react";
import { Drawer, DrawerSection, DrawerField, Button, Input, useToast, ConfirmModal, Badge } from "@/components/ui";
import {
    Building2,
    Mail,
    Phone,
    Briefcase,
    Edit,
    Save,
    X,
    Copy,
    Target,
    Users,
    Calendar,
    TrendingUp,
    Link as LinkIcon,
    ExternalLink,
    Trash2,
    ShieldCheck,
    ShieldAlert,
    ChevronRight,
} from "lucide-react";

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
    portalShowCallHistory?: boolean;
    portalShowDatabase?: boolean;
}

interface ClientDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    onUpdate?: (client: Client) => void;
    /** Called after client is deleted (e.g. refresh list and close) */
    onDelete?: () => void;
}

// ============================================
// CLIENT DRAWER COMPONENT
// ============================================

export function ClientDrawer({
    isOpen,
    onClose,
    client,
    onUpdate,
    onDelete,
}: ClientDrawerProps) {
    const { success, error: showError } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        industry: "",
        email: "",
        phone: "",
        bookingUrl: "",
        portalShowCallHistory: false,
        portalShowDatabase: false,
        rdvEmailNotificationsEnabled: true,
        defaultMailboxId: "",
    });
    const [mailboxes, setMailboxes] = useState<Array<{ id: string; email: string; displayName: string | null }>>([]);
    const [isLoadingMailboxes, setIsLoadingMailboxes] = useState(false);

    // Reset form when client changes
    useEffect(() => {
        if (client) {
            setFormData((prev) => ({
                ...prev,
                name: client.name || "",
                industry: client.industry || "",
                email: client.email || "",
                phone: client.phone || "",
                bookingUrl: (client as any).bookingUrl || "",
                portalShowCallHistory: (client as any).portalShowCallHistory ?? false,
                portalShowDatabase: (client as any).portalShowDatabase ?? false,
                rdvEmailNotificationsEnabled: (client as any).rdvEmailNotificationsEnabled ?? true,
            }));
            setIsEditing(false);

            // Fetch client onboarding data (for default mailbox)
            (async () => {
                try {
                    const res = await fetch(`/api/clients/${client.id}`);
                    const json = await res.json();
                    if (json.success) {
                        const onboardingData = (json.data?.onboarding?.onboardingData ?? {}) as { defaultMailboxId?: string };
                        setFormData((prev) => ({
                            ...prev,
                            defaultMailboxId: onboardingData.defaultMailboxId ?? "",
                        }));
                    }
                } catch {
                    // ignore, optional enhancement
                }
            })();
        }
    }, [client]);

    // Load available mailboxes for managers (owned + shared)
    useEffect(() => {
        if (!isOpen) return;
        setIsLoadingMailboxes(true);
        fetch("/api/email/mailboxes?includeShared=true")
            .then((r) => r.json())
            .then((json) => {
                if (json.success && Array.isArray(json.data)) {
                    setMailboxes(
                        json.data.map((mb: { id: string; email: string; displayName: string | null }) => ({
                            id: mb.id,
                            email: mb.email,
                            displayName: mb.displayName,
                        }))
                    );
                }
            })
            .catch(() => {
                // silent fail, mailbox selection is optional
            })
            .finally(() => setIsLoadingMailboxes(false));
    }, [isOpen]);

    // ============================================
    // SAVE HANDLER
    // ============================================

    const handleSave = async () => {
        if (!client) return;

        setIsSaving(true);
        try {
            const res = await fetch(`/api/clients/${client.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const json = await res.json();

            if (json.success) {
                success("Client mis à jour", `${formData.name} a été mis à jour`);
                setIsEditing(false);
                if (onUpdate) {
                    onUpdate({ ...client, ...formData });
                }
            } else {
                showError("Erreur", json.error || "Impossible de mettre à jour");
            }
        } catch (err) {
            showError("Erreur", "Impossible de mettre à jour le client");
        } finally {
            setIsSaving(false);
        }
    };

    // ============================================
    // COPY TO CLIPBOARD
    // ============================================

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        success("Copié", `${label} copié dans le presse-papier`);
    };

    // ============================================
    // DELETE CLIENT
    // ============================================

    const handleDeleteConfirm = async () => {
        if (!client) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) {
                success("Client supprimé", `${client.name} et toutes les données associées ont été supprimés`);
                setShowDeleteConfirm(false);
                onClose();
                onDelete?.();
            } else {
                showError("Erreur", json.error || "Impossible de supprimer le client");
            }
        } catch (err) {
            showError("Erreur", "Impossible de supprimer le client");
        } finally {
            setIsDeleting(false);
        }
    };

    if (!client) return null;

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? "Modifier le client" : client.name}
            description={isEditing ? "Modifiez les informations du client" : client.industry || "Client"}
            size="lg"
            footer={
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        {!isEditing && (
                            <Button
                                variant="ghost"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center justify-end gap-3">
                        {isEditing ? (
                            <>
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsEditing(false)}
                                    disabled={isSaving}
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Annuler
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {isSaving ? "Enregistrement..." : "Enregistrer"}
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="secondary"
                                onClick={() => setIsEditing(true)}
                            >
                                <Edit className="w-4 h-4 mr-2" />
                                Modifier
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <div className="space-y-6">
                {/* Avatar & Quick Stats */}
                {!isEditing && (
                    <>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-2xl font-bold text-indigo-600 shadow-lg shadow-indigo-500/20">
                                {client.name[0].toUpperCase()}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-xl font-bold text-slate-900 leading-none">{client.name}</h2>
                                    {client._count.users > 0 ? (
                                        <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[10px] uppercase tracking-wider h-5 px-1.5 font-bold">
                                            <ShieldCheck className="w-3 h-3" />
                                            Portail Actif
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 gap-1 text-[10px] uppercase tracking-wider h-5 px-1.5 font-bold">
                                            <ShieldAlert className="w-3 h-3 text-slate-400" />
                                            Pas d'accès
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500">Client depuis {new Date(client.createdAt).toLocaleDateString("fr-FR", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                                </p>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gradient-to-br from-indigo-50 to-white hover:from-indigo-100/80 transition-colors rounded-xl border border-indigo-100 group cursor-default">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                                        <Target className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <TrendingUp className="w-4 h-4 text-indigo-300 group-hover:text-indigo-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900 leading-none">{client._count.missions}</p>
                                    <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Missions</p>
                                </div>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-emerald-50 to-white hover:from-emerald-100/80 transition-colors rounded-xl border border-emerald-100 group cursor-default">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                                        <Users className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <ShieldCheck className="w-4 h-4 text-emerald-300 group-hover:text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900 leading-none">{client._count.users}</p>
                                    <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Utilisateurs</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Client Info */}
                <DrawerSection title="Informations">
                    {isEditing ? (
                        <div className="space-y-4">
                            <Input
                                label="Nom du client *"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                icon={<Building2 className="w-4 h-4 text-slate-400" />}
                            />
                            <Input
                                label="Secteur d'activité"
                                value={formData.industry}
                                onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                                icon={<Briefcase className="w-4 h-4 text-slate-400" />}
                            />
                            <Input
                                label="Email de contact"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                icon={<Mail className="w-4 h-4 text-slate-400" />}
                            />
                            <Input
                                label="Téléphone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                icon={<Phone className="w-4 h-4 text-slate-400" />}
                            />
                            <div>
                                <Input
                                    label="URL de réservation (Calendly, etc.)"
                                    type="url"
                                    value={formData.bookingUrl}
                                    onChange={(e) => setFormData(prev => ({ ...prev, bookingUrl: e.target.value }))}
                                    icon={<LinkIcon className="w-4 h-4 text-slate-400" />}
                                    placeholder="https://calendly.com/client-name"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Les SDRs pourront utiliser cette URL pour planifier des rendez-vous lors des appels
                                </p>
                            </div>

                            <div className="mt-4 border-t border-slate-200 pt-4 space-y-3">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Portail client
                                </p>
                                <label className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-slate-700">
                                        Afficher l&apos;historique d&apos;appels
                                    </span>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={formData.portalShowCallHistory}
                                        onChange={(e) =>
                                            setFormData(prev => ({
                                                ...prev,
                                                portalShowCallHistory: e.target.checked,
                                            }))
                                        }
                                    />
                                </label>
                                <label className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-slate-700">
                                        Afficher la base de données (contacts / entreprises)
                                    </span>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={formData.portalShowDatabase}
                                        onChange={(e) =>
                                            setFormData(prev => ({
                                                ...prev,
                                                portalShowDatabase: e.target.checked,
                                            }))
                                        }
                                    />
                                </label>
                            </div>

                            <div className="mt-4 border-t border-slate-200 pt-4 space-y-3">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Notifications email
                                </p>
                                <label className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-slate-700">
                                        Envoyer un email au client à chaque nouveau RDV
                                    </span>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 accent-indigo-600"
                                        checked={formData.rdvEmailNotificationsEnabled}
                                        onChange={(e) =>
                                            setFormData(prev => ({
                                                ...prev,
                                                rdvEmailNotificationsEnabled: e.target.checked,
                                            }))
                                        }
                                    />
                                </label>
                            </div>

                            <div className="mt-4 border-t border-slate-200 pt-4 space-y-3">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Boîte mail par défaut
                                </p>
                                {isLoadingMailboxes ? (
                                    <p className="text-xs text-slate-400">Chargement des boîtes mail…</p>
                                ) : mailboxes.length === 0 ? (
                                    <p className="text-xs text-slate-500">
                                        Aucune boîte mail disponible. Configurez-les dans{" "}
                                        <a
                                            href="/manager/email/mailboxes"
                                            className="text-indigo-600 hover:underline"
                                        >
                                            la page Boîtes mail
                                        </a>.
                                    </p>
                                ) : (
                                    <>
                                        <select
                                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700"
                                            value={formData.defaultMailboxId}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    defaultMailboxId: e.target.value,
                                                }))
                                            }
                                        >
                                            <option value="">Aucune (le SDR choisit sa boîte mail)</option>
                                            {mailboxes.map((mb) => (
                                                <option key={mb.id} value={mb.id}>
                                                    {mb.displayName ? `${mb.displayName} <${mb.email}>` : mb.email}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-slate-500">
                                            Cette boîte mail sera proposée par défaut aux SDRs pour les emails liés
                                            aux missions de ce client.
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <DrawerField
                                label="Secteur d'activité"
                                value={client.industry}
                                icon={<Briefcase className="w-5 h-5 text-indigo-500" />}
                            />
                            <DrawerField
                                label="Email"
                                value={
                                    client.email && (
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={`mailto:${client.email}`}
                                                className="text-indigo-600 hover:underline"
                                            >
                                                {client.email}
                                            </a>
                                            <button
                                                onClick={() => copyToClipboard(client.email!, "Email")}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )
                                }
                                icon={<Mail className="w-5 h-5 text-indigo-500" />}
                            />
                            <DrawerField
                                label="Téléphone"
                                value={
                                    client.phone && (
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={`tel:${client.phone}`}
                                                className="text-slate-900"
                                            >
                                                {client.phone}
                                            </a>
                                            <button
                                                onClick={() => copyToClipboard(client.phone!, "Téléphone")}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )
                                }
                                icon={<Phone className="w-5 h-5 text-indigo-500" />}
                            />
                            <DrawerField
                                label="Date de création"
                                value={new Date(client.createdAt).toLocaleDateString("fr-FR")}
                                icon={<Calendar className="w-5 h-5 text-indigo-500" />}
                            />
                            {(client as any).bookingUrl && (
                                <DrawerField
                                    label="URL de réservation"
                                    value={
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={(client as any).bookingUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-600 hover:underline flex items-center gap-1"
                                            >
                                                {(client as any).bookingUrl}
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                            <button
                                                onClick={() => copyToClipboard((client as any).bookingUrl, "URL de réservation")}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    }
                                    icon={<LinkIcon className="w-5 h-5 text-indigo-500" />}
                                />
                            )}
                        </div>
                    )}
                </DrawerSection>

                {/* Portal Access Upsell in Drawer */}
                {!isEditing && (
                    <div className="rounded-xl border border-indigo-100 overflow-hidden bg-gradient-to-r from-indigo-50/50 to-white relative pb-7">
                        <div className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex flex-shrink-0 items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                                </div>
                                <h3 className="font-bold text-slate-900 text-sm">Portail Client</h3>
                            </div>
                            <p className="text-xs text-slate-500 pl-11 mb-2">
                                {client._count.users > 0
                                    ? `Ce client a actuellement ${client._count.users} accès actif(s). Gérez les paramètres sur la page de détail.`
                                    : `Ce client n'a pas encore accès à son portail privé pour suivre les résultats en temps réel.`
                                }
                            </p>
                        </div>
                        <a
                            href={`/manager/clients/${client.id}`}
                            className="absolute bottom-0 left-0 right-0 py-2 px-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 transition-colors flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider"
                        >
                            {client._count.users > 0 ? "Gérer les accès" : "Créer le premier accès"}
                            <ChevronRight className="w-3.5 h-3.5" />
                        </a>
                    </div>
                )}

                {/* View Details Link */}
                {!isEditing && (
                    <div className="pt-4 border-t border-slate-100">
                        <a
                            href={`/manager/clients/${client.id}`}
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-50 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-100 transition-colors"
                        >
                            <TrendingUp className="w-4 h-4" />
                            Voir tous les détails et missions
                        </a>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => !isDeleting && setShowDeleteConfirm(false)}
                onConfirm={handleDeleteConfirm}
                title="Supprimer le client"
                message={`Êtes-vous sûr de vouloir supprimer "${client.name}" ? Cette action supprimera définitivement le client et toutes les données associées (missions, campagnes, onboarding, utilisateurs liés, etc.) et ne peut pas être annulée.`}
                confirmText="Supprimer définitivement"
                cancelText="Annuler"
                variant="danger"
                isLoading={isDeleting}
            />
        </Drawer>
    );
}

export default ClientDrawer;
