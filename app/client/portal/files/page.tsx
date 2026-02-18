"use client";

import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { PageHeader, Card, Button, EmptyState, useToast } from "@/components/ui";
import { FileText, Upload, Trash2, Loader2, File } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT: Record<string, string[]> = {
    "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    "application/pdf": [".pdf"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "application/vnd.ms-excel": [".xls"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "application/vnd.ms-powerpoint": [".ppt"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    "text/plain": [".txt"],
    "text/csv": [".csv"],
};

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

interface ClientFile {
    id: string;
    originalName: string;
    size: number;
    formattedSize: string;
    createdAt: string;
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export default function ClientPortalFilesPage() {
    const toast = useToast();
    const [files, setFiles] = useState<ClientFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadingCount, setUploadingCount] = useState(0);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchFiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/client/files");
            const json = await res.json();
            if (json.success && json.data?.files) {
                setFiles(json.data.files);
            } else {
                setFiles([]);
            }
        } catch {
            toast.error("Erreur", "Impossible de charger les fichiers");
            setFiles([]);
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return;

            setUploadingCount((c) => c + acceptedFiles.length);

            let successCount = 0;
            let failCount = 0;

            for (const file of acceptedFiles) {
                try {
                    const formData = new FormData();
                    formData.append("file", file);

                    const res = await fetch("/api/files/upload", {
                        method: "POST",
                        body: formData,
                    });

                    const json = await res.json();
                    if (json.success) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch {
                    failCount++;
                }
            }

            setUploadingCount((c) => Math.max(0, c - acceptedFiles.length));

            if (successCount > 0) {
                await fetchFiles();
                toast.success("Fichiers déposés", `${successCount} fichier(s) ajouté(s)`);
            }
            if (failCount > 0) {
                toast.error("Erreur", `${failCount} fichier(s) n'ont pas pu être uploadés`);
            }
        },
        [fetchFiles, toast]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxSize: MAX_SIZE,
        accept: ACCEPT,
        disabled: uploadingCount > 0,
    });

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/client/files/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) {
                setFiles((prev) => prev.filter((f) => f.id !== id));
                toast.success("Fichier supprimé");
            } else {
                toast.error("Erreur", json.error || "Impossible de supprimer");
            }
        } catch {
            toast.error("Erreur", "Impossible de supprimer le fichier");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="flex flex-col min-h-full space-y-6">
            <PageHeader
                title="Mes Fichiers"
                subtitle="Déposez vos fichiers et partagez-les avec votre équipe"
                icon={
                    <span className="flex items-center gap-2 text-indigo-600">
                        <FileText className="w-5 h-5" />
                    </span>
                }
            />

            {/* Drop zone */}
            <div
                {...getRootProps()}
                className={cn(
                    "flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all",
                    isDragActive
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50",
                    uploadingCount > 0 && "opacity-60 pointer-events-none"
                )}
            >
                <input {...getInputProps()} />
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                    {uploadingCount > 0 ? (
                        <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
                    ) : (
                        <Upload className="w-7 h-7 text-slate-400" />
                    )}
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium text-slate-700">
                        {uploadingCount > 0
                            ? "Dépose en cours..."
                            : "Déposez vos fichiers ici"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        ou parcourir — PDF, DOCX, XLSX, images
                    </p>
                </div>
            </div>

            <p className="text-xs text-slate-500">
                Ces fichiers sont accessibles par votre équipe dans le CRM.
            </p>

            {/* File table */}
            <Card className="border-slate-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                ) : files.length === 0 ? (
                    <EmptyState
                        icon={File}
                        title="Aucun fichier déposé"
                        description="Déposez des fichiers dans la zone ci-dessus pour les partager avec votre équipe."
                        variant="inline"
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Fichier
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Taille
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Déposé le
                                    </th>
                                    <th className="w-12" />
                                </tr>
                            </thead>
                            <tbody>
                                {files.map((f) => (
                                    <tr
                                        key={f.id}
                                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                <span className="text-sm font-medium text-slate-900 truncate max-w-[240px]">
                                                    {f.originalName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-500">
                                            {f.formattedSize}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-500">
                                            {formatDate(f.createdAt)}
                                        </td>
                                        <td className="py-3 px-4">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(f.id)}
                                                disabled={deletingId === f.id}
                                                className="text-slate-400 hover:text-red-600"
                                                aria-label="Supprimer"
                                            >
                                                {deletingId === f.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
