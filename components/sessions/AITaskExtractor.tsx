"use client";

import { useState } from "react";
import {
    Sparkles,
    Loader2,
    CheckCircle2,
    Circle,
    Trash2,
    Plus,
    Headphones,
    Briefcase,
    Monitor,
    Users,
    Zap,
    ArrowUp,
    ArrowRight,
    ArrowDown,
    Wand2,
    AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export interface ExtractedTask {
    label: string;
    assigneeRole: "SDR" | "MANAGER" | "DEV" | "ALWAYS";
    assignee: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

interface AITaskExtractorProps {
    content: string; // CR markdown or session text
    clientName?: string;
    sessionType?: string;
    tasks: ExtractedTask[];
    onTasksChange: (tasks: ExtractedTask[]) => void;
    compact?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const ROLE_OPTIONS = [
    { key: "SDR", label: "SDR", icon: Headphones, color: "#10B981" },
    { key: "MANAGER", label: "Manager", icon: Briefcase, color: "#F59E0B" },
    { key: "DEV", label: "Dev", icon: Monitor, color: "#3B82F6" },
    { key: "ALWAYS", label: "Tous", icon: Users, color: "#8B5CF6" },
] as const;

const PRIORITY_OPTIONS = [
    { key: "URGENT", label: "Urgent", icon: Zap, color: "#EF4444" },
    { key: "HIGH", label: "Haute", icon: ArrowUp, color: "#F59E0B" },
    { key: "MEDIUM", label: "Moyenne", icon: ArrowRight, color: "#3B82F6" },
    { key: "LOW", label: "Basse", icon: ArrowDown, color: "#6B7280" },
] as const;

// ============================================
// COMPONENT
// ============================================

export default function AITaskExtractor({
    content,
    clientName,
    sessionType,
    tasks,
    onTasksChange,
    compact = false,
}: AITaskExtractorProps) {
    const [isExtracting, setIsExtracting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<string | null>(null);

    // ── Extract Tasks via Mistral ──
    const handleExtract = async () => {
        if (!content || content.trim().length < 10) {
            setError("Le contenu est trop court pour extraire des tâches.");
            return;
        }

        setIsExtracting(true);
        setError(null);
        setSummary(null);

        try {
            const res = await fetch("/api/ai/mistral/extract-tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: content.trim(),
                    clientName,
                    sessionType,
                }),
            });

            const json = await res.json();

            if (!json.success) {
                setError(json.error || "Erreur lors de l'extraction");
                return;
            }

            const extracted: ExtractedTask[] = json.data.tasks || [];
            onTasksChange([...tasks, ...extracted]);
            setSummary(json.data.summary || null);
        } catch (err) {
            setError("Erreur de connexion. Vérifiez votre connexion internet.");
        } finally {
            setIsExtracting(false);
        }
    };

    // ── Add Manual Task ──
    const addEmptyTask = () => {
        onTasksChange([
            ...tasks,
            { label: "", assigneeRole: "ALWAYS", assignee: null, priority: "MEDIUM" },
        ]);
    };

    // ── Remove Task ──
    const removeTask = (index: number) => {
        onTasksChange(tasks.filter((_, i) => i !== index));
    };

    // ── Update Task ──
    const updateTask = (index: number, field: keyof ExtractedTask, value: string | null) => {
        const updated = [...tasks];
        (updated[index] as any)[field] = value;
        onTasksChange(updated);
    };

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="space-y-4">
            {/* ── Header with AI Extract Button ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #7C5CFC 0%, #A78BFA 100%)" }}
                    >
                        <Wand2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-[14px] font-bold text-[#12122A]">Tâches d'équipe</h3>
                        <p className="text-[11px] text-[#8B8BA7]">
                            {tasks.length > 0
                                ? `${tasks.length} tâche${tasks.length > 1 ? "s" : ""} identifiée${tasks.length > 1 ? "s" : ""}`
                                : "Extraire les tâches du CR"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={addEmptyTask}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-white border border-[#E8EBF0] text-[#5A5A7A] hover:border-[#C5C8D4] hover:text-[#12122A] transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter
                    </button>

                    <button
                        onClick={handleExtract}
                        disabled={isExtracting || !content || content.trim().length < 10}
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all shadow-sm",
                            "text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                        style={{
                            background: isExtracting
                                ? "#6C4CE0"
                                : "linear-gradient(135deg, #7C5CFC 0%, #6C4CE0 100%)",
                        }}
                    >
                        {isExtracting ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Extraction IA...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-3.5 h-3.5" />
                                Extraire avec IA
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* ── AI Summary ── */}
            {summary && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] text-[12px] text-[#4338CA]">
                    <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{summary}</p>
                </div>
            )}

            {/* ── Task List ── */}
            {tasks.length > 0 && (
                <div className="space-y-2">
                    {tasks.map((task, index) => (
                        <div
                            key={index}
                            className="group bg-white border border-[#E8EBF0] rounded-xl p-3 hover:border-[#C5C8D4] transition-all"
                        >
                            {/* Task Label */}
                            <div className="flex items-start gap-2.5 mb-2.5">
                                <div className="mt-1 flex-shrink-0 text-[#C5C8D4]">
                                    <Circle className="w-4 h-4" />
                                </div>
                                <input
                                    value={task.label}
                                    onChange={(e) => updateTask(index, "label", e.target.value)}
                                    className="flex-1 text-[13px] font-medium text-[#12122A] placeholder:text-[#B0B0C7] bg-transparent border-none outline-none"
                                    placeholder="Description de la tâche..."
                                />
                                <button
                                    onClick={() => removeTask(index)}
                                    className="flex-shrink-0 text-[#C5C8D4] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Task Meta */}
                            <div className="flex items-center gap-2 ml-[26px] flex-wrap">
                                {/* Role Selector */}
                                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#F4F6F9]">
                                    {ROLE_OPTIONS.map((role) => {
                                        const Icon = role.icon;
                                        const isActive = task.assigneeRole === role.key;
                                        return (
                                            <button
                                                key={role.key}
                                                onClick={() => updateTask(index, "assigneeRole", role.key)}
                                                className={cn(
                                                    "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
                                                    isActive
                                                        ? "bg-white shadow-sm"
                                                        : "text-[#8B8BA7] hover:text-[#5A5A7A]"
                                                )}
                                                style={isActive ? { color: role.color } : {}}
                                                title={role.label}
                                            >
                                                <Icon className="w-3 h-3" />
                                                {!compact && role.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Priority Selector */}
                                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#F4F6F9]">
                                    {PRIORITY_OPTIONS.map((p) => {
                                        const Icon = p.icon;
                                        const isActive = task.priority === p.key;
                                        return (
                                            <button
                                                key={p.key}
                                                onClick={() => updateTask(index, "priority", p.key)}
                                                className={cn(
                                                    "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
                                                    isActive
                                                        ? "bg-white shadow-sm"
                                                        : "text-[#8B8BA7] hover:text-[#5A5A7A]"
                                                )}
                                                style={isActive ? { color: p.color } : {}}
                                                title={p.label}
                                            >
                                                <Icon className="w-3 h-3" />
                                                {!compact && p.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Assignee Input */}
                                <input
                                    value={task.assignee || ""}
                                    onChange={(e) =>
                                        updateTask(index, "assignee", e.target.value || null)
                                    }
                                    placeholder="Assigné..."
                                    className="text-[11px] font-medium text-[#5A5A7A] placeholder:text-[#B0B0C7] bg-[#F4F6F9] border-none outline-none rounded-md px-2.5 py-1.5 w-28 focus:ring-1 focus:ring-[#7C5CFC]/20"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Empty State ── */}
            {tasks.length === 0 && !isExtracting && (
                <div className="flex flex-col items-center py-8 border-2 border-dashed border-[#E8EBF0] rounded-xl">
                    <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                        style={{ background: "#F4F6F9" }}
                    >
                        <Wand2 className="w-5 h-5 text-[#C5C8D4]" />
                    </div>
                    <p className="text-[13px] font-semibold text-[#12122A]">
                        Aucune tâche encore
                    </p>
                    <p className="text-[11px] text-[#8B8BA7] mt-1 text-center max-w-[260px]">
                        Cliquez sur "Extraire avec IA" pour que Mistral analyse le CR et identifie les tâches automatiquement
                    </p>
                </div>
            )}
        </div>
    );
}
