"use client";

import { useQuery } from "@tanstack/react-query";
import { Folder, File as FileIcon, Download } from "lucide-react";
import { Button, Badge, EmptyState, Skeleton, DataTable, type Column } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { ClientShellData } from "../ClientDetailShell";

interface FileRow {
    id: string;
    name: string;
    mimeType?: string | null;
    size?: number | null;
    url?: string | null;
    createdAt: string;
    folder?: { id: string; name: string } | null;
}

export function FilesTab({ client }: { client: ClientShellData }) {
    const query = useQuery({
        queryKey: qk.clientFiles(client.id),
        queryFn: async () => {
            const res = await fetch(`/api/files?clientId=${client.id}&limit=200`);
            const json = await res.json();
            return (json?.data ?? []) as FileRow[];
        },
    });

    const columns: Column<FileRow>[] = [
        {
            key: "name",
            header: "Nom",
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <FileIcon className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-900">{row.name}</span>
                    <IdChip id={row.id} length={5} />
                </div>
            ),
        },
        {
            key: "folder",
            header: "Dossier",
            render: (_, row) => (row.folder ? <Badge variant="outline">{row.folder.name}</Badge> : "—"),
        },
        {
            key: "size",
            header: "Taille",
            render: (_, row) => (row.size ? formatBytes(row.size) : "—"),
        },
        {
            key: "createdAt",
            header: "Ajouté le",
            render: (_, row) => new Date(row.createdAt).toLocaleDateString("fr-FR"),
        },
        {
            key: "actions",
            header: "",
            render: (_, row) =>
                row.url ? (
                    <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-indigo-600"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Download className="w-4 h-4" />
                    </a>
                ) : null,
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Folder className="w-5 h-5 text-indigo-600" />
                    Fichiers ({client._count.files})
                </h2>
            </div>

            {query.isLoading ? (
                <Skeleton className="h-40" />
            ) : query.error ? (
                <ErrorCard message="Impossible de charger les fichiers" onRetry={() => query.refetch()} />
            ) : (query.data ?? []).length === 0 ? (
                <EmptyState icon={Folder} title="Aucun fichier" description="Téléversez des fichiers depuis la page Fichiers." />
            ) : (
                <DataTable
                    data={query.data ?? []}
                    columns={columns}
                    keyField="id"
                    searchable
                    searchPlaceholder="Rechercher..."
                    searchFields={["name" as keyof FileRow]}
                    pagination
                    pageSize={20}
                />
            )}
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default FilesTab;
