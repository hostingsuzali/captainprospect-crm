"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Video, Mail, CheckCircle2, Trash2, Plus, Send } from "lucide-react";
import { Badge, Button, useToast, Tabs } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import type { SessionData } from "../_tabs/SessionsTab";

export function SessionDetailPanel({
    clientId,
    sessionId,
    sessions,
    onChanged,
}: {
    clientId: string;
    sessionId: string;
    sessions: SessionData[];
    onChanged: () => void;
}) {
    const session = useMemo(() => sessions.find((s) => s.id === sessionId), [sessions, sessionId]);
    const [innerTab, setInnerTab] = useState<"cr" | "email" | "tasks">("cr");
    const [newTask, setNewTask] = useState("");
    const { success, error: showError } = useToast();
    const queryClient = useQueryClient();

    const toggleTask = useMutation({
        mutationFn: async ({ taskId, done }: { taskId: string; done: boolean }) => {
            const res = await fetch(`/api/clients/${clientId}/sessions/${sessionId}/tasks/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ doneAt: done ? new Date().toISOString() : null }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.clientSessions(clientId) });
            onChanged();
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const addTask = useMutation({
        mutationFn: async (label: string) => {
            const res = await fetch(`/api/clients/${clientId}/sessions/${sessionId}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            success("Tâche ajoutée");
            setNewTask("");
            queryClient.invalidateQueries({ queryKey: qk.clientSessions(clientId) });
            onChanged();
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const deleteSession = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/clients/${clientId}/sessions/${sessionId}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            success("Session supprimée");
            queryClient.invalidateQueries({ queryKey: qk.clientSessions(clientId) });
            onChanged();
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    const resendEmail = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/clients/${clientId}/sessions/${sessionId}/resend-email`, {
                method: "POST",
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json?.error || "Erreur");
            return json;
        },
        onSuccess: () => {
            success("Email envoyé");
            queryClient.invalidateQueries({ queryKey: qk.clientSessions(clientId) });
        },
        onError: (err: Error) => showError("Erreur", err.message),
    });

    if (!session) {
        return <div className="p-5 text-sm text-slate-500">Session introuvable.</div>;
    }

    const typeLabel = session.type === "Autre" && session.customTypeLabel ? session.customTypeLabel : session.type;

    return (
        <div className="p-5 space-y-4">
            <div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="primary">{typeLabel}</Badge>
                    <span className="text-sm text-slate-600">
                        {new Date(session.date).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                        })}
                    </span>
                    {session.leexiId && <IdChip id={session.leexiId} label="Leexi ID" />}
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                    {session.recordingUrl && (
                        <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                                <Video className="w-3.5 h-3.5 mr-1" /> Enregistrement
                            </Button>
                        </a>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendEmail.mutate()}
                        isLoading={resendEmail.isPending}
                    >
                        <Send className="w-3.5 h-3.5 mr-1" /> Renvoyer email
                    </Button>
                </div>
            </div>

            <Tabs
                tabs={[
                    { id: "cr", label: "Compte-rendu" },
                    { id: "email", label: "Email" },
                    { id: "tasks", label: "Tâches", badge: session.tasks.length },
                ]}
                activeTab={innerTab}
                onTabChange={(id) => setInnerTab(id as typeof innerTab)}
                variant="pills"
            />

            {innerTab === "cr" && (
                <div className="prose prose-sm prose-slate max-w-none text-slate-800">
                    {session.crMarkdown ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{session.crMarkdown}</ReactMarkdown>
                    ) : (
                        <p className="text-sm text-slate-500 italic">Aucun CR enregistré.</p>
                    )}
                </div>
            )}

            {innerTab === "email" && (
                <div className="space-y-3">
                    {session.emailSentAt ? (
                        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 inline-flex items-center gap-1">
                            <Mail className="w-3 h-3" /> Envoyé le {new Date(session.emailSentAt).toLocaleDateString("fr-FR")}
                        </div>
                    ) : (
                        <div className="text-xs text-slate-500 italic">Email pas encore envoyé.</div>
                    )}
                    <pre className="whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 font-sans">
                        {session.summaryEmail || "Pas de mail généré."}
                    </pre>
                </div>
            )}

            {innerTab === "tasks" && (
                <div className="space-y-3">
                    <ul className="space-y-1.5">
                        {session.tasks.length === 0 ? (
                            <li className="text-sm text-slate-500 italic py-2">Aucune tâche.</li>
                        ) : (
                            session.tasks.map((t) => {
                                const overdue = !t.doneAt && t.dueDate && new Date(t.dueDate).getTime() < Date.now();
                                return (
                                    <li
                                        key={t.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg border ${
                                            t.doneAt ? "border-emerald-200 bg-emerald-50/30" : overdue ? "border-red-200 bg-red-50/30" : "border-slate-200"
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={!!t.doneAt}
                                            onChange={(e) => toggleTask.mutate({ taskId: t.id, done: e.target.checked })}
                                            className="w-4 h-4"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm ${t.doneAt ? "line-through text-slate-500" : "text-slate-900"}`}>
                                                {t.label}
                                            </div>
                                            <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                                                {t.assigneeRole && <span>{t.assigneeRole}</span>}
                                                {t.assignee && <span>{t.assignee}</span>}
                                                {t.priority && <span>{t.priority}</span>}
                                                {t.dueDate && (
                                                    <span className={overdue ? "text-red-600" : ""}>
                                                        dû le {new Date(t.dueDate).toLocaleDateString("fr-FR")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {t.doneAt && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                                    </li>
                                );
                            })
                        )}
                    </ul>

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newTask}
                            onChange={(e) => setNewTask(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && newTask.trim()) {
                                    addTask.mutate(newTask.trim());
                                }
                            }}
                            placeholder="Nouvelle tâche…"
                            className="flex-1 h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => newTask.trim() && addTask.mutate(newTask.trim())}
                            isLoading={addTask.isPending}
                            disabled={!newTask.trim()}
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            <div className="pt-3 border-t border-slate-200">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (confirm("Supprimer cette session ?")) deleteSession.mutate();
                    }}
                    isLoading={deleteSession.isPending}
                    className="text-red-600 hover:bg-red-50"
                >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer la session
                </Button>
            </div>
        </div>
    );
}

export default SessionDetailPanel;
