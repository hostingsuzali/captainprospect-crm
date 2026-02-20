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
    { bg: "bg-violet-100", border: "border-violet-300", text: "text-violet-700", dot: "bg-violet-500" },
    { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500" },
    { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-700", dot: "bg-amber-500" },
    { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-700", dot: "bg-rose-500" },
    { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-700", dot: "bg-cyan-500" },
    { bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-700", dot: "bg-indigo-500" },
];

export function getMissionColor(id: string) {
    const hash = id.split("").reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0);
    return MISSION_COLORS[Math.abs(hash) % MISSION_COLORS.length];
}
