"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { ExternalLink, Phone, User, Building2, Loader2 } from "lucide-react";
import { Card, DataTable } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { Select } from "@/components/ui";
import { MOCK_CALLS, MOCK_SDRS, MOCK_CAMPAIGNS } from "@/lib/calls/mock-data";
import { cn } from "@/lib/utils";

// ============================================
// TYPES (API + fallback)
// ============================================

type CallStatus =
  | "queued"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "missed"
  | "no-answer"
  | "callback-requested";

interface CallRow {
  id: string;
  contactName: string;
  companyName: string;
  date: string;
  duration: number;
  status: CallStatus;
  recordingUrl: string | null;
  result: string | null;
  note: string | null;
  sdrName: string;
}

const STATUS_LABELS: Record<string, string> = {
  queued: "En file",
  ringing: "En cours",
  in_progress: "En communication",
  completed: "Complété",
  failed: "Échoué",
  missed: "Manqué",
  "no-answer": "Pas de réponse",
  "callback-requested": "Rappel demandé",
  ended: "Terminé",
};

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-slate-100 text-slate-700",
  ringing: "bg-amber-100 text-amber-800",
  in_progress: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  missed: "bg-red-100 text-red-800",
  "no-answer": "bg-slate-100 text-slate-600",
  "callback-requested": "bg-blue-100 text-blue-800",
  ended: "bg-slate-100 text-slate-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function mapApiCallToRow(c: {
  id: string;
  startTime: string | Date;
  durationSeconds: number | null;
  status: string;
  recordingUrl: string | null;
  contact?: { firstName?: string | null; lastName?: string | null } | null;
  company?: { name: string } | null;
  user?: { name: string | null } | null;
  action?: { result: string; note: string | null } | null;
}): CallRow {
  const contactName = c.contact
    ? [c.contact.firstName, c.contact.lastName].filter(Boolean).join(" ") || "—"
    : c.company?.name ?? "—";
  const companyName = c.company?.name ?? "—";
  return {
    id: c.id,
    contactName,
    companyName,
    date: new Date(c.startTime).toISOString(),
    duration: c.durationSeconds ?? 0,
    status: c.status as CallStatus,
    recordingUrl: c.recordingUrl,
    result: c.action?.result ?? null,
    note: c.action?.note ?? null,
    sdrName: c.user?.name ?? "—",
  };
}

// ============================================
// CALL HISTORY
// ============================================

export function CallHistory() {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER";

  const [filterUserId, setFilterUserId] = useState<string>("");
  const [filterCampaign, setFilterCampaign] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);

  const [sdrOptions, setSdrOptions] = useState<{ value: string; label: string }[]>([
    { value: "", label: "Tous les SDR" },
    ...MOCK_SDRS.map((s) => ({ value: s.id, label: s.name })),
  ]);

  useEffect(() => {
    if (isManager) {
      fetch("/api/users?role=SDR,BUSINESS_DEVELOPER&limit=50")
        .then((r) => r.json())
        .then((j) => {
          if (j.success && j.data?.users) {
            setSdrOptions([
              { value: "", label: "Tous les SDR" },
              ...j.data.users.map((u: { id: string; name: string | null }) => ({
                value: u.id,
                label: u.name || u.id,
              })),
            ]);
          }
        })
        .catch(() => {});
    }
  }, [isManager]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "50");
    if (filterDateFrom) params.set("fromDate", filterDateFrom);
    if (filterDateTo) params.set("toDate", filterDateTo);
    if (filterStatus) params.set("status", filterStatus);
    if (filterCampaign) params.set("campaignId", filterCampaign);
    if (isManager && filterUserId) params.set("userId", filterUserId);

    fetch(`/api/calls?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.data?.calls)) {
          setUseMock(false);
          setCalls(data.data.calls.map(mapApiCallToRow));
          setTotal(data.data.total ?? data.data.calls.length);
        } else {
          setUseMock(true);
          const mockRows: CallRow[] = MOCK_CALLS.map((c) => ({
            id: c.id,
            contactName: c.contactName,
            companyName: c.companyName,
            date: c.date,
            duration: c.duration,
            status: c.status as CallStatus,
            recordingUrl: c.recordingUrl,
            result: c.result,
            note: c.note,
            sdrName: c.sdrName,
          }));
          setCalls(mockRows);
          setTotal(mockRows.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUseMock(true);
          setCalls(
            MOCK_CALLS.map((c) => ({
              id: c.id,
              contactName: c.contactName,
              companyName: c.companyName,
              date: c.date,
              duration: c.duration,
              status: c.status as CallStatus,
              recordingUrl: c.recordingUrl,
              result: c.result,
              note: c.note,
              sdrName: c.sdrName,
            }))
          );
          setTotal(MOCK_CALLS.length);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterUserId, filterCampaign, filterDateFrom, filterDateTo, filterStatus, isManager]);

  const campaignOptions = [
    { value: "", label: "Toutes les campagnes" },
    ...MOCK_CAMPAIGNS.map((c) => ({ value: c.id, label: c.name })),
  ];
  const statusOptions = [
    { value: "", label: "Tous les statuts" },
    { value: "completed", label: "Complété" },
    { value: "failed", label: "Échoué" },
    { value: "ringing", label: "En cours" },
    { value: "queued", label: "En file" },
  ];

  const columns: Column<CallRow>[] = [
    {
      key: "contact",
      header: "Contact / Société",
      sortable: true,
      width: "22%",
      render: (_, row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-900 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {row.contactName}
          </span>
          <span className="text-sm text-slate-500 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {row.companyName}
          </span>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date / Heure",
      sortable: true,
      width: "14%",
      render: (_, row) => <span className="text-sm text-slate-600">{formatDate(row.date)}</span>,
    },
    {
      key: "duration",
      header: "Durée",
      sortable: true,
      width: "8%",
      render: (_, row) => (
        <span className="text-sm font-mono text-slate-700">{formatDuration(row.duration)}</span>
      ),
    },
    {
      key: "status",
      header: "Statut",
      sortable: true,
      width: "12%",
      render: (_, row) => <StatusBadge status={row.status} />,
    },
    {
      key: "recording",
      header: "Enregistrement",
      width: "14%",
      render: (_, row) =>
        row.recordingUrl ? (
          <a
            href={row.recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Écouter
          </a>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        ),
    },
    {
      key: "note",
      header: "Action / Note",
      width: "30%",
      render: (_, row) => (
        <div className="text-sm text-slate-600 max-w-[240px]">
          {row.result && <span className="font-medium text-slate-700">{row.result}</span>}
          {row.note && (
            <p className="truncate mt-0.5" title={row.note}>
              {row.note}
            </p>
          )}
          {!row.result && !row.note && "—"}
        </div>
      ),
    },
  ];

  return (
    <Card variant="elevated" className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50/80">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Phone className="w-5 h-5 text-indigo-600" />
          Historique des appels
          {useMock && (
            <span className="text-xs font-normal text-amber-600">(données de démo)</span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {isManager && (
            <Select
              options={sdrOptions}
              value={filterUserId}
              onChange={setFilterUserId}
              placeholder="SDR"
              className="w-[180px]"
            />
          )}
          <Select
            options={campaignOptions}
            value={filterCampaign}
            onChange={setFilterCampaign}
            placeholder="Campagne"
            className="w-[200px]"
          />
          <Select
            options={statusOptions}
            value={filterStatus}
            onChange={setFilterStatus}
            placeholder="Statut"
            className="w-[140px]"
          />
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm w-[140px]"
          />
          <span className="text-slate-400 text-sm">→</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm w-[140px]"
          />
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <span className="text-sm text-slate-500">Chargement...</span>
          </div>
        ) : (
          <DataTable<CallRow>
            data={calls}
            columns={columns}
            keyField="id"
            searchable
            searchPlaceholder="Rechercher contact, société..."
            searchFields={["contactName", "companyName", "sdrName"]}
            pagination
            pageSize={10}
            emptyMessage="Aucun appel"
          />
        )}
      </div>
    </Card>
  );
}
