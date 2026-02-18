"use client";

import { useState, useEffect } from "react";
import { Drawer, DrawerSection, DrawerField, Button, Input, useToast } from "@/components/ui";
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
}

interface ClientDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    onUpdate?: (client: Client) => void;
}

// ============================================
// CLIENT DRAWER COMPONENT
// ============================================

export function ClientDrawer({
    isOpen,
    onClose,
    client,
    onUpdate,
}: ClientDrawerProps) {
    const { success, error: showError } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        industry: "",
        email: "",
        phone: "",
        bookingUrl: "",
    });

    // Reset form when client changes
    useEffect(() => {
        if (client) {
            setFormData({
                name: client.name || "",
                industry: client.industry || "",
                email: client.email || "",
                phone: client.phone || "",
                bookingUrl: (client as any).bookingUrl || "",
            });
            setIsEditing(false);
        }
    }, [client]);

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

    if (!client) return null;

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? "Modifier le client" : client.name}
            description={isEditing ? "Modifiez les informations du client" : client.industry || "Client"}
            size="lg"
            footer={
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
                                <p className="text-sm text-slate-500">Client depuis</p>
                                <p className="font-medium text-slate-900">
                                    {new Date(client.createdAt).toLocaleDateString("fr-FR", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                                        <Target className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900">{client._count.missions}</p>
                                        <p className="text-xs text-slate-500">Missions</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900">{client._count.users}</p>
                                        <p className="text-xs text-slate-500">Utilisateurs</p>
                                    </div>
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
        </Drawer>
    );
}

export default ClientDrawer;
