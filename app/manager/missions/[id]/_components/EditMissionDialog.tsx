"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Select, useToast } from "@/components/ui";
import { Save, Loader2 } from "lucide-react";

interface Client {
    id: string;
    name: string;
}

interface MissionData {
    id: string;
    name: string;
    objective?: string;
    channel: "CALL" | "EMAIL" | "LINKEDIN";
    isActive: boolean;
    startDate?: string;
    endDate?: string;
    client?: { id: string; name: string };
}

interface FormData {
    name: string;
    objective: string;
    channel: string;
    clientId: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
}

interface EditMissionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    mission: MissionData | null;
    onSaved: () => void;
}

export function EditMissionDialog({ isOpen, onClose, mission, onSaved }: EditMissionDialogProps) {
    const { success, error: showError } = useToast();
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<FormData>({
        name: "",
        objective: "",
        channel: "CALL",
        clientId: "",
        startDate: "",
        endDate: "",
        isActive: true,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen && mission) {
            setFormData({
                name: mission.name || "",
                objective: mission.objective || "",
                channel: mission.channel || "CALL",
                clientId: mission.client?.id || "",
                startDate: mission.startDate ? mission.startDate.toString().split("T")[0] : "",
                endDate: mission.endDate ? mission.endDate.toString().split("T")[0] : "",
                isActive: mission.isActive ?? true,
            });
            setErrors({});
        }
    }, [isOpen, mission]);

    useEffect(() => {
        if (isOpen) {
            setIsLoadingClients(true);
            fetch("/api/clients")
                .then((res) => res.json())
                .then((json) => {
                    if (json.success) setClients(json.data || []);
                })
                .finally(() => setIsLoadingClients(false));
        }
    }, [isOpen]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!formData.name.trim()) newErrors.name = "Le nom est requis";
        if (!formData.clientId) newErrors.clientId = "Le client est requis";
        if (formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
            newErrors.endDate = "La date de fin doit être après la date de début";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mission || !validate()) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/missions/${mission.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    objective: formData.objective || null,
                    channel: formData.channel,
                    clientId: formData.clientId,
                    startDate: formData.startDate || null,
                    endDate: formData.endDate || null,
                    isActive: formData.isActive,
                }),
            });
            const json = await res.json();
            if (json.success) {
                success("Mission modifiée", `${formData.name} a été mise à jour`);
                onSaved();
                onClose();
            } else {
                showError("Erreur", json.error || "Impossible de modifier la mission");
            }
        } catch {
            showError("Erreur", "Impossible de modifier la mission");
        } finally {
            setIsSaving(false);
        }
    };

    if (!mission) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Modifier la mission" size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                <Select
                    label="Client *"
                    placeholder="Sélectionner un client..."
                    options={clients.map((c) => ({ value: c.id, label: c.name }))}
                    value={formData.clientId}
                    onChange={(value) => setFormData((prev) => ({ ...prev, clientId: value }))}
                    error={errors.clientId}
                    searchable
                    disabled={isLoadingClients}
                />

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Nom de la mission *</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Prospection SaaS Q1 2026"
                        className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${errors.name ? "border-red-500" : "border-slate-200"}`}
                    />
                    {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Objectif</label>
                    <textarea
                        value={formData.objective}
                        onChange={(e) => setFormData((prev) => ({ ...prev, objective: e.target.value }))}
                        placeholder="Ex: Générer 50 meetings qualifiés"
                        rows={3}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                    />
                </div>

                <Select
                    label="Canal principal *"
                    options={[
                        { value: "CALL", label: "Appel téléphonique" },
                        { value: "EMAIL", label: "Email" },
                        { value: "LINKEDIN", label: "LinkedIn" },
                    ]}
                    value={formData.channel}
                    onChange={(value) => setFormData((prev) => ({ ...prev, channel: value }))}
                />

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Statut</label>
                    <div className="flex gap-4">
                        <label
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl cursor-pointer border transition-all ${
                                formData.isActive ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-white border-slate-200 text-slate-500"
                            }`}
                        >
                            <input
                                type="radio"
                                checked={formData.isActive}
                                onChange={() => setFormData((prev) => ({ ...prev, isActive: true }))}
                                className="hidden"
                            />
                            Actif
                        </label>
                        <label
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl cursor-pointer border transition-all ${
                                !formData.isActive ? "bg-amber-50 border-amber-500 text-amber-700" : "bg-white border-slate-200 text-slate-500"
                            }`}
                        >
                            <input
                                type="radio"
                                checked={!formData.isActive}
                                onChange={() => setFormData((prev) => ({ ...prev, isActive: false }))}
                                className="hidden"
                            />
                            En pause
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Date de début</label>
                        <input
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Date de fin</label>
                        <input
                            type="date"
                            value={formData.endDate}
                            onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                            className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${errors.endDate ? "border-red-500" : "border-slate-200"}`}
                        />
                        {errors.endDate && <p className="text-sm text-red-500 mt-1">{errors.endDate}</p>}
                        {formData.endDate &&
                            mission.endDate &&
                            new Date(formData.endDate) < new Date(mission.endDate.toString().split("T")[0]) && (
                                <p className="text-sm text-amber-600 mt-1">
                                    La mission se termine avant certains créneaux déjà planifiés. Ces créneaux ne s&apos;afficheront plus sur le planning.
                                </p>
                            )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                    <Button variant="secondary" type="button" onClick={onClose}>
                        Annuler
                    </Button>
                    <Button variant="primary" type="submit" disabled={isSaving} className="gap-2">
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Enregistrement...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Enregistrer
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
