import type { ReactNode } from "react";
import { Video, MapPin, Phone, Calendar, ThumbsUp, ThumbsDown, Minus, UserX } from "lucide-react";
import type { Meeting, ConfirmationFilter, MeetingFilters } from "../_types";

export function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  const colors = [
    "#6C63FF", "#059669", "#D97706", "#DC2626", "#2563EB",
    "#DB2777", "#7C3AED", "#0D9488", "#EA580C", "#0891B2",
  ];
  return colors[Math.abs(h) % colors.length];
}

export function contactName(c: Meeting["contact"]): string {
  if (!c) return "—";
  return `${c.firstName || ""} ${c.lastName || ""}`.trim() || "—";
}

export function meetingStatus(m: Meeting): "upcoming" | "past" | "cancelled" {
  if (m.result === "MEETING_CANCELLED") return "cancelled";
  if (!m.callbackDate) return "past";
  return new Date(m.callbackDate) >= new Date() ? "upcoming" : "past";
}

export function statusLabel(s: string): string {
  const map: Record<string, string> = { upcoming: "À venir", past: "Passé", cancelled: "Annulé" };
  return map[s] || s;
}

export function statusColor(s: string): string {
  const map: Record<string, string> = { upcoming: "var(--green)", past: "var(--blue)", cancelled: "var(--red)" };
  return map[s] || "var(--ink3)";
}

export function statusBg(s: string): string {
  const map: Record<string, string> = { upcoming: "var(--greenLight)", past: "var(--blueLight)", cancelled: "var(--redLight)" };
  return map[s] || "var(--surface2)";
}

export function confirmationLabel(s: ConfirmationFilter): string {
  const map: Record<string, string> = {
    all: "Tous",
    PENDING: "À confirmer",
    CONFIRMED: "Confirmé",
    CANCELLED: "Annulé",
  };
  return map[s] || s;
}

export function confirmationColor(s: ConfirmationFilter): string {
  if (s === "CONFIRMED") return "var(--green)";
  if (s === "CANCELLED") return "var(--red)";
  if (s === "PENDING") return "var(--amber)";
  return "var(--ink3)";
}

export function confirmationBg(s: ConfirmationFilter): string {
  if (s === "CONFIRMED") return "var(--greenLight)";
  if (s === "CANCELLED") return "var(--redLight)";
  if (s === "PENDING") return "var(--amberLight)";
  return "var(--surface2)";
}

export function meetingTypeIcon(t: string | null): ReactNode {
  switch (t) {
    case "VISIO": return <Video size={14} />;
    case "PHYSIQUE": return <MapPin size={14} />;
    case "TELEPHONIQUE": return <Phone size={14} />;
    default: return <Calendar size={14} />;
  }
}

export function meetingTypeLabel(t: string | null): string {
  switch (t) {
    case "VISIO": return "Visio";
    case "PHYSIQUE": return "Physique";
    case "TELEPHONIQUE": return "Téléphonique";
    default: return "—";
  }
}

export function categoryLabel(c: string | null): string {
  if (c === "BESOIN") return "Besoin";
  if (c === "EXPLORATOIRE") return "Exploratoire";
  return "";
}

export function categoryColor(c: string | null): string {
  if (c === "BESOIN") return "var(--green)";
  if (c === "EXPLORATOIRE") return "var(--blue)";
  return "var(--ink3)";
}

export function categoryBg(c: string | null): string {
  if (c === "BESOIN") return "var(--greenLight)";
  if (c === "EXPLORATOIRE") return "var(--blueLight)";
  return "var(--surface2)";
}

export function outcomeIcon(o: string | null): ReactNode {
  switch (o) {
    case "POSITIVE": return <ThumbsUp size={14} style={{ color: "var(--green)" }} />;
    case "NEUTRAL": return <Minus size={14} style={{ color: "var(--amber)" }} />;
    case "NEGATIVE": return <ThumbsDown size={14} style={{ color: "var(--red)" }} />;
    case "NO_SHOW": return <UserX size={14} style={{ color: "var(--ink3)" }} />;
    default: return <Minus size={14} style={{ color: "var(--ink3)", opacity: 0.3 }} />;
  }
}

export function outcomeLabel(o: string | null): string {
  switch (o) {
    case "POSITIVE": return "Positif";
    case "NEUTRAL": return "Neutre";
    case "NEGATIVE": return "Négatif";
    case "NO_SHOW": return "Absent";
    default: return "Sans retour";
  }
}

export function formatDateShort(d: string | null): { day: string; month: string; time: string } {
  if (!d) return { day: "—", month: "", time: "" };
  const date = new Date(d);
  return {
    day: date.getDate().toString(),
    month: date.toLocaleDateString("fr-FR", { month: "short" }),
    time: date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function dateProximityColor(d: string | null): string {
  if (!d) return "var(--ink3)";
  const diff = new Date(d).getTime() - Date.now();
  if (diff < 0) return "var(--red)";
  if (diff < 48 * 60 * 60 * 1000) return "var(--amber)";
  return "var(--green)";
}

export function transcriptToText(voipTranscript: unknown): string {
  const segments = Array.isArray(voipTranscript)
    ? voipTranscript
    : Array.isArray((voipTranscript as { segments?: unknown[] })?.segments)
      ? (voipTranscript as { segments: unknown[] }).segments
      : null;
  if (!segments) return "";
  return segments
    .map((s: unknown) => {
      const seg = s as { speaker?: string; text?: string };
      const speaker = seg?.speaker === "agent" ? "Agent" : seg?.speaker === "prospect" ? "Prospect" : "Speaker";
      const text = typeof seg?.text === "string" ? seg.text.trim() : "";
      return text ? `${speaker}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function buildDateRange(
  datePreset: MeetingFilters["datePreset"],
  dateFrom: string,
  dateTo: string
): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  switch (datePreset) {
    case "today": return { from: fmt(now), to: fmt(now) };
    case "7days": { const d = new Date(); d.setDate(d.getDate() - 7); return { from: fmt(d), to: fmt(now) }; }
    case "30days": {
      // Current calendar month by creation date
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: fmt(startOfMonth), to: fmt(endOfMonth) };
    }
    case "3months": { const d = new Date(); d.setMonth(d.getMonth() - 3); return { from: fmt(d), to: fmt(now) }; }
    case "custom": return { from: dateFrom, to: dateTo };
  }
}
