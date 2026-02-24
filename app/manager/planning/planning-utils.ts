export function normalizeDate(d: string | Date): string {
    if (typeof d === "string") return d.split("T")[0];
    const date = new Date(d);
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function calcHours(start: string, end: string): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10;
}

export const WEEKLY_CAPACITY = 40;

export const MISSION_COLORS = [
    { bg: "bg-violet-100", border: "border-violet-300", text: "text-violet-700", dot: "bg-violet-500", hex: "#8b5cf6" },
    { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500", hex: "#10b981" },
    { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-700", dot: "bg-amber-500", hex: "#f59e0b" },
    { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-700", dot: "bg-rose-500", hex: "#f43f5e" },
    { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-700", dot: "bg-cyan-500", hex: "#06b6d4" },
    { bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-700", dot: "bg-indigo-500", hex: "#6366f1" },
];

export function getMissionColor(id: string) {
    const hash = id.split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0);
    return MISSION_COLORS[Math.abs(hash) % MISSION_COLORS.length];
}

// ── Month helpers ──────────────────────────────────────────────────────

export function formatMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export function formatMonthShort(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
}

export function prevMonth(month: string): string {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return formatMonth(d);
}

export function nextMonth(month: string): string {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m, 1);
    return formatMonth(d);
}

export function getSdrStatus(
    allocatedDays: number,
    effectiveAvailableDays: number
): 'overloaded' | 'near' | 'optimal' | 'underutilized' | 'none' {
    if (effectiveAvailableDays === 0) return 'none';
    const pct = allocatedDays / effectiveAvailableDays;
    if (pct > 1) return 'overloaded';
    if (pct >= 0.85) return 'near';
    if (pct >= 0.5) return 'optimal';
    return 'underutilized';
}

export const SDR_STATUS_CONFIG = {
    overloaded: { label: 'Surchargé', className: 'text-red-700 bg-red-100', dot: 'bg-red-500' },
    near: { label: 'Proche capacité', className: 'text-amber-700 bg-amber-100', dot: 'bg-amber-500' },
    optimal: { label: 'Optimal', className: 'text-emerald-700 bg-emerald-100', dot: 'bg-emerald-500' },
    underutilized: { label: 'Sous-utilisé', className: 'text-blue-700 bg-blue-100', dot: 'bg-blue-500' },
    none: { label: '—', className: 'text-slate-400 bg-slate-100', dot: 'bg-slate-300' },
} as const;
