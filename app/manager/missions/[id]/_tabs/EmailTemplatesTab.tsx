"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, Eye, Copy, Trash2 } from "lucide-react";
import {
    Button,
    Badge,
    EmptyState,
    Skeleton,
    useToast,
    Modal,
    ModalFooter,
    Input,
} from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { MissionShellData } from "../MissionDetailShell";

interface MissionTemplate {
    id: string;
    order: number;
    template: {
        id: string;
        name: string;
        subject: string;
        bodyHtml: string;
        bodyText?: string;
        category?: string;
    };
}

export function EmailTemplatesTab({ mission }: { mission: MissionShellData }) {
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();

    const [preview, setPreview] = useState<MissionTemplate | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    const query = useQuery({
        queryKey: qk.missionTemplates(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/missions/${mission.id}/templates`);
            const json = await res.json();
            return (json?.data ?? []) as MissionTemplate[];
        },
    });

    const remove = useMutation({
        mutationFn: async (templateId: string) => {
            const res = await fetch(`/api/missions/${mission.id}/templates?templateId=${templateId}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
        },
        onSuccess: () => {
            success("Template retiré");
            queryClient.invalidateQueries({ queryKey: qk.missionTemplates(mission.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const duplicate = useMutation({
        mutationFn: async (templateId: string) => {
            const res = await fetch(`/api/missions/${mission.id}/templates`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "duplicate", templateId }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
        },
        onSuccess: () => {
            success("Template dupliqué");
            queryClient.invalidateQueries({ queryKey: qk.missionTemplates(mission.id) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-indigo-600" /> Templates email
                </h2>
                <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Nouveau template
                </Button>
            </div>

            {query.isLoading ? (
                <Skeleton className="h-40" />
            ) : query.error ? (
                <ErrorCard message="Impossible de charger les templates" onRetry={() => query.refetch()} />
            ) : (query.data ?? []).length === 0 ? (
                <EmptyState
                    icon={Mail}
                    title="Aucun template"
                    description="Créez un template pour cette mission."
                    action={<Button variant="primary" onClick={() => setShowCreate(true)}>Nouveau template</Button>}
                />
            ) : (
                <ul className="space-y-2">
                    {(query.data ?? [])
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((mt) => (
                            <li
                                key={mt.id}
                                className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-300"
                            >
                                <div className="text-xs font-mono text-slate-400 pt-1 w-5 shrink-0">#{mt.order}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-slate-900 truncate">{mt.template.name}</span>
                                        <IdChip id={mt.template.id} length={6} />
                                        {mt.template.category && (
                                            <Badge variant="outline" className="text-[10px]">{mt.template.category}</Badge>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5 truncate">{mt.template.subject}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => setPreview(mt)} title="Prévisualiser">
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => duplicate.mutate(mt.template.id)}
                                        title="Dupliquer"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            if (confirm(`Retirer ${mt.template.name} ?`)) remove.mutate(mt.template.id);
                                        }}
                                        className="text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                </ul>
            )}

            <Modal
                isOpen={!!preview}
                onClose={() => setPreview(null)}
                title={preview?.template.name}
                size="lg"
            >
                {preview && (
                    <div className="space-y-3">
                        <div className="text-sm text-slate-600">
                            <span className="font-medium">Sujet : </span>
                            {preview.template.subject}
                        </div>
                        <div
                            className="prose prose-sm max-w-none border border-slate-200 rounded-lg p-4 bg-white"
                            dangerouslySetInnerHTML={{ __html: preview.template.bodyHtml }}
                        />
                    </div>
                )}
                <ModalFooter>
                    <Button variant="outline" onClick={() => setPreview(null)}>Fermer</Button>
                </ModalFooter>
            </Modal>

            <CreateTemplateModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                missionId={mission.id}
                onCreated={() => {
                    queryClient.invalidateQueries({ queryKey: qk.missionTemplates(mission.id) });
                    setShowCreate(false);
                }}
            />
        </div>
    );
}

function CreateTemplateModal({
    isOpen,
    onClose,
    missionId,
    onCreated,
}: {
    isOpen: boolean;
    onClose: () => void;
    missionId: string;
    onCreated: () => void;
}) {
    const { success, error: showError } = useToast();
    const [name, setName] = useState("");
    const [subject, setSubject] = useState("");
    const [bodyHtml, setBodyHtml] = useState("");

    const create = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/missions/${missionId}/templates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ createNew: true, name, subject, bodyHtml }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
        },
        onSuccess: () => {
            success("Template créé");
            setName("");
            setSubject("");
            setBodyHtml("");
            onCreated();
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nouveau template" size="lg">
            <div className="space-y-3">
                <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
                <Input label="Sujet" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Corps (HTML)</label>
                    <textarea
                        value={bodyHtml}
                        onChange={(e) => setBodyHtml(e.target.value)}
                        rows={10}
                        className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        placeholder="<p>Bonjour {{firstName}},</p>..."
                    />
                </div>
            </div>
            <ModalFooter>
                <Button variant="ghost" onClick={onClose} disabled={create.isPending}>Annuler</Button>
                <Button
                    variant="primary"
                    onClick={() => create.mutate()}
                    isLoading={create.isPending}
                    disabled={!name || !subject || !bodyHtml}
                >
                    Créer
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default EmailTemplatesTab;
