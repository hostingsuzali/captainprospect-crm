"use client";

import { useEffect, useState, useMemo } from "react";
import {
    PhoneCall,
    Search,
    X,
    Clock,
    CalendarDays,
    ChevronDown,
    Download,
    RefreshCw,
    Mail,
    Phone,
    Briefcase,
    CheckCircle2,
    Activity,
    Target,
} from "lucide-react";
import { useToast } from "@/components/ui";
import { ACTION_RESULT_LABELS } from "@/lib/types";

// ─── Types (aligned with /api/client/calls) ───────────────────────────────────
interface CallItem {
    id: string;
    createdAt: string;
    callbackDate?: string | null;
    result: string;
    note?: string | null;
    duration?: number | null;
    company?: {
        name: string;
        industry?: string | null;
        country?: string | null;
    } | null;
    contact?: {
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
        email?: string | null;
        phone?: string | null;
        company?: {
            name: string;
            industry?: string | null;
            country?: string | null;
        } | null;
    } | null;
    campaign: {
        name: string;
        mission: { name: string };
    };
}

// Normalized shape for the design components (contact.company always set)
interface NormalizedCall extends CallItem {
    contact: NonNullable<CallItem["contact"]> & {
        company: { name: string };
    };
}

// Status config from API (labels/colors per status and category)
interface StatusDef {
    code: string;
    label: string;
    color: string | null;
    sortOrder: number;
    resultCategoryCode: string | null;
}
interface ResultCategoryDef {
    id: string;
    code: string;
    label: string;
    color: string | null;
    sortOrder: number;
}
function buildResultMeta(
    statuses: StatusDef[],
    categories: ResultCategoryDef[]
): Record<string, { label: string; color: string; bg: string; border: string }> {
    const catByCode = Object.fromEntries(categories.map((c) => [c.code, c]));
    const meta: Record<string, { label: string; color: string; bg: string; border: string }> = {};
    for (const s of statuses) {
        const color = s.color ?? catByCode[s.resultCategoryCode ?? ""]?.color ?? "#64748b";
        meta[s.code] = {
            label: s.label,
            color,
            bg: `${color}18`,
            border: `${color}44`,
        };
    }
    return meta;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDuration(s: number | null | undefined): string | null {
    if (!s || s <= 0) return null;
    const m = Math.floor(s / 60),
        sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}
function dayKey(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Fallback when config not loaded yet
const RESULT_META_FALLBACK: Record<string, { label: string; color: string; bg: string; border: string }> = {
    MEETING_BOOKED: { label: "RDV pris", color: "#059669", bg: "#ecfdf5", border: "#6ee7b7" },
    CALLBACK_REQUESTED: { label: "Rappel demandé", color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
    INTERESTED: { label: "Intéressé", color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
    NO_RESPONSE: { label: "Pas de réponse", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
    DISQUALIFIED: { label: "Disqualifié", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

// ─── Result Badge ─────────────────────────────────────────────────────────────
function ResultBadge({
    result,
    resultMeta,
}: {
    result: string;
    resultMeta: Record<string, { label: string; color: string; bg: string; border: string }>;
}) {
    const meta = resultMeta[result];
    const label = meta?.label ?? ACTION_RESULT_LABELS[result] ?? result;
    const m =
        meta || {
            label,
            color: "#64748b",
            bg: "#f8fafc",
            border: "#e2e8f0",
        };
    return (
        <span
            style={{
                background: m.bg,
                borderColor: m.border,
                color: m.color,
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border leading-none whitespace-nowrap"
        >
            <span
                style={{ background: m.color }}
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            />
            {m.label}
        </span>
    );
}

// ─── Mini stacked progress bar ────────────────────────────────────────────────
function MiniBar({
    counts,
    total,
    statusOrder,
    resultMeta,
}: {
    counts: Record<string, number>;
    total: number;
    statusOrder: string[];
    resultMeta: Record<string, { label: string; color: string; bg: string; border: string }>;
}) {
    return (
        <div className="flex h-1.5 rounded-full overflow-hidden w-full bg-slate-100">
            {statusOrder.map((k) => {
                const pct = total ? ((counts[k] || 0) / total) * 100 : 0;
                return pct > 0 ? (
                    <div
                        key={k}
                        style={{
                            width: `${pct}%`,
                            background: resultMeta[k]?.color ?? "#64748b",
                        }}
                    />
                ) : null;
            })}
        </div>
    );
}

// ─── Single Call Card ─────────────────────────────────────────────────────────
function CallCard({
    call,
    resultMeta,
}: {
    call: NormalizedCall;
    resultMeta: Record<string, { label: string; color: string; bg: string; border: string }>;
}) {
    const [noteOpen, setNoteOpen] = useState(false);
    const name =
        [call.contact?.firstName, call.contact?.lastName]
            .filter(Boolean)
            .join(" ") || "—";
    const co = call.contact?.company?.name ?? "—";
    const dur = fmtDuration(call.duration ?? null);

    return (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:border-slate-200 transition-colors">
            <div className="flex items-start gap-3 p-3.5">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-[13px] font-bold text-slate-500 uppercase select-none">
                    {call.contact?.firstName?.[0] ?? ""}
                    {call.contact?.lastName?.[0] ?? ""}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                                {name}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                <Briefcase className="w-3 h-3 text-slate-300 flex-shrink-0" />
                                <span className="truncate">
                                    {call.contact?.title ?? "—"} · {co}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <ResultBadge result={call.result} resultMeta={resultMeta} />
                            <span className="text-[11px] text-slate-400 tabular-nums">
                                {fmtTime(call.createdAt)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {dur && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="w-3 h-3" />
                                {dur}
                            </span>
                        )}
                        {call.note && (
                            <button
                                type="button"
                                onClick={() => setNoteOpen((o) => !o)}
                                className="flex items-center gap-1 text-[11px] text-violet-500 hover:text-violet-700 font-medium transition-colors"
                            >
                                <ChevronDown
                                    className={`w-3 h-3 transition-transform ${noteOpen ? "rotate-180" : ""}`}
                                />
                                Note de l&apos;agent
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 px-3.5 py-2 bg-slate-50/70 border-t border-slate-50">
                {call.contact?.email && (
                    <a
                        href={`mailto:${call.contact.email}`}
                        className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-violet-600 transition-colors"
                    >
                        <Mail className="w-3 h-3 text-slate-400" />
                        {call.contact.email}
                    </a>
                )}
                {call.contact?.phone && (
                    <a
                        href={`tel:${call.contact.phone}`}
                        className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-violet-600 transition-colors"
                    >
                        <Phone className="w-3 h-3 text-slate-400" />
                        {call.contact.phone}
                    </a>
                )}
            </div>

            {call.note && noteOpen && (
                <div className="px-3.5 py-3 border-t border-slate-50">
                    <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5">
                        <p className="text-xs text-violet-700 italic leading-relaxed">
                            &quot;{call.note}&quot;
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Day Block ────────────────────────────────────────────────────────────────
function DayBlock({
    dateKey: dk,
    calls,
    statusOrder,
    resultMeta,
}: {
    dateKey: string;
    calls: NormalizedCall[];
    statusOrder: string[];
    resultMeta: Record<string, { label: string; color: string; bg: string; border: string }>;
}) {
    const [open, setOpen] = useState(false);

    // Counts by result; ensure every status in config has an entry (default 0)
    const counts: Record<string, number> = {};
    statusOrder.forEach((code) => {
        counts[code] = 0;
    });
    calls.forEach((c) => {
        counts[c.result] = (counts[c.result] ?? 0) + 1;
    });
    const displayStatuses = Array.from(
        new Set([
            ...statusOrder,
            ...Object.keys(counts).filter((k) => counts[k] > 0),
        ])
    );
    const d = new Date(dk);

    return (
        <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50/50 transition-colors text-left"
            >
                <div className="flex-shrink-0 w-14 text-center bg-slate-900 text-white rounded-xl py-2 px-1">
                    <p className="text-[9px] font-semibold uppercase tracking-widest opacity-50 leading-none">
                        {d.toLocaleDateString("fr-FR", { weekday: "short" })}
                    </p>
                    <p className="text-2xl font-black leading-tight">
                        {d.getDate()}
                    </p>
                    <p className="text-[9px] font-semibold uppercase tracking-widest opacity-50 leading-none">
                        {d.toLocaleDateString("fr-FR", { month: "short" })}
                    </p>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">
                            {calls.length} appel{calls.length > 1 ? "s" : ""}
                        </span>
                        <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                            {displayStatuses.map((k) => {
                                const v = counts[k] ?? 0;
                                if (!v) return null;
                                return (
                                    <span
                                        key={k}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100"
                                    >
                                        <span
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{
                                                background: resultMeta[k]?.color ?? "#64748b",
                                            }}
                                        />
                                        <span className="font-semibold">
                                            {v}{" "}
                                            {resultMeta[k]?.label ??
                                                ACTION_RESULT_LABELS[k] ??
                                                k}
                                        </span>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 max-w-[200px]">
                            <MiniBar counts={counts} total={calls.length} statusOrder={statusOrder} resultMeta={resultMeta} />
                        </div>
                    </div>
                </div>

                <ChevronDown
                    className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3 space-y-2.5">
                    {[...calls]
                        .sort(
                            (a, b) =>
                                new Date(a.createdAt).getTime() -
                                new Date(b.createdAt).getTime()
                        )
                        .map((c) => (
                            <CallCard key={c.id} call={c} resultMeta={resultMeta} />
                        ))}
                </div>
            )}
        </div>
    );
}

// ─── Mission Section ──────────────────────────────────────────────────────────
function MissionSection({
    missionName,
    calls,
    defaultOpen,
    statusOrder,
    resultMeta,
}: {
    missionName: string;
    calls: NormalizedCall[];
    defaultOpen: boolean;
    statusOrder: string[];
    resultMeta: Record<string, { label: string; color: string; bg: string; border: string }>;
}) {
    const [open, setOpen] = useState(defaultOpen);

    const byDay = useMemo(() => {
        const map: Record<string, NormalizedCall[]> = {};
        calls.forEach((c) => {
            const k = dayKey(c.createdAt);
            if (!map[k]) map[k] = [];
            map[k].push(c);
        });
        return Object.entries(map).sort(([a], [b]) =>
            b.localeCompare(a)
        );
    }, [calls]);

    const meetings = calls.filter((c) => c.result === "MEETING_BOOKED").length;
    const convRate = calls.length
        ? Math.round((meetings / calls.length) * 100)
        : 0;
    const campaigns = [...new Set(calls.map((c) => c.campaign.name))];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-start gap-4 px-5 py-4 hover:bg-slate-50/40 transition-colors text-left"
            >
                <div className="flex-shrink-0 mt-0.5 h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-md shadow-violet-200">
                    <Target className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <p className="text-[15px] font-bold text-slate-900">
                                {missionName}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Mission{campaigns.length > 1 ? "s" : ""} :{" "}
                                {campaigns.join(", ")}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                            {[
                                {
                                    value: calls.length,
                                    label: "appels",
                                    color: "text-slate-800",
                                },
                                {
                                    value: byDay.length,
                                    label: "jours",
                                    color: "text-sky-700",
                                },
                                {
                                    value: meetings,
                                    label: "RDV",
                                    color: "text-emerald-700",
                                },
                                {
                                    value: `${convRate}%`,
                                    label: "taux",
                                    color: "text-violet-700",
                                },
                            ].map(({ value, label, color }) => (
                                <div
                                    key={label}
                                    className="text-center bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5"
                                >
                                    <p
                                        className={`text-base font-black leading-none ${color}`}
                                    >
                                        {value}
                                    </p>
                                    <p className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">
                                        {label}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <ChevronDown
                    className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-1 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <div className="border-t border-slate-100 bg-[#FAFBFC] px-5 py-4 space-y-3">
                    {byDay.map(([dk, dayCalls]) => (
                        <DayBlock
                            key={dk}
                            dateKey={dk}
                            calls={dayCalls}
                            statusOrder={statusOrder}
                            resultMeta={resultMeta}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Normalize API call to design shape ───────────────────────────────────────
function normalizeCall(c: CallItem): NormalizedCall {
    const companyName =
        c.contact?.company?.name ?? c.company?.name ?? "—";
    return {
        ...c,
        contact: c.contact
            ? {
                  ...c.contact,
                  company: { name: companyName },
              }
            : {
                  firstName: null,
                  lastName: null,
                  title: null,
                  email: null,
                  phone: null,
                  company: { name: companyName },
              },
    } as NormalizedCall;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ClientPortalActivitePage() {
    const { error: showError } = useToast();
    const [calls, setCalls] = useState<CallItem[]>([]);
    const [statusConfig, setStatusConfig] = useState<{
        statuses: StatusDef[];
        categories: ResultCategoryDef[];
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState("30");

    const resultMeta = useMemo(() => {
        if (statusConfig?.statuses?.length && statusConfig?.categories?.length) {
            return buildResultMeta(statusConfig.statuses, statusConfig.categories);
        }
        return RESULT_META_FALLBACK;
    }, [statusConfig]);

    const statusOrder = useMemo(() => {
        if (statusConfig?.statuses?.length) {
            return statusConfig.statuses.map((s) => s.code);
        }
        return ["MEETING_BOOKED", "CALLBACK_REQUESTED", "INTERESTED", "NO_RESPONSE", "DISQUALIFIED"];
    }, [statusConfig]);

    useEffect(() => {
        fetch("/api/client/action-status-config")
            .then((r) => r.json())
            .then((json) => {
                if (json.success && json.data?.statuses) {
                    setStatusConfig({
                        statuses: json.data.statuses,
                        categories: json.data.categories ?? [],
                    });
                }
            })
            .catch(() => {});
    }, []);

    const fetchCalls = useMemo(
        () => async () => {
            setIsLoading(true);
            try {
                const d = new Date();
                d.setDate(d.getDate() - parseInt(dateRange, 10));
                const startDate = d.toISOString().split("T")[0];
                const end = new Date();
                end.setHours(23, 59, 59, 999);
                const endDate = end.toISOString().split("T")[0];
                const res = await fetch(
                    `/api/client/calls?startDate=${startDate}&endDate=${endDate}`
                );
                const json = await res.json();
                if (json.success && json.data?.items) {
                    setCalls(json.data.items);
                } else {
                    showError(
                        "Erreur",
                        json.error ?? "Impossible de charger l'activité"
                    );
                }
            } catch {
                showError("Erreur", "Impossible de charger l'activité");
            } finally {
                setIsLoading(false);
            }
        },
        [dateRange, showError]
    );

    useEffect(() => {
        fetchCalls();
    }, [fetchCalls]);

    const dateThreshold = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - parseInt(dateRange, 10));
        return d;
    }, [dateRange]);

    const filtered = useMemo(() => {
        let arr = calls.filter(
            (c) => new Date(c.createdAt) >= dateThreshold
        );
        if (search.trim()) {
            const q = search.toLowerCase();
            arr = arr.filter((c) =>
                [
                    c.contact?.firstName,
                    c.contact?.lastName,
                    c.contact?.email,
                    c.contact?.phone,
                    c.contact?.title,
                    c.contact?.company?.name,
                    c.company?.name,
                    c.campaign?.mission?.name,
                    c.campaign?.name,
                    c.note,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(q)
            );
        }
        return arr;
    }, [calls, dateThreshold, search]);

    const normalizedFiltered = useMemo(
        () => filtered.map(normalizeCall),
        [filtered]
    );

    const byMission = useMemo(() => {
        const map: Record<string, NormalizedCall[]> = {};
        normalizedFiltered.forEach((c) => {
            const k = c.campaign?.mission?.name ?? "—";
            if (!map[k]) map[k] = [];
            map[k].push(c);
        });
        return Object.entries(map).sort(
            ([, a], [, b]) => b.length - a.length
        );
    }, [normalizedFiltered]);

    const stats = useMemo(() => {
        const meetings = normalizedFiltered.filter(
            (c) => c.result === "MEETING_BOOKED"
        ).length;
        const activeDays = new Set(
            normalizedFiltered.map((c) => dayKey(c.createdAt))
        ).size;
        const missions = new Set(
            normalizedFiltered.map((c) => c.campaign?.mission?.name)
        ).size;
        return {
            total: normalizedFiltered.length,
            meetings,
            activeDays,
            missions,
            convRate: normalizedFiltered.length
                ? Math.round(
                      (meetings / normalizedFiltered.length) * 100
                  )
                : 0,
        };
    }, [normalizedFiltered]);

    return (
        <div
            className="min-h-full bg-[#F3F4F8] p-4 md:p-6 space-y-5"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-200">
                            <PhoneCall className="w-5 h-5" />
                        </span>
                        Activité de prospection
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 ml-[52px]">
                        Jours travaillés, contacts appelés et résultats obtenus
                        par mission.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="h-9 pl-3 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm cursor-pointer"
                    >
                        <option value="7">7 derniers jours</option>
                        <option value="30">30 derniers jours</option>
                        <option value="60">60 derniers jours</option>
                        <option value="90">90 derniers jours</option>
                    </select>
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" /> Export
                    </button>
                    <button
                        type="button"
                        onClick={() => fetchCalls()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50"
                    >
                        <RefreshCw
                            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
                        />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    {
                        icon: Activity,
                        label: "Appels passés",
                        value: stats.total,
                        sub: `sur ${dateRange} jours`,
                        accent: "#6366f1",
                    },
                    {
                        icon: CalendarDays,
                        label: "Jours travaillés",
                        value: stats.activeDays,
                        sub: "jours d'activité",
                        accent: "#0ea5e9",
                    },
                    {
                        icon: CheckCircle2,
                        label: "RDV obtenus",
                        value: stats.meetings,
                        sub: `taux de conv. ${stats.convRate}%`,
                        accent: "#10b981",
                    },
                    {
                        icon: Target,
                        label: "Missions actives",
                        value: stats.missions,
                        sub: "sur la période",
                        accent: "#8b5cf6",
                    },
                ].map(({ icon: Icon, label, value, sub, accent }) => (
                    <div
                        key={label}
                        className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-4"
                    >
                        <span
                            className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                            style={{ background: `${accent}18` }}
                        >
                            <Icon className="w-5 h-5" style={{ color: accent }} />
                        </span>
                        <div>
                            <p className="text-xl font-bold text-slate-900 leading-none">
                                {value}
                            </p>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">
                                {label}
                            </p>
                            <p className="text-[11px] text-slate-400">{sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un contact, une entreprise…"
                    className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm placeholder:text-slate-400"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                        <span className="text-sm">
                            Chargement de l&apos;activité…
                        </span>
                    </div>
                </div>
            ) : byMission.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-200 rounded-2xl py-20 px-6 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <PhoneCall className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                        Aucune activité trouvée
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                        Ajustez la période ou la recherche.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {byMission.map(([mission, mCalls], idx) => (
                        <MissionSection
                            key={mission}
                            missionName={mission}
                            calls={mCalls}
                            defaultOpen={idx === 0}
                            statusOrder={statusOrder}
                            resultMeta={resultMeta}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
