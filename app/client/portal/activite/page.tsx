"use client";

import { useEffect, useState, useMemo } from "react";
import {
    PhoneCall,
    Search,
    X,
    Clock,
    CalendarDays,
    ChevronDown,
    RefreshCw,
    Mail,
    Phone,
    Briefcase,
    CheckCircle2,
    Activity,
    Target,
    TrendingUp,
    Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui";
import { ACTION_RESULT_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CallItem {
    id: string;
    createdAt: string;
    callbackDate?: string | null;
    result: string;
    note?: string | null;
    duration?: number | null;
    company?: { name: string; industry?: string | null; country?: string | null } | null;
    contact?: {
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
        email?: string | null;
        phone?: string | null;
        company?: { name: string; industry?: string | null; country?: string | null } | null;
    } | null;
    campaign: { name: string; mission: { name: string } };
}
interface NormalizedCall extends CallItem {
    contact: NonNullable<CallItem["contact"]> & { company: { name: string } };
}
interface StatusDef {
    code: string; label: string; color: string | null; sortOrder: number; resultCategoryCode: string | null;
}
interface ResultCategoryDef {
    id: string; code: string; label: string; color: string | null; sortOrder: number;
}

function buildResultMeta(
    statuses: StatusDef[],
    categories: ResultCategoryDef[]
): Record<string, { label: string; color: string; bg: string; border: string }> {
    const catByCode = Object.fromEntries(categories.map((c) => [c.code, c]));
    const meta: Record<string, { label: string; color: string; bg: string; border: string }> = {};
    for (const s of statuses) {
        const color = s.color ?? catByCode[s.resultCategoryCode ?? ""]?.color ?? "#64748b";
        meta[s.code] = { label: s.label, color, bg: `${color}18`, border: `${color}44` };
    }
    return meta;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDuration(s: number | null | undefined): string | null {
    if (!s || s <= 0) return null;
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function dayKey(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getInitials(first?: string | null, last?: string | null): string {
    return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}`;
}

const RESULT_META_FALLBACK: Record<string, { label: string; color: string; bg: string; border: string }> = {
    MEETING_BOOKED: { label: "RDV pris", color: "#059669", bg: "#ecfdf5", border: "#6ee7b7" },
    CALLBACK_REQUESTED: { label: "Rappel demandé", color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
    INTERESTED: { label: "Intéressé", color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
    NO_RESPONSE: { label: "Pas de réponse", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
    DISQUALIFIED: { label: "Disqualifié", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

// Avatar gradient palettes keyed by first letter
const AVATAR_GRADIENTS: Record<string, string> = {
    A: "from-violet-500 to-indigo-600", B: "from-indigo-500 to-blue-600",
    C: "from-blue-500 to-cyan-600",     D: "from-cyan-500 to-teal-600",
    E: "from-teal-500 to-emerald-600",  F: "from-emerald-500 to-green-600",
    G: "from-green-500 to-lime-600",    H: "from-amber-500 to-orange-600",
    I: "from-orange-500 to-red-600",    J: "from-rose-500 to-pink-600",
    K: "from-pink-500 to-fuchsia-600",  L: "from-fuchsia-500 to-violet-600",
};
function avatarGradient(name: string): string {
    const letter = name.trim().toUpperCase()[0] ?? "A";
    return AVATAR_GRADIENTS[letter] ?? "from-violet-500 to-indigo-600";
}

// ─── Result Badge ─────────────────────────────────────────────────────────────
function ResultBadge({ result, resultMeta }: {
    result: string;
    resultMeta: Record<string, { label: string; color: string; bg: string; border: string }>;
}) {
    const meta = resultMeta[result] ?? { label: ACTION_RESULT_LABELS[result] ?? result, color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" };
    return (
        <span
            style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border leading-none whitespace-nowrap"
        >
            <span style={{ background: meta.color }} className="w-1.5 h-1.5 rounded-full flex-shrink-0" />
            {meta.label}
        </span>
    );
}

// ─── Mini stacked bar ─────────────────────────────────────────────────────────
function MiniBar({ counts, total, statusOrder, resultMeta }: {
    counts: Record<string, number>; total: number; statusOrder: string[];
    resultMeta: Record<string, { label: string; color: string; bg: string; border: string }>;
}) {
    return (
        <div className="flex h-2 rounded-full overflow-hidden w-full bg-[#EEF0F8]">
            {statusOrder.map((k) => {
                const pct = total ? ((counts[k] || 0) / total) * 100 : 0;
                return pct > 0 ? (
                    <div key={k} style={{ width: `${pct}%`, background: resultMeta[k]?.color ?? "#64748b" }} className="transition-all duration-700" />
                ) : null;
            })}
        </div>
    );
}

// ─── Call Card ────────────────────────────────────────────────────────────────
function CallCard({ call, resultMeta, index }: {
    call: NormalizedCall;
    resultMeta: Record<string, { label: string; color: string; bg: string; border: string }>;
    index: number;
}) {
    const [noteOpen, setNoteOpen] = useState(false);
    const name = [call.contact?.firstName, call.contact?.lastName].filter(Boolean).join(" ") || "—";
    const co = call.contact?.company?.name ?? "—";
    const dur = fmtDuration(call.duration ?? null);
    const meta = resultMeta[call.result] ?? { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", label: "" };
    const initials = getInitials(call.contact?.firstName, call.contact?.lastName);
    const grad = avatarGradient(name);
    const delay = `${index * 40}ms`;

    return (
        <div
            className="group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
            style={{
                borderLeft: `3px solid ${meta.color}`,
                border: `1px solid #E8EBF0`,
                borderLeftWidth: 3,
                borderLeftColor: meta.color,
                animation: `dashFadeUp 0.3s ease both ${delay}`,
            }}
        >
            <div className="flex items-start gap-3 p-3.5">
                {/* Gradient avatar */}
                <div
                    className={cn(
                        "flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-[12px] font-black text-white select-none shadow-sm",
                        grad
                    )}
                >
                    {initials || "?"}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-[#12122A]">{name}</p>
                            <div className="flex items-center gap-1 text-xs text-[#8B8DAF] mt-0.5">
                                <Briefcase className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{call.contact?.title ?? "—"} · {co}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <ResultBadge result={call.result} resultMeta={resultMeta} />
                            <span className="text-[10px] text-[#B0B3C8] tabular-nums font-medium">
                                {fmtTime(call.createdAt)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {dur && (
                            <span className="flex items-center gap-1 text-[11px] text-[#8B8DAF]">
                                <Clock className="w-3 h-3" />{dur}
                            </span>
                        )}
                        {call.note && (
                            <button
                                type="button"
                                onClick={() => setNoteOpen((o) => !o)}
                                className="flex items-center gap-1 text-[11px] text-[#7C5CFC] hover:text-violet-700 font-semibold transition-colors"
                            >
                                <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", noteOpen && "rotate-180")} />
                                Note de l&apos;agent
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Contact links strip */}
            {(call.contact?.email || call.contact?.phone) && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 px-3.5 py-2 bg-[#F8F7FF] border-t border-[#EEF0F8]">
                    {call.contact?.email && (
                        <a href={`mailto:${call.contact.email}`} className="flex items-center gap-1.5 text-[11px] text-[#8B8DAF] hover:text-[#7C5CFC] transition-colors">
                            <Mail className="w-3 h-3" />{call.contact.email}
                        </a>
                    )}
                    {call.contact?.phone && (
                        <a href={`tel:${call.contact.phone}`} className="flex items-center gap-1.5 text-[11px] text-[#8B8DAF] hover:text-[#7C5CFC] transition-colors">
                            <Phone className="w-3 h-3" />{call.contact.phone}
                        </a>
                    )}
                </div>
            )}

            {/* Collapsible note */}
            {call.note && noteOpen && (
                <div className="px-3.5 py-3 border-t border-[#EEF0F8]">
                    <div className="rounded-xl border border-[#E8EBF0] bg-gradient-to-br from-violet-50/80 to-indigo-50/60 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#7C5CFC] mb-1">Note agent</p>
                        <p className="text-xs text-[#4B4D7A] italic leading-relaxed">&quot;{call.note}&quot;</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Day Block ────────────────────────────────────────────────────────────────
function DayBlock({ dateKey: dk, calls, statusOrder, resultMeta, defaultOpen = false }: {
    dateKey: string; calls: NormalizedCall[]; statusOrder: string[];
    resultMeta: Record<string, { label: string; color: string; bg: string; border: string }>;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const [resultFilter, setResultFilter] = useState<string | null>(null);

    useEffect(() => {
        if (!open) setResultFilter(null);
    }, [open]);

    const counts: Record<string, number> = {};
    statusOrder.forEach((c) => { counts[c] = 0; });
    calls.forEach((c) => { counts[c.result] = (counts[c.result] ?? 0) + 1; });
    const meetings = counts["MEETING_BOOKED"] ?? 0;

    const chipCodes = useMemo(() => {
        const cts: Record<string, number> = {};
        statusOrder.forEach((c) => { cts[c] = 0; });
        calls.forEach((c) => { cts[c.result] = (cts[c.result] ?? 0) + 1; });
        const ordered = statusOrder.filter((k) => (cts[k] ?? 0) > 0);
        const rest = Object.keys(cts)
            .filter((k) => !statusOrder.includes(k) && (cts[k] ?? 0) > 0)
            .sort();
        return [...ordered, ...rest];
    }, [calls, statusOrder]);

    const sortedCalls = useMemo(
        () => [...calls].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        [calls]
    );

    const displayedCalls = useMemo(() => {
        if (!resultFilter) return sortedCalls;
        return sortedCalls.filter((c) => c.result === resultFilter);
    }, [sortedCalls, resultFilter]);

    const d = new Date(dk + "T12:00:00");
    const weekday = d.toLocaleDateString("fr-FR", { weekday: "short" });
    const dayNum = d.getDate();
    const month = d.toLocaleDateString("fr-FR", { month: "short" });

    return (
        <div className="rounded-xl border border-[#E8EBF0] overflow-hidden bg-white">
            <div className="flex items-center gap-2 px-4 py-3 hover:bg-[#F8F7FF] transition-colors">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="flex flex-1 min-w-0 items-center gap-4 text-left"
                >
                    {/* Date chip – matching BreakdownCharts gradient style */}
                    <div className="flex-shrink-0 w-[52px] rounded-xl overflow-hidden text-center shadow-sm"
                        style={{ background: "linear-gradient(135deg, #7C5CFC 0%, #4338CA 100%)" }}>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-white/60 pt-1.5 leading-none">{weekday}</p>
                        <p className="text-[22px] font-black text-white leading-tight">{dayNum}</p>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-white/60 pb-1.5 leading-none">{month}</p>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-[#12122A]">
                                {calls.length} appel{calls.length > 1 ? "s" : ""}
                            </span>
                            {meetings > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-700">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    {meetings} RDV
                                </span>
                            )}
                            {/* Summary chips (non-interactive) */}
                            <div className="flex flex-wrap gap-1 ml-1">
                                {statusOrder.map((k) => {
                                    const v = counts[k] ?? 0;
                                    if (!v || k === "MEETING_BOOKED") return null;
                                    return (
                                        <span key={k}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                                            style={{ background: `${resultMeta[k]?.color ?? "#64748b"}15`, color: resultMeta[k]?.color ?? "#64748b" }}
                                        >
                                            {v} {resultMeta[k]?.label ?? ACTION_RESULT_LABELS[k] ?? k}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                        <MiniBar counts={counts} total={calls.length} statusOrder={statusOrder} resultMeta={resultMeta} />
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="flex-shrink-0 p-1 rounded-lg text-[#B0B3C8] hover:bg-white/80 hover:text-[#7C5CFC] transition-colors"
                    aria-expanded={open}
                    aria-label={open ? "Replier le jour" : "Déplier le jour"}
                >
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", open && "rotate-180")} />
                </button>
            </div>

            {open && (
                <>
                    {chipCodes.length > 0 && (
                        <div className="border-t border-[#EEF0F8] bg-white px-4 py-2.5">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#A0A3BD] mb-2">
                                Filtrer par résultat
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setResultFilter(null)}
                                    className={cn(
                                        "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all",
                                        resultFilter === null
                                            ? "bg-[#7C5CFC] text-white border-[#7C5CFC] shadow-sm shadow-violet-500/20"
                                            : "bg-[#F4F5FA] text-[#8B8DAF] border-[#E8EBF0] hover:border-[#7C5CFC]/35"
                                    )}
                                >
                                    Tous ({calls.length})
                                </button>
                                {chipCodes.map((k) => {
                                    const v = counts[k] ?? 0;
                                    const col = resultMeta[k]?.color ?? "#64748b";
                                    const active = resultFilter === k;
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => setResultFilter(active ? null : k)}
                                            className={cn(
                                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all",
                                                active
                                                    ? "text-white shadow-sm"
                                                    : "hover:brightness-95"
                                            )}
                                            style={
                                                active
                                                    ? { background: col, borderColor: col }
                                                    : {
                                                        background: `${col}12`,
                                                        borderColor: `${col}40`,
                                                        color: col,
                                                    }
                                            }
                                        >
                                            {v} {resultMeta[k]?.label ?? ACTION_RESULT_LABELS[k] ?? k}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="border-t border-[#EEF0F8] bg-[#F8F7FF]/60 px-4 py-3 space-y-2">
                        {displayedCalls.length === 0 ? (
                            <p className="text-center text-xs font-medium text-[#8B8DAF] py-6">
                                Aucun appel pour ce résultat sur ce jour.
                            </p>
                        ) : (
                            displayedCalls.map((c, i) => (
                                <CallCard key={c.id} call={c} resultMeta={resultMeta} index={i} />
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Mission Section ──────────────────────────────────────────────────────────
function MissionSection({ missionName, calls, defaultOpen, statusOrder, resultMeta, index }: {
    missionName: string; calls: NormalizedCall[]; defaultOpen: boolean;
    statusOrder: string[];
    resultMeta: Record<string, { label: string; color: string; bg: string; border: string }>;
    index: number;
}) {
    const [open, setOpen] = useState(defaultOpen);

    const byDay = useMemo(() => {
        const map: Record<string, NormalizedCall[]> = {};
        calls.forEach((c) => {
            const k = dayKey(c.createdAt);
            if (!map[k]) map[k] = [];
            map[k].push(c);
        });
        return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
    }, [calls]);

    const meetings = calls.filter((c) => c.result === "MEETING_BOOKED").length;
    const convRate = calls.length ? Math.round((meetings / calls.length) * 100) : 0;
    const campaigns = [...new Set(calls.map((c) => c.campaign.name))];

    const kpis = [
        { value: calls.length, label: "appels", from: "from-indigo-50", to: "to-violet-50", border: "border-indigo-100/60", text: "text-indigo-700" },
        { value: byDay.length,  label: "jours",  from: "from-sky-50",    to: "to-cyan-50",   border: "border-sky-100/60",    text: "text-sky-700"   },
        { value: meetings,      label: "RDV",    from: "from-emerald-50",to: "to-teal-50",   border: "border-emerald-100/60",text: "text-emerald-700"},
        { value: `${convRate}%`,label: "taux",   from: "from-violet-50", to: "to-purple-50", border: "border-violet-100/60", text: "text-violet-700" },
    ];

    return (
        <div
            className="premium-card overflow-hidden"
            style={{ animation: `dashFadeUp 0.4s ease both ${index * 80}ms` }}
        >
            {/* Mission header – mirrors BreakdownCharts header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-4 border-b border-[#E8EBF0]">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-violet-500/20 flex-shrink-0">
                        <Target className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#12122A] uppercase tracking-wider truncate">
                            {missionName}
                        </h3>
                        <p className="text-[11px] text-[#8B8DAF] mt-0.5 truncate">
                            {campaigns.join(" · ")}
                        </p>
                    </div>
                </div>

                {/* KPI chips – same gradient card style as BreakdownCharts */}
                <div className="flex items-center gap-2 flex-wrap">
                    {kpis.map(({ value, label, from, to, border, text }) => (
                        <div
                            key={label}
                            className={cn(
                                "rounded-lg bg-gradient-to-br border px-3 py-1.5 text-center",
                                from, to, border
                            )}
                        >
                            <p className={cn("text-sm font-black leading-none", text)}>{value}</p>
                            <p className="text-[9px] uppercase tracking-wider text-[#A0A3BD] mt-0.5">{label}</p>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        className={cn(
                            "w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-200",
                            open
                                ? "bg-[#7C5CFC] border-[#7C5CFC] text-white shadow-sm shadow-violet-500/25"
                                : "bg-[#F4F5FA] border-[#E8EBF0] text-[#8B8DAF] hover:border-[#7C5CFC]/40"
                        )}
                    >
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", open && "rotate-180")} />
                    </button>
                </div>
            </div>

            {/* Day sections */}
            {open && (
                <div className="px-5 py-4 space-y-2.5 bg-[#FAFBFE]">
                    {byDay.map(([dk, dayCalls], i) => (
                        <DayBlock
                            key={dk}
                            dateKey={dk}
                            calls={dayCalls}
                            statusOrder={statusOrder}
                            resultMeta={resultMeta}
                            defaultOpen={i === 0}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonMission() {
    return (
        <div className="premium-card overflow-hidden animate-pulse">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E8EBF0]">
                <div className="w-9 h-9 rounded-xl bg-[#E8EBF0]" />
                <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-40 rounded-full bg-[#E8EBF0]" />
                    <div className="h-2.5 w-24 rounded-full bg-[#EEF0F8]" />
                </div>
                <div className="flex gap-2">
                    {[1, 2, 3, 4].map((i) => <div key={i} className="w-14 h-10 rounded-lg bg-[#EEF0F8]" />)}
                </div>
            </div>
            <div className="px-5 py-4 space-y-2.5">
                {[1, 2].map((i) => (
                    <div key={i} className="rounded-xl border border-[#E8EBF0] p-3 space-y-2">
                        <div className="flex gap-3">
                            <div className="w-[52px] h-16 rounded-xl bg-[#E8EBF0]" />
                            <div className="flex-1 space-y-2 pt-1">
                                <div className="h-3 w-24 rounded-full bg-[#E8EBF0]" />
                                <div className="h-2 w-full rounded-full bg-[#EEF0F8]" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Normalize ────────────────────────────────────────────────────────────────
function normalizeCall(c: CallItem): NormalizedCall {
    const companyName = c.contact?.company?.name ?? c.company?.name ?? "—";
    return {
        ...c,
        contact: c.contact
            ? { ...c.contact, company: { name: companyName } }
            : { firstName: null, lastName: null, title: null, email: null, phone: null, company: { name: companyName } },
    } as NormalizedCall;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ClientPortalActivitePage() {
    const { error: showError } = useToast();
    const [calls, setCalls] = useState<CallItem[]>([]);
    const [statusConfig, setStatusConfig] = useState<{ statuses: StatusDef[]; categories: ResultCategoryDef[] } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState("30");

    const resultMeta = useMemo(() => {
        if (statusConfig?.statuses?.length && statusConfig?.categories?.length)
            return buildResultMeta(statusConfig.statuses, statusConfig.categories);
        return RESULT_META_FALLBACK;
    }, [statusConfig]);

    const statusOrder = useMemo(() => {
        if (statusConfig?.statuses?.length) return statusConfig.statuses.map((s) => s.code);
        return ["MEETING_BOOKED", "CALLBACK_REQUESTED", "INTERESTED", "NO_RESPONSE", "DISQUALIFIED"];
    }, [statusConfig]);

    useEffect(() => {
        fetch("/api/client/action-status-config")
            .then((r) => r.json())
            .then((json) => {
                if (json.success && json.data?.statuses)
                    setStatusConfig({ statuses: json.data.statuses, categories: json.data.categories ?? [] });
            })
            .catch(() => {});
    }, []);

    const fetchCalls = useMemo(() => async () => {
        setIsLoading(true);
        try {
            const d = new Date();
            d.setDate(d.getDate() - parseInt(dateRange, 10));
            const startDate = d.toISOString().split("T")[0];
            const end = new Date(); end.setHours(23, 59, 59, 999);
            const endDate = end.toISOString().split("T")[0];
            const res = await fetch(`/api/client/calls?startDate=${startDate}&endDate=${endDate}`);
            const json = await res.json();
            if (json.success && json.data?.items) setCalls(json.data.items);
            else showError("Erreur", json.error ?? "Impossible de charger l'activité");
        } catch {
            showError("Erreur", "Impossible de charger l'activité");
        } finally {
            setIsLoading(false);
        }
    }, [dateRange, showError]);

    useEffect(() => { fetchCalls(); }, [fetchCalls]);

    const dateThreshold = useMemo(() => {
        const d = new Date(); d.setDate(d.getDate() - parseInt(dateRange, 10)); return d;
    }, [dateRange]);

    const filtered = useMemo(() => {
        let arr = calls.filter((c) => new Date(c.createdAt) >= dateThreshold);
        if (search.trim()) {
            const q = search.toLowerCase();
            arr = arr.filter((c) =>
                [c.contact?.firstName, c.contact?.lastName, c.contact?.email, c.contact?.phone,
                 c.contact?.title, c.contact?.company?.name, c.company?.name,
                 c.campaign?.mission?.name, c.campaign?.name, c.note]
                    .filter(Boolean).join(" ").toLowerCase().includes(q)
            );
        }
        return arr;
    }, [calls, dateThreshold, search]);

    const normalizedFiltered = useMemo(() => filtered.map(normalizeCall), [filtered]);

    const byMission = useMemo(() => {
        const map: Record<string, NormalizedCall[]> = {};
        normalizedFiltered.forEach((c) => {
            const k = c.campaign?.mission?.name ?? "—";
            if (!map[k]) map[k] = [];
            map[k].push(c);
        });
        return Object.entries(map).sort(([, a], [, b]) => b.length - a.length);
    }, [normalizedFiltered]);

    const stats = useMemo(() => {
        const meetings = normalizedFiltered.filter((c) => c.result === "MEETING_BOOKED").length;
        const activeDays = new Set(normalizedFiltered.map((c) => dayKey(c.createdAt))).size;
        const missions = new Set(normalizedFiltered.map((c) => c.campaign?.mission?.name)).size;
        return {
            total: normalizedFiltered.length, meetings, activeDays, missions,
            convRate: normalizedFiltered.length ? Math.round((meetings / normalizedFiltered.length) * 100) : 0,
        };
    }, [normalizedFiltered]);

    const PERIODS = [
        { key: "7",  label: "7 jours" },
        { key: "30", label: "30 jours" },
        { key: "60", label: "60 jours" },
        { key: "90", label: "3 mois" },
    ];

    return (
        <div
            className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-5"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
            {/* ── Header ── mirrors BreakdownCharts header ── */}
            <div
                className="premium-card overflow-hidden"
                style={{ animation: "dashFadeUp 0.4s ease both" }}
            >
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-[#E8EBF0]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-violet-500/20">
                            <PhoneCall className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold text-[#12122A] uppercase tracking-wider">
                                Activité de prospection
                            </h1>
                            <p className="text-[11px] text-[#8B8DAF] mt-0.5">
                                Jours travaillés, contacts appelés et résultats par mission
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Period selector – same as BreakdownCharts */}
                        <div className="flex items-center rounded-xl bg-[#F4F5FA] border border-[#E8EBF0] p-0.5 gap-0.5">
                            {PERIODS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setDateRange(key)}
                                    className={cn(
                                        "text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 whitespace-nowrap",
                                        dateRange === key
                                            ? "bg-white text-[#7C5CFC] shadow-sm"
                                            : "text-[#8B8DAF] hover:text-[#4B4D7A]"
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => fetchCalls()}
                            disabled={isLoading}
                            className="w-8 h-8 rounded-lg border border-[#E8EBF0] bg-[#F4F5FA] flex items-center justify-center text-[#8B8DAF] hover:text-[#7C5CFC] hover:border-[#7C5CFC]/40 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                        </button>
                    </div>
                </div>

                {/* ── KPI row – same gradient card style as BreakdownCharts ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-5">
                    {[
                        {
                            icon: <Activity className="w-3.5 h-3.5" />,
                            value: stats.total,
                            label: "Appels passés",
                            sub: `sur ${dateRange} jours`,
                            bg: "from-indigo-50 to-violet-50",
                            border: "border-indigo-100/60",
                            text: "text-indigo-600",
                        },
                        {
                            icon: <CalendarDays className="w-3.5 h-3.5" />,
                            value: stats.activeDays,
                            label: "Jours travaillés",
                            sub: "jours d'activité",
                            bg: "from-sky-50 to-cyan-50",
                            border: "border-sky-100/60",
                            text: "text-sky-600",
                        },
                        {
                            icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                            value: stats.meetings,
                            label: "RDV obtenus",
                            sub: `taux ${stats.convRate}%`,
                            bg: "from-emerald-50 to-teal-50",
                            border: "border-emerald-100/60",
                            text: "text-emerald-600",
                        },
                        {
                            icon: <TrendingUp className="w-3.5 h-3.5" />,
                            value: stats.missions,
                            label: "Missions actives",
                            sub: "sur la période",
                            bg: "from-violet-50 to-purple-50",
                            border: "border-violet-100/60",
                            text: "text-violet-600",
                        },
                    ].map(({ icon, value, label, sub, bg, border, text }, i) => (
                        <div
                            key={label}
                            className={cn(
                                "rounded-xl bg-gradient-to-br border p-3.5 flex flex-col gap-1.5",
                                bg, border
                            )}
                            style={{ animation: `dashFadeUp 0.35s ease both ${100 + i * 60}ms` }}
                        >
                            <div className={cn("flex items-center gap-1.5 font-semibold", text)}>
                                {icon}
                                <span className="text-[10.5px] uppercase tracking-wide">{label}</span>
                            </div>
                            <div className="text-[26px] font-black text-[#12122A] leading-none">
                                {isLoading
                                    ? <span className="inline-block w-10 h-6 rounded bg-white/60 animate-pulse" />
                                    : value}
                            </div>
                            <p className="text-[10.5px] text-[#A0A3BD]">{sub}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Search & active filters ── */}
            <div
                className="flex flex-wrap items-center gap-3"
                style={{ animation: "dashFadeUp 0.4s ease both 300ms" }}
            >
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un contact, une entreprise, une mission…"
                        className="w-full h-10 pl-10 pr-9 rounded-xl border border-[#E8EBF0] bg-white text-sm text-[#12122A] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/30 focus:border-[#7C5CFC]/50 shadow-sm placeholder:text-[#A0A3BD]"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A3BD] hover:text-[#7C5CFC] transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                {!isLoading && (
                    <p className="text-[12px] font-semibold text-[#8B8DAF]">
                        {normalizedFiltered.length} appel{normalizedFiltered.length > 1 ? "s" : ""}
                        {search && <span className="text-[#7C5CFC]"> · filtrés</span>}
                    </p>
                )}
            </div>

            {/* ── Content ── */}
            {isLoading ? (
                <div className="space-y-4">
                    <SkeletonMission />
                    <SkeletonMission />
                </div>
            ) : byMission.length === 0 ? (
                <div
                    className="premium-card flex flex-col items-center justify-center py-20 px-6 text-center"
                    style={{ animation: "dashFadeUp 0.4s ease both 200ms" }}
                >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F4F5FA] to-[#E8EBF0] flex items-center justify-center mb-4">
                        <PhoneCall className="w-6 h-6 text-[#C0C3D8]" />
                    </div>
                    <p className="text-sm font-semibold text-[#8B8DAF]">Aucune activité trouvée</p>
                    <p className="text-xs text-[#A0A3BD] mt-1">Ajustez la période ou la recherche.</p>
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
                            index={idx}
                        />
                    ))}
                </div>
            )}

            {/* ── Dashboard keyframes (injected once) ── */}
            <style>{`
                @keyframes dashFadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
