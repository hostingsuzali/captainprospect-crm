"use client";

import { useQuery } from "@tanstack/react-query";
import { Folder, Download, FileText } from "lucide-react";
import { Button, DataTable, type Column, EmptyState, Skeleton, Badge } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { IdChip } from "@/app/manager/_shared/IdChip";
import { ErrorCard } from "@/app/manager/_shared/ErrorCard";
import type { MissionShellData } from "../MissionDetailShell";

interface FileRow {
    id: string;
    name: string;
    originalName?: string;
    mimeType: string;
    size: number;
    formattedSize?: string;
    createdAt: string;
    uploadedBy?: { name?: string };
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function FilesTab({ mission }: { mission: MissionShellData }) {
    const query = useQuery({
        queryKey: qk.missionFiles(mission.id),
        queryFn: async () => {
            const res = await fetch(`/api/files?missionId=${mission.id}&limit=100`);
            const json = await res.json();
            return (json?.data?.files ?? []) as FileRow[];
        },
    });

    const columns: Column<FileRow>[] = [
        {
            header: "Nom",
            accessor: (f) => (
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <div>
                        <div className="font-medium text-slate-900">{f.name}</div>
                        {f.originalName && f.originalName !== f.name && (
                            <div className="text-xs text-slate-500">{f.originalName}</div>
                        )}
                    </div>
                </div>
            ),
            key: "name",
        },
        {
            header: "Type",
            accessor: (f) => <Badge variant="outline" className="text-[10px]">{f.mimeType}</Badge>,
            key: "mimeType",
        },
        {
            header: "Taille",
            accessor: (f) => <span className="text-sm tabular-nums">{f.formattedSize ?? f.size}</span>,
            key: "size",
        },
        { header: "Date", accessor: (f) => formatDate(f.createdAt), key: "date" },
        { header: "Par", accessor: (f) => f.uploadedBy?.name ?? "—", key: "uploadedBy" },
        { header: "ID", accessor: (f) => <IdChip id={f.id} length={6} />, key: "id" },
        {
            header: "",
            accessor: (f) => (
                <a
                    href={`/api/files/${f.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
                >
                    <Download className="w-4 h-4" />
                </a>
            ),
            key: "actions",
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Folder className="w-5 h-5 text-indigo-600" /> Fichiers
                </h2>
            </div>

            {query.isLoading ? (
                <Skeleton className="h-40" />
            ) : query.error ? (
                <ErrorCard message="Erreur" onRetry={() => query.refetch()} />
            ) : (query.data ?? []).length === 0 ? (
                <EmptyState icon={Folder} title="Aucun fichier" description="Aucun fichier associé à cette mission." />
            ) : (
                <DataTable data={query.data ?? []} columns={columns} />
            )}
        </div>
    );
}

export default FilesTab;
