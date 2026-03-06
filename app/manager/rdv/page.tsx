"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  Search,
  List,
  LayoutGrid,
  CalendarDays,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  MoreHorizontal,
  Video,
  MapPin,
  Phone,
  Mail,
  Linkedin,
  ExternalLink,
  Copy,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  UserX,
  ThumbsUp,
  ThumbsDown,
  Clock,
  FileText,
  History,
  MessageSquare,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  GripVertical,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════
   DESIGN TOKENS — LIGHT THEME
   ═══════════════════════════════════════════ */

const DESIGN_TOKENS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=Instrument+Serif:ital@0;1&display=swap');
:root {
  --bg: #F8F9FB;
  --surface: #FFFFFF;
  --surface2: #F1F3F7;
  --border: rgba(0,0,0,0.06);
  --border2: rgba(0,0,0,0.10);
  --ink: #111827;
  --ink2: #4B5563;
  --ink3: #9CA3AF;
  --accent: #6C63FF;
  --accentLight: rgba(108,99,255,0.08);
  --green: #059669;
  --greenLight: rgba(5,150,105,0.08);
  --amber: #D97706;
  --amberLight: rgba(217,119,6,0.08);
  --red: #DC2626;
  --redLight: rgba(220,38,38,0.06);
  --blue: #2563EB;
  --blueLight: rgba(37,99,235,0.07);
}
`;

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

interface Meeting {
  id: string;
  result: string;
  callbackDate: string | null;
  meetingType: string | null;
  meetingAddress: string | null;
  meetingJoinUrl: string | null;
  meetingPhone: string | null;
  note: string | null;
  cancellationReason: string | null;
  createdAt: string;
  duration: number | null;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    email: string | null;
    phone: string | null;
    linkedin: string | null;
    customData: any;
  } | null;
  company: {
    id: string;
    name: string;
    industry: string | null;
    country: string | null;
    size: string | null;
    website: string | null;
  } | null;
  campaign: { id: string; name: string };
  mission: { id: string; name: string };
  client: { id: string; name: string; industry: string | null } | null;
  sdr: { id: string; name: string; email: string };
  feedback: {
    outcome: string;
    recontact: string;
    note: string | null;
  } | null;
}

interface Aggregates {
  totalCount: number;
  upcomingCount: number;
  pastCount: number;
  cancelledCount: number;
  avgPerSdr: number;
  conversionRate: number;
  meetingsThisWeek: number;
  meetingsThisMonth: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

interface FilterOption {
  id: string;
  name: string;
  count?: number;
}

type ViewMode = "list" | "board" | "calendar";
type StatusFilter = "all" | "upcoming" | "past" | "cancelled";
type DatePreset = "today" | "7days" | "30days" | "3months" | "custom";
type MeetingTypeFilter = "VISIO" | "PHYSIQUE" | "TELEPHONIQUE";
type OutcomeFilter = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "NO_SHOW" | "NONE";

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  const colors = [
    "#6C63FF", "#059669", "#D97706", "#DC2626", "#2563EB",
    "#DB2777", "#7C3AED", "#0D9488", "#EA580C", "#0891B2",
  ];
  return colors[Math.abs(h) % colors.length];
}

function contactName(c: Meeting["contact"]): string {
  if (!c) return "—";
  return `${c.firstName || ""} ${c.lastName || ""}`.trim() || "—";
}

function meetingStatus(m: Meeting): "upcoming" | "past" | "cancelled" {
  if (m.result === "MEETING_CANCELLED") return "cancelled";
  if (!m.callbackDate) return "past";
  return new Date(m.callbackDate) >= new Date() ? "upcoming" : "past";
}

function statusLabel(s: string): string {
  const map: Record<string, string> = { upcoming: "À venir", past: "Passé", cancelled: "Annulé" };
  return map[s] || s;
}

function statusColor(s: string): string {
  const map: Record<string, string> = { upcoming: "var(--green)", past: "var(--blue)", cancelled: "var(--red)" };
  return map[s] || "var(--ink3)";
}

function statusBg(s: string): string {
  const map: Record<string, string> = { upcoming: "var(--greenLight)", past: "var(--blueLight)", cancelled: "var(--redLight)" };
  return map[s] || "var(--surface2)";
}

function meetingTypeIcon(t: string | null): ReactNode {
  switch (t) {
    case "VISIO": return <Video size={14} />;
    case "PHYSIQUE": return <MapPin size={14} />;
    case "TELEPHONIQUE": return <Phone size={14} />;
    default: return <Calendar size={14} />;
  }
}

function meetingTypeLabel(t: string | null): string {
  switch (t) {
    case "VISIO": return "Visio";
    case "PHYSIQUE": return "Physique";
    case "TELEPHONIQUE": return "Téléphonique";
    default: return "—";
  }
}

function outcomeIcon(o: string | null): ReactNode {
  switch (o) {
    case "POSITIVE": return <ThumbsUp size={14} style={{ color: "var(--green)" }} />;
    case "NEUTRAL": return <Minus size={14} style={{ color: "var(--amber)" }} />;
    case "NEGATIVE": return <ThumbsDown size={14} style={{ color: "var(--red)" }} />;
    case "NO_SHOW": return <UserX size={14} style={{ color: "var(--ink3)" }} />;
    default: return <Minus size={14} style={{ color: "var(--ink3)", opacity: 0.3 }} />;
  }
}

function outcomeLabel(o: string | null): string {
  switch (o) {
    case "POSITIVE": return "Positif";
    case "NEUTRAL": return "Neutre";
    case "NEGATIVE": return "Négatif";
    case "NO_SHOW": return "Absent";
    default: return "Sans retour";
  }
}

function formatDateShort(d: string | null): { day: string; month: string; time: string } {
  if (!d) return { day: "—", month: "", time: "" };
  const date = new Date(d);
  return {
    day: date.getDate().toString(),
    month: date.toLocaleDateString("fr-FR", { month: "short" }),
    time: date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function dateProximityColor(d: string | null): string {
  if (!d) return "var(--ink3)";
  const diff = new Date(d).getTime() - Date.now();
  if (diff < 0) return "var(--red)";
  if (diff < 48 * 60 * 60 * 1000) return "var(--amber)";
  return "var(--green)";
}

function downloadCSV(meetings: Meeting[], filters: string) {
  const BOM = "\uFEFF";
  const headers = [
    "Date", "Heure", "Statut", "Client", "Mission", "Campagne",
    "Contact", "Poste", "Email", "Téléphone", "LinkedIn", "Entreprise",
    "Secteur", "Pays", "Taille", "SDR", "Type RDV", "Feedback",
    "Recontact", "Note SDR", "Note Manager",
  ];
  const rows = meetings.map((m) => {
    const d = m.callbackDate ? new Date(m.callbackDate) : null;
    return [
      d ? d.toLocaleDateString("fr-FR") : "",
      d ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
      statusLabel(meetingStatus(m)),
      m.client?.name || "",
      m.mission.name,
      m.campaign.name,
      contactName(m.contact),
      m.contact?.title || "",
      m.contact?.email || "",
      m.contact?.phone || "",
      m.contact?.linkedin || "",
      m.company?.name || "",
      m.company?.industry || "",
      m.company?.country || "",
      m.company?.size || "",
      m.sdr.name,
      meetingTypeLabel(m.meetingType),
      m.feedback ? outcomeLabel(m.feedback.outcome) : "",
      m.feedback?.recontact || "",
      m.note || "",
      "",
    ];
  });
  const csv = BOM + [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `rdv_export_${dateStr}${filters ? "_" + filters : ""}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════
   ANIMATED COUNTER
   ═══════════════════════════════════════════ */

function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value, duration]);
  return <>{display}</>;
}

/* ═══════════════════════════════════════════
   SKELETON (light-themed shimmer)
   ═══════════════════════════════════════════ */

function Skeleton({ w, h, r = 8 }: { w: string | number; h: string | number; r?: number }) {
  return (
    <div
      style={{
        width: typeof w === "number" ? `${w}px` : w,
        height: typeof h === "number" ? `${h}px` : h,
        borderRadius: r,
        background: "linear-gradient(90deg, #EBEDF2 25%, #F6F7FA 50%, #EBEDF2 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }}
    />
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════ */

export default function ManagerRdvPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [view, setView] = useState<ViewMode>("list");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"detail" | "feedback" | "note" | "history">("detail");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("30days");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [selectedMissions, setSelectedMissions] = useState<Set<string>>(new Set());
  const [selectedSdrs, setSelectedSdrs] = useState<Set<string>>(new Set());
  const [selectedMeetingTypes, setSelectedMeetingTypes] = useState<Set<MeetingTypeFilter>>(new Set());
  const [selectedOutcomes, setSelectedOutcomes] = useState<Set<OutcomeFilter>>(new Set());

  const [clientOptions, setClientOptions] = useState<FilterOption[]>([]);
  const [missionOptions, setMissionOptions] = useState<FilterOption[]>([]);
  const [sdrOptions, setSdrOptions] = useState<FilterOption[]>([]);

  const [managerNote, setManagerNote] = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [feedbackOutcome, setFeedbackOutcome] = useState<string | null>(null);
  const [feedbackRecontact, setFeedbackRecontact] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");

  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const noteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const dateRange = useMemo(() => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    switch (datePreset) {
      case "today": return { from: fmt(now), to: fmt(now) };
      case "7days": { const d = new Date(); d.setDate(d.getDate() - 7); return { from: fmt(d), to: fmt(now) }; }
      case "30days": { const d = new Date(); d.setDate(d.getDate() - 30); return { from: fmt(d), to: fmt(now) }; }
      case "3months": { const d = new Date(); d.setMonth(d.getMonth() - 3); return { from: fmt(d), to: fmt(now) }; }
      case "custom": return { from: dateFrom, to: dateTo };
    }
  }, [datePreset, dateFrom, dateTo]);

  const buildQuery = useCallback(
    (page = 1) => {
      const p = new URLSearchParams();
      if (debouncedSearch) p.set("search", debouncedSearch);
      if (dateRange.from) p.set("dateFrom", dateRange.from);
      if (dateRange.to) p.set("dateTo", dateRange.to);
      selectedClients.forEach((id) => p.append("clientIds[]", id));
      selectedMissions.forEach((id) => p.append("missionIds[]", id));
      selectedSdrs.forEach((id) => p.append("sdrIds[]", id));
      if (statusFilter !== "all") p.append("status[]", statusFilter);
      selectedMeetingTypes.forEach((t) => p.append("meetingType[]", t));
      selectedOutcomes.forEach((o) => {
        if (o !== "NONE") p.append("outcome[]", o);
      });
      p.set("page", String(page));
      p.set("limit", "50");
      return p.toString();
    },
    [debouncedSearch, dateRange, selectedClients, selectedMissions, selectedSdrs, statusFilter, selectedMeetingTypes, selectedOutcomes]
  );

  const fetchMeetings = useCallback(
    async (page = 1, append = false) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await fetch(`/api/manager/rdv?${buildQuery(page)}`);
        const json = await res.json();
        if (json.success) {
          if (append) {
            setMeetings((prev) => [...prev, ...json.data.meetings]);
          } else {
            setMeetings(json.data.meetings);
          }
          setAggregates(json.data.aggregates);
          setPagination(json.data.pagination);
          if (!append) {
            const clients = new Map<string, FilterOption>();
            const missions = new Map<string, FilterOption>();
            const sdrs = new Map<string, FilterOption>();
            for (const m of json.data.meetings) {
              if (m.client) clients.set(m.client.id, { id: m.client.id, name: m.client.name });
              missions.set(m.mission.id, { id: m.mission.id, name: m.mission.name });
              sdrs.set(m.sdr.id, { id: m.sdr.id, name: m.sdr.name });
            }
            setClientOptions(Array.from(clients.values()));
            setMissionOptions(Array.from(missions.values()));
            setSdrOptions(Array.from(sdrs.values()));
          }
        }
      } catch (e) {
        console.error("Failed to fetch meetings:", e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      if (loadingMore || !pagination?.hasMore) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
        fetchMeetings(pagination.page + 1, true);
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadingMore, pagination, fetchMeetings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && panelOpen) {
        setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  const openPanel = useCallback((m: Meeting) => {
    setSelectedMeeting(m);
    setPanelTab("detail");
    setPanelOpen(true);
    setManagerNote("");
    setNoteStatus("idle");
    if (m.feedback) {
      setFeedbackOutcome(m.feedback.outcome);
      setFeedbackRecontact(m.feedback.recontact);
      setFeedbackNote(m.feedback.note || "");
    } else {
      setFeedbackOutcome(null);
      setFeedbackRecontact(null);
      setFeedbackNote("");
    }
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === meetings.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(meetings.map((m) => m.id)));
  }, [meetings, selectedIds.size]);

  const updateMeeting = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/manager/rdv/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok) fetchMeetings();
      } catch (e) {
        console.error("Update failed:", e);
      }
    },
    [fetchMeetings]
  );

  const saveNote = useCallback(
    (id: string, note: string) => {
      if (noteTimeoutRef.current) clearTimeout(noteTimeoutRef.current);
      setNoteStatus("saving");
      noteTimeoutRef.current = setTimeout(async () => {
        await updateMeeting(id, { note });
        setNoteStatus("saved");
        setTimeout(() => setNoteStatus("idle"), 2000);
      }, 1200);
    },
    [updateMeeting]
  );

  const deleteMeetings = useCallback(
    async (ids: string[]) => {
      await Promise.all(ids.map((id) => fetch(`/api/manager/rdv/${id}`, { method: "DELETE" })));
      setSelectedIds(new Set());
      fetchMeetings();
    },
    [fetchMeetings]
  );

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (debouncedSearch) c++;
    if (statusFilter !== "all") c++;
    if (selectedClients.size > 0) c++;
    if (selectedMissions.size > 0) c++;
    if (selectedSdrs.size > 0) c++;
    if (selectedMeetingTypes.size > 0) c++;
    if (selectedOutcomes.size > 0) c++;
    return c;
  }, [debouncedSearch, statusFilter, selectedClients, selectedMissions, selectedSdrs, selectedMeetingTypes, selectedOutcomes]);

  const clearAllFilters = useCallback(() => {
    setSearch(""); setDebouncedSearch(""); setStatusFilter("all"); setDatePreset("30days");
    setDateFrom(""); setDateTo(""); setSelectedClients(new Set()); setSelectedMissions(new Set());
    setSelectedSdrs(new Set()); setSelectedMeetingTypes(new Set()); setSelectedOutcomes(new Set());
  }, []);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter !== "all") parts.push(statusFilter);
    if (selectedClients.size > 0) parts.push(`${selectedClients.size}clients`);
    return parts.join("_");
  }, [statusFilter, selectedClients]);

  const boardColumns = useMemo(() => {
    const cols: Record<string, Meeting[]> = { upcoming: [], past: [], feedback: [], cancelled: [] };
    for (const m of meetings) {
      const s = meetingStatus(m);
      if (s === "cancelled") cols.cancelled.push(m);
      else if (m.feedback) cols.feedback.push(m);
      else if (s === "upcoming") cols.upcoming.push(m);
      else cols.past.push(m);
    }
    return cols;
  }, [meetings]);

  const calendarMeetings = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      if (!m.callbackDate) continue;
      const key = m.callbackDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [meetings]);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = (first.getDay() + 6) % 7;
    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, inMonth: false });
    }
    for (let d = 1; d <= last.getDate(); d++) {
      days.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (days.length % 7 !== 0) {
      const d = new Date(year, month + 1, days.length - last.getDate() - startDay + 1);
      days.push({ date: d, inMonth: false });
    }
    return days;
  }, [calendarDate]);

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */

  return (
    <>
      <style>{DESIGN_TOKENS}{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .rdv-page { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--ink); min-height: 100vh; display: flex; flex-direction: column; }
        .rdv-serif { font-family: 'Instrument Serif', serif; font-style: italic; }
        .rdv-row:hover .rdv-row-actions { opacity: 1; }
        .rdv-row:hover { background: var(--surface2) !important; }
        .rdv-checkbox { appearance: none; width: 18px; height: 18px; border: 1.5px solid var(--border2); border-radius: 5px; background: var(--surface); cursor: pointer; display: grid; place-content: center; transition: all 0.15s; }
        .rdv-checkbox:checked { background: var(--accent); border-color: var(--accent); }
        .rdv-checkbox:checked::after { content: '✓'; color: white; font-size: 12px; font-weight: 600; }
        .rdv-scrollbar::-webkit-scrollbar { width: 6px; }
        .rdv-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .rdv-scrollbar::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
        .rdv-input { background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; color: var(--ink); padding: 10px 14px; font-size: 13px; outline: none; transition: all 0.15s; font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        .rdv-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accentLight); }
        .rdv-input::placeholder { color: var(--ink3); }
        .rdv-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: none; font-family: 'DM Sans', sans-serif; }
        .rdv-btn-primary { background: var(--accent); color: white; }
        .rdv-btn-primary:hover { filter: brightness(1.08); box-shadow: 0 2px 8px rgba(108,99,255,0.25); }
        .rdv-btn-ghost { background: var(--surface); color: var(--ink2); border: 1px solid var(--border2); }
        .rdv-btn-ghost:hover { background: var(--surface2); color: var(--ink); border-color: var(--ink3); }
        .rdv-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap; }
        .rdv-metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 22px 24px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .rdv-metric-card:hover { border-color: var(--border2); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .rdv-metric-card.active { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accentLight), 0 4px 16px rgba(108,99,255,0.1); }
        .rdv-panel { position: fixed; top: 0; right: 0; width: 480px; height: 100vh; background: var(--surface); border-left: 1px solid var(--border); z-index: 50; transform: translateX(100%); transition: transform 0.35s cubic-bezier(0.16,1,0.3,1); overflow-y: auto; box-shadow: -8px 0 32px rgba(0,0,0,0.06); }
        .rdv-panel.open { transform: translateX(0); }
        .rdv-tab { padding: 10px 18px; font-size: 13px; font-weight: 500; color: var(--ink3); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; background: none; border-top: none; border-left: none; border-right: none; font-family: 'DM Sans', sans-serif; }
        .rdv-tab:hover { color: var(--ink2); }
        .rdv-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
        .rdv-board-col { flex: 1; min-width: 280px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; display: flex; flex-direction: column; max-height: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .rdv-board-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; }
        .rdv-board-card:hover { border-color: var(--border2); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
      `}</style>

      <div className="rdv-page">
        {/* ═══ ZONE 1: COMMAND BAR ═══ */}
        <div
          style={{
            height: 64,
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            padding: "0 32px",
            gap: 20,
            flexShrink: 0,
            zIndex: 30,
          }}
        >
          <h1 className="rdv-serif" style={{ fontSize: 26, color: "var(--ink)", margin: 0, whiteSpace: "nowrap" }}>
            Rendez-vous
          </h1>

          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <div style={{ position: "relative", width: "100%", maxWidth: 520 }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink3)" }} />
              <input
                ref={searchRef}
                className="rdv-input"
                style={{ width: "100%", paddingLeft: 40, paddingRight: 64, background: "var(--surface2)", borderColor: "transparent" }}
                placeholder="Rechercher un contact, entreprise, SDR…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "var(--surface)",
                  border: "1px solid var(--border2)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontSize: 11,
                  color: "var(--ink3)",
                  fontFamily: "inherit",
                }}
              >
                ⌘K
              </kbd>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 10, overflow: "hidden", padding: 2 }}>
              {([["list", List], ["board", LayoutGrid], ["calendar", CalendarDays]] as const).map(([v, Icon]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    background: view === v ? "var(--surface)" : "transparent",
                    color: view === v ? "var(--accent)" : "var(--ink3)",
                    border: "none",
                    padding: "7px 11px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    transition: "all 0.15s",
                    borderRadius: 8,
                    boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              {([["today", "Aujourd'hui"], ["7days", "7j"], ["30days", "30j"], ["3months", "3m"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  className="rdv-btn"
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    borderRadius: 8,
                    background: datePreset === key ? "var(--accentLight)" : "transparent",
                    color: datePreset === key ? "var(--accent)" : "var(--ink3)",
                    border: "none",
                    fontWeight: datePreset === key ? 600 : 400,
                  }}
                  onClick={() => setDatePreset(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <button className="rdv-btn rdv-btn-ghost" onClick={() => downloadCSV(meetings, filterSummary)}>
              <Download size={14} /> Exporter
            </button>
          </div>
        </div>

        {/* ═══ ZONE 2: INTELLIGENCE STRIP ═══ */}
        <div style={{ display: "flex", gap: 16, padding: "20px 32px", flexShrink: 0, overflowX: "auto" }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ flex: 1, minWidth: 200 }}>
                <Skeleton w="100%" h={100} r={16} />
              </div>
            ))
          ) : (
            [
              { label: "Total RDV", value: aggregates?.totalCount ?? 0, color: "var(--accent)", filterAction: () => { setStatusFilter("all"); }, active: statusFilter === "all" },
              { label: "À venir", value: aggregates?.upcomingCount ?? 0, color: "var(--green)", filterAction: () => { setStatusFilter(statusFilter === "upcoming" ? "all" : "upcoming"); }, active: statusFilter === "upcoming" },
              { label: "Taux de conversion", value: aggregates?.conversionRate ?? 0, color: "var(--blue)", suffix: "%", filterAction: () => {}, active: false },
              { label: "Moy. par SDR", value: aggregates?.avgPerSdr ?? 0, color: "var(--amber)", filterAction: () => {}, active: false },
              { label: "Cette semaine", value: aggregates?.meetingsThisWeek ?? 0, color: "var(--accent)", filterAction: () => { setDatePreset("7days"); }, active: datePreset === "7days" },
            ].map((card) => (
              <div
                key={card.label}
                className={`rdv-metric-card ${card.active ? "active" : ""}`}
                style={{ flex: 1, minWidth: 200 }}
                onClick={card.filterAction}
              >
                <div style={{ position: "absolute", left: 0, top: 16, bottom: 16, width: 4, borderRadius: "0 3px 3px 0", background: card.color }} />
                <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                  <AnimatedNumber value={card.value} />
                  {card.suffix || ""}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 6, fontWeight: 500 }}>{card.label}</div>
              </div>
            ))
          )}
        </div>

        {/* ═══ ZONE 3: MAIN WORKSPACE ═══ */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
          {/* FILTER SIDEBAR */}
          {sidebarOpen && (
            <div
              className="rdv-scrollbar"
              style={{
                width: 290,
                flexShrink: 0,
                borderRight: "1px solid var(--border)",
                background: "var(--surface)",
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Filter size={15} />
                  Filtres
                  {activeFilterCount > 0 && (
                    <span style={{ background: "var(--accent)", color: "white", borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
                      {activeFilterCount}
                    </span>
                  )}
                </span>
                <button style={{ background: "none", border: "none", color: "var(--ink3)", cursor: "pointer" }} onClick={() => setSidebarOpen(false)}>
                  <ChevronLeft size={16} />
                </button>
              </div>

              <FilterSection title="Période">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {([["today", "Aujourd'hui"], ["7days", "7 jours"], ["30days", "30 jours"], ["3months", "3 mois"], ["custom", "Personnalisée"]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      className="rdv-btn"
                      style={{
                        padding: "5px 12px",
                        fontSize: 12,
                        borderRadius: 8,
                        background: datePreset === key ? "var(--accentLight)" : "var(--surface2)",
                        color: datePreset === key ? "var(--accent)" : "var(--ink2)",
                        border: `1px solid ${datePreset === key ? "var(--accent)" : "transparent"}`,
                        fontWeight: datePreset === key ? 600 : 400,
                      }}
                      onClick={() => setDatePreset(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {datePreset === "custom" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input type="date" className="rdv-input" style={{ flex: 1, fontSize: 12, padding: "8px 10px" }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <input type="date" className="rdv-input" style={{ flex: 1, fontSize: 12, padding: "8px 10px" }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                )}
              </FilterSection>

              <FilterSection title="Clients">
                {clientOptions.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--ink3)", padding: "4px 0" }}>Aucun client</div>
                ) : (
                  <>
                    <button
                      style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                      onClick={() => {
                        if (selectedClients.size === clientOptions.length) setSelectedClients(new Set());
                        else setSelectedClients(new Set(clientOptions.map((c) => c.id)));
                      }}
                    >
                      {selectedClients.size === clientOptions.length ? "Tout désélectionner" : "Tout sélectionner"}
                    </button>
                    {clientOptions.map((c) => (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink2)", cursor: "pointer", padding: "5px 0" }}>
                        <input type="checkbox" className="rdv-checkbox" checked={selectedClients.has(c.id)} onChange={() => { setSelectedClients((prev) => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; }); }} />
                        <span style={{ flex: 1 }}>{c.name}</span>
                      </label>
                    ))}
                  </>
                )}
              </FilterSection>

              <FilterSection title="Missions">
                {missionOptions.map((m) => (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink2)", cursor: "pointer", padding: "5px 0" }}>
                    <input type="checkbox" className="rdv-checkbox" checked={selectedMissions.has(m.id)} onChange={() => { setSelectedMissions((prev) => { const next = new Set(prev); if (next.has(m.id)) next.delete(m.id); else next.add(m.id); return next; }); }} />
                    <span style={{ flex: 1 }}>{m.name}</span>
                  </label>
                ))}
              </FilterSection>

              <FilterSection title="SDRs">
                {sdrOptions.map((s) => (
                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink2)", cursor: "pointer", padding: "5px 0" }}>
                    <input type="checkbox" className="rdv-checkbox" checked={selectedSdrs.has(s.id)} onChange={() => { setSelectedSdrs((prev) => { const next = new Set(prev); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; }); }} />
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: hashColor(s.name), display: "grid", placeContent: "center", fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0 }}>
                      {s.name.charAt(0)}
                    </div>
                    <span style={{ flex: 1 }}>{s.name}</span>
                  </label>
                ))}
              </FilterSection>

              <FilterSection title="Statut">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {([["all", "Tous"], ["upcoming", "À venir"], ["past", "Passés"], ["cancelled", "Annulés"]] as const).map(([key, label]) => (
                    <button key={key} className="rdv-pill" style={{ cursor: "pointer", padding: "5px 14px", background: statusFilter === key ? statusBg(key === "all" ? "upcoming" : key) : "var(--surface2)", color: statusFilter === key ? statusColor(key === "all" ? "upcoming" : key) : "var(--ink3)", border: `1px solid ${statusFilter === key ? statusColor(key === "all" ? "upcoming" : key) : "transparent"}` }} onClick={() => setStatusFilter(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Type">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {([["VISIO", "📹 Visio"], ["PHYSIQUE", "📍 Physique"], ["TELEPHONIQUE", "📞 Téléphonique"]] as const).map(([key, label]) => (
                    <button key={key} className="rdv-pill" style={{ cursor: "pointer", padding: "5px 14px", background: selectedMeetingTypes.has(key as MeetingTypeFilter) ? "var(--accentLight)" : "var(--surface2)", color: selectedMeetingTypes.has(key as MeetingTypeFilter) ? "var(--accent)" : "var(--ink3)", border: `1px solid ${selectedMeetingTypes.has(key as MeetingTypeFilter) ? "var(--accent)" : "transparent"}` }} onClick={() => { setSelectedMeetingTypes((prev) => { const next = new Set(prev); const k = key as MeetingTypeFilter; if (next.has(k)) next.delete(k); else next.add(k); return next; }); }}>
                      {label}
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Feedback">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {([["POSITIVE", "Positif"], ["NEUTRAL", "Neutre"], ["NEGATIVE", "Négatif"], ["NO_SHOW", "Absent"], ["NONE", "Sans retour"]] as const).map(([key, label]) => (
                    <button key={key} className="rdv-pill" style={{ cursor: "pointer", padding: "5px 14px", background: selectedOutcomes.has(key as OutcomeFilter) ? "var(--accentLight)" : "var(--surface2)", color: selectedOutcomes.has(key as OutcomeFilter) ? "var(--accent)" : "var(--ink3)", border: `1px solid ${selectedOutcomes.has(key as OutcomeFilter) ? "var(--accent)" : "transparent"}` }} onClick={() => { setSelectedOutcomes((prev) => { const next = new Set(prev); const k = key as OutcomeFilter; if (next.has(k)) next.delete(k); else next.add(k); return next; }); }}>
                      {label}
                    </button>
                  ))}
                </div>
              </FilterSection>

              {activeFilterCount > 0 && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 500 }}>Filtres actifs</span>
                    <button style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }} onClick={clearAllFilters}>
                      Tout effacer
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {debouncedSearch && <FilterChip label={`"${debouncedSearch}"`} onRemove={() => { setSearch(""); setDebouncedSearch(""); }} />}
                    {statusFilter !== "all" && <FilterChip label={statusLabel(statusFilter)} onRemove={() => setStatusFilter("all")} />}
                    {Array.from(selectedClients).map((id) => {
                      const c = clientOptions.find((o) => o.id === id);
                      return c ? <FilterChip key={id} label={c.name} onRemove={() => setSelectedClients((p) => { const n = new Set(p); n.delete(id); return n; })} /> : null;
                    })}
                    {Array.from(selectedMeetingTypes).map((t) => (
                      <FilterChip key={t} label={meetingTypeLabel(t)} onRemove={() => setSelectedMeetingTypes((p) => { const n = new Set(p); n.delete(t); return n; })} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                position: "absolute", left: 0, top: 16, zIndex: 10,
                background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "none",
                borderRadius: "0 10px 10px 0", padding: "10px 8px", color: "var(--ink3)", cursor: "pointer",
                boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
              }}
            >
              <Filter size={14} />
              {activeFilterCount > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, background: "var(--accent)", color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "grid", placeContent: "center" }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {/* MAIN CONTENT */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", transition: "margin-right 0.35s cubic-bezier(0.16,1,0.3,1)", marginRight: panelOpen ? 480 : 0 }}>
            {view === "list" && (
              <>
                <div
                  style={{
                    display: "flex", alignItems: "center", padding: "10px 24px",
                    borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 600,
                    color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em",
                    flexShrink: 0, gap: 12, background: "var(--surface)",
                  }}
                >
                  <div style={{ width: 36 }}>
                    <input type="checkbox" className="rdv-checkbox" checked={selectedIds.size > 0 && selectedIds.size === meetings.length} onChange={toggleSelectAll} />
                  </div>
                  <div style={{ width: 90 }}>Date</div>
                  <div style={{ flex: 2, minWidth: 160 }}>Contact</div>
                  <div style={{ flex: 2, minWidth: 140 }}>Entreprise</div>
                  <div style={{ flex: 1, minWidth: 100 }}>Client</div>
                  <div style={{ flex: 1, minWidth: 100 }}>Mission</div>
                  <div style={{ width: 120 }}>SDR</div>
                  <div style={{ width: 44, textAlign: "center" }}>Type</div>
                  <div style={{ width: 80, textAlign: "center" }}>Statut</div>
                  <div style={{ width: 44, textAlign: "center" }}>FB</div>
                  <div style={{ width: 48 }} />
                </div>

                <div ref={listRef} className="rdv-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
                  {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", padding: "16px 24px", gap: 12, borderBottom: "1px solid var(--border)" }}>
                        <Skeleton w={18} h={18} r={5} />
                        <Skeleton w={70} h={44} r={8} />
                        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 4 }}><Skeleton w="75%" h={14} /><Skeleton w="50%" h={10} /></div>
                        <div style={{ flex: 2 }}><Skeleton w="65%" h={14} /></div>
                        <div style={{ flex: 1 }}><Skeleton w="60%" h={24} r={12} /></div>
                        <div style={{ flex: 1 }}><Skeleton w="55%" h={14} /></div>
                        <Skeleton w={90} h={14} />
                        <Skeleton w={30} h={30} r={15} />
                        <Skeleton w={60} h={24} r={12} />
                        <Skeleton w={22} h={22} r={11} />
                      </div>
                    ))
                  ) : meetings.length === 0 ? (
                    <EmptyState />
                  ) : (
                    meetings.map((m) => (
                      <MeetingRow key={m.id} meeting={m} selected={selectedIds.has(m.id)} onToggleSelect={toggleSelect} onOpen={openPanel} />
                    ))
                  )}
                  {loadingMore && (
                    <div style={{ padding: 20, textAlign: "center" }}>
                      <RefreshCw size={16} style={{ animation: "spin 1s linear infinite", color: "var(--ink3)" }} />
                    </div>
                  )}
                </div>
              </>
            )}

            {view === "board" && (
              <div style={{ flex: 1, display: "flex", gap: 20, padding: 24, overflowX: "auto" }}>
                {([
                  { key: "upcoming", label: "À venir", color: "var(--green)" },
                  { key: "past", label: "Passé", color: "var(--blue)" },
                  { key: "feedback", label: "Feedback reçu", color: "var(--amber)" },
                  { key: "cancelled", label: "Annulé", color: "var(--red)" },
                ] as const).map((col) => (
                  <div key={col.key} className="rdv-board-col">
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{col.label}</span>
                      <span style={{ fontSize: 12, color: "var(--ink3)", marginLeft: "auto", background: "var(--surface2)", borderRadius: 10, padding: "2px 8px", fontWeight: 600 }}>
                        {boardColumns[col.key]?.length ?? 0}
                      </span>
                    </div>
                    <div className="rdv-scrollbar" style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                      {loading ? (
                        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} w="100%" h={88} r={12} />)
                      ) : (
                        (boardColumns[col.key] ?? []).map((m) => (
                          <div key={m.id} className="rdv-board-card" onClick={() => openPanel(m)}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                              <Avatar name={contactName(m.contact)} size={32} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {contactName(m.contact)}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {m.company?.name || "—"}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink3)" }}>
                              <Clock size={12} />
                              {m.callbackDate ? new Date(m.callbackDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                              <span style={{ marginLeft: "auto", fontWeight: 500 }}>{m.sdr.name}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {view === "calendar" && (
              <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                  <button className="rdv-btn rdv-btn-ghost" style={{ padding: "8px 10px" }} onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}>
                    <ChevronLeft size={16} />
                  </button>
                  <h2 className="rdv-serif" style={{ fontSize: 22, margin: 0, color: "var(--ink)", textTransform: "capitalize" }}>
                    {calendarDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                  </h2>
                  <button className="rdv-btn rdv-btn-ghost" style={{ padding: "8px 10px" }} onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}>
                    <ChevronRight size={16} />
                  </button>
                  <div style={{ display: "flex", gap: 4, marginLeft: "auto", background: "var(--surface2)", borderRadius: 10, padding: 2 }}>
                    <button className="rdv-btn" style={{ padding: "6px 14px", borderRadius: 8, background: calendarView === "month" ? "var(--surface)" : "transparent", color: calendarView === "month" ? "var(--accent)" : "var(--ink3)", border: "none", boxShadow: calendarView === "month" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }} onClick={() => setCalendarView("month")}>Mois</button>
                    <button className="rdv-btn" style={{ padding: "6px 14px", borderRadius: 8, background: calendarView === "week" ? "var(--surface)" : "transparent", color: calendarView === "week" ? "var(--accent)" : "var(--ink3)", border: "none", boxShadow: calendarView === "week" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }} onClick={() => setCalendarView("week")}>Semaine</button>
                  </div>
                </div>

                {calendarView === "month" && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
                      {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                        <div key={d} style={{ fontSize: 12, fontWeight: 600, color: "var(--ink3)", textAlign: "center", padding: 10 }}>{d}</div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                      {calendarDays.map(({ date, inMonth }, i) => {
                        const key = date.toISOString().slice(0, 10);
                        const dayMeetings = calendarMeetings.get(key) || [];
                        const isToday = key === new Date().toISOString().slice(0, 10);
                        const isExpanded = expandedDay === key;
                        return (
                          <div
                            key={i}
                            onClick={() => dayMeetings.length > 0 && setExpandedDay(isExpanded ? null : key)}
                            style={{
                              minHeight: isExpanded ? "auto" : 90,
                              background: isExpanded ? "var(--surface2)" : "var(--surface)",
                              border: `1px solid ${isToday ? "var(--accent)" : "var(--border)"}`,
                              borderRadius: 10,
                              padding: 10,
                              opacity: inMonth ? 1 : 0.35,
                              cursor: dayMeetings.length > 0 ? "pointer" : "default",
                              transition: "all 0.15s",
                              gridColumn: isExpanded ? "1 / -1" : undefined,
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--accent)" : "var(--ink2)", marginBottom: 6 }}>
                              {date.getDate()}
                            </div>
                            {!isExpanded && (
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {dayMeetings.slice(0, 4).map((m) => (
                                  <div key={m.id} style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(meetingStatus(m)) }} />
                                ))}
                                {dayMeetings.length > 4 && <span style={{ fontSize: 10, color: "var(--ink3)" }}>+{dayMeetings.length - 4}</span>}
                              </div>
                            )}
                            {isExpanded && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                                {dayMeetings.map((m) => (
                                  <div key={m.id} className="rdv-board-card" onClick={(e) => { e.stopPropagation(); openPanel(m); }} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ width: 4, height: 36, borderRadius: 2, background: statusColor(meetingStatus(m)), flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{contactName(m.contact)}</div>
                                      <div style={{ fontSize: 12, color: "var(--ink3)" }}>
                                        {m.company?.name || "—"} · {m.callbackDate ? new Date(m.callbackDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                      </div>
                                    </div>
                                    {meetingTypeIcon(m.meetingType)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {calendarView === "week" && <WeekView calendarDate={calendarDate} calendarMeetings={calendarMeetings} openPanel={openPanel} />}
              </div>
            )}
          </div>

          {/* DETAIL SIDE PANEL */}
          <div className={`rdv-panel rdv-scrollbar ${panelOpen ? "open" : ""}`}>
            {selectedMeeting && (
              <>
                <div style={{ padding: "28px 28px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <Avatar name={contactName(selectedMeeting.contact)} size={60} />
                      <div>
                        <div className="rdv-serif" style={{ fontSize: 22, color: "var(--ink)" }}>
                          {contactName(selectedMeeting.contact)}
                        </div>
                        <div style={{ fontSize: 14, color: "var(--ink2)", marginTop: 2 }}>
                          {selectedMeeting.contact?.title || "—"} · {selectedMeeting.company?.name || "—"}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setPanelOpen(false)} style={{ background: "var(--surface2)", border: "none", color: "var(--ink3)", cursor: "pointer", padding: 6, borderRadius: 8 }}>
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <span className="rdv-pill" style={{ background: statusBg(meetingStatus(selectedMeeting)), color: statusColor(meetingStatus(selectedMeeting)), padding: "4px 14px" }}>
                      {statusLabel(meetingStatus(selectedMeeting))}
                    </span>
                    <span className="rdv-pill" style={{ background: "var(--surface2)", color: "var(--ink2)", padding: "4px 14px" }}>
                      {meetingTypeIcon(selectedMeeting.meetingType)} {meetingTypeLabel(selectedMeeting.meetingType)}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {selectedMeeting.contact?.email && (
                      <a href={`mailto:${selectedMeeting.contact.email}`} className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px", textDecoration: "none" }}>
                        <Mail size={13} /> Email
                      </a>
                    )}
                    {selectedMeeting.contact?.phone && (
                      <a href={`tel:${selectedMeeting.contact.phone}`} className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px", textDecoration: "none" }}>
                        <Phone size={13} /> Appeler
                      </a>
                    )}
                    {selectedMeeting.contact?.linkedin && (
                      <a href={selectedMeeting.contact.linkedin} target="_blank" rel="noreferrer" className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px", textDecoration: "none" }}>
                        <Linkedin size={13} /> LinkedIn
                      </a>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 0, borderBottom: "none" }}>
                    {([["detail", "Détail", FileText], ["feedback", "Feedback", ThumbsUp], ["note", "Note interne", MessageSquare], ["history", "Historique", History]] as const).map(([key, label, Icon]) => (
                      <button key={key} className={`rdv-tab ${panelTab === key ? "active" : ""}`} onClick={() => setPanelTab(key)}>
                        <Icon size={13} style={{ display: "inline", marginRight: 5, verticalAlign: -2 }} />{label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ padding: 28 }}>
                  {panelTab === "detail" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <DetailRow label="Date & heure">
                        <span style={{ color: dateProximityColor(selectedMeeting.callbackDate), fontWeight: 500 }}>
                          {selectedMeeting.callbackDate ? new Date(selectedMeeting.callbackDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </span>
                      </DetailRow>
                      <DetailRow label="Type de RDV">
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {meetingTypeIcon(selectedMeeting.meetingType)} {meetingTypeLabel(selectedMeeting.meetingType)}
                        </span>
                      </DetailRow>
                      {selectedMeeting.meetingJoinUrl && (
                        <DetailRow label="Lien visio">
                          <a href={selectedMeeting.meetingJoinUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 13, display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
                            Rejoindre <ExternalLink size={12} />
                          </a>
                        </DetailRow>
                      )}
                      {selectedMeeting.meetingAddress && <DetailRow label="Adresse"><span style={{ color: "var(--ink2)" }}>{selectedMeeting.meetingAddress}</span></DetailRow>}
                      <DetailRow label="SDR">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar name={selectedMeeting.sdr.name} size={26} />
                          <span style={{ color: "var(--ink)", fontWeight: 500 }}>{selectedMeeting.sdr.name}</span>
                        </div>
                      </DetailRow>
                      <DetailRow label="Client">{selectedMeeting.client?.name || "—"}</DetailRow>
                      <DetailRow label="Mission">{selectedMeeting.mission.name}</DetailRow>
                      <DetailRow label="Campagne">{selectedMeeting.campaign.name}</DetailRow>
                      <DetailRow label="Entreprise">
                        <div>
                          <div style={{ color: "var(--ink)", fontWeight: 500 }}>{selectedMeeting.company?.name || "—"}</div>
                          {selectedMeeting.company?.industry && <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>{selectedMeeting.company.industry}</div>}
                          {selectedMeeting.company?.website && (
                            <a href={selectedMeeting.company.website.startsWith("http") ? selectedMeeting.company.website : `https://${selectedMeeting.company.website}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--accent)" }}>
                              {selectedMeeting.company.website}
                            </a>
                          )}
                        </div>
                      </DetailRow>
                      <DetailRow label="Contact">
                        <div>
                          <div style={{ color: "var(--ink)", fontWeight: 500 }}>{contactName(selectedMeeting.contact)}</div>
                          {selectedMeeting.contact?.title && <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 1 }}>{selectedMeeting.contact.title}</div>}
                          {selectedMeeting.contact?.email && <div style={{ fontSize: 12, color: "var(--ink3)" }}>{selectedMeeting.contact.email}</div>}
                          {selectedMeeting.contact?.phone && <div style={{ fontSize: 12, color: "var(--ink3)" }}>{selectedMeeting.contact.phone}</div>}
                        </div>
                      </DetailRow>
                      {selectedMeeting.note && <DetailRow label="Note SDR"><span style={{ color: "var(--ink2)", whiteSpace: "pre-wrap" }}>{selectedMeeting.note}</span></DetailRow>}
                      <DetailRow label="Créé le">{new Date(selectedMeeting.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</DetailRow>
                    </div>
                  )}

                  {panelTab === "feedback" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>Résultat du RDV</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {([
                            ["POSITIVE", "Positif", ThumbsUp, "var(--green)", "var(--greenLight)"],
                            ["NEUTRAL", "Neutre", Minus, "var(--amber)", "var(--amberLight)"],
                            ["NEGATIVE", "Négatif", ThumbsDown, "var(--red)", "var(--redLight)"],
                            ["NO_SHOW", "Absent", UserX, "var(--ink3)", "var(--surface2)"],
                          ] as const).map(([key, label, Icon, color, bg]) => (
                            <button key={key} onClick={() => setFeedbackOutcome(key)} style={{ padding: 20, borderRadius: 12, border: `2px solid ${feedbackOutcome === key ? color : "var(--border)"}`, background: feedbackOutcome === key ? bg : "var(--surface)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
                              <Icon size={22} style={{ color }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Recontact</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {([["YES", "Oui"], ["NO", "Non"], ["MAYBE", "À rediscuter"]] as const).map(([key, label]) => (
                            <button key={key} className="rdv-pill" onClick={() => setFeedbackRecontact(key)} style={{ cursor: "pointer", padding: "8px 18px", fontSize: 13, background: feedbackRecontact === key ? "var(--accentLight)" : "var(--surface2)", color: feedbackRecontact === key ? "var(--accent)" : "var(--ink3)", border: `1px solid ${feedbackRecontact === key ? "var(--accent)" : "transparent"}` }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Commentaire</div>
                        <textarea className="rdv-input" style={{ width: "100%", minHeight: 120, resize: "vertical" }} value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)} placeholder="Ajouter un commentaire sur le RDV…" />
                      </div>
                      <button className="rdv-btn rdv-btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 14 }} onClick={() => { if (selectedMeeting && feedbackOutcome) updateMeeting(selectedMeeting.id, { feedbackOutcome, feedbackRecontact: feedbackRecontact || "NO", feedbackNote }); }}>
                        <Check size={15} /> Enregistrer le feedback
                      </button>
                    </div>
                  )}

                  {panelTab === "note" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Note interne manager</span>
                        {noteStatus === "saving" && <span style={{ fontSize: 12, color: "var(--amber)", fontWeight: 500 }}>Enregistrement…</span>}
                        {noteStatus === "saved" && <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 500 }}>Sauvegardé ✓</span>}
                      </div>
                      <textarea className="rdv-input" style={{ width: "100%", minHeight: 240, resize: "vertical" }} value={managerNote} onChange={(e) => { setManagerNote(e.target.value); if (selectedMeeting) saveNote(selectedMeeting.id, e.target.value); }} placeholder="Ajouter une note interne (non visible par le client)…" />
                    </div>
                  )}

                  {panelTab === "history" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <HistoryEntry time={selectedMeeting.createdAt} actor={selectedMeeting.sdr.name} description="RDV créé" color="var(--green)" />
                      {selectedMeeting.feedback && <HistoryEntry time={selectedMeeting.createdAt} actor="Client" description={`Feedback : ${outcomeLabel(selectedMeeting.feedback.outcome)}`} color="var(--amber)" />}
                      {selectedMeeting.result === "MEETING_CANCELLED" && <HistoryEntry time={selectedMeeting.createdAt} actor="—" description={`Annulé${selectedMeeting.cancellationReason ? ` : ${selectedMeeting.cancellationReason}` : ""}`} color="var(--red)" />}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* BULK ACTIONS BAR */}
        {selectedIds.size > 0 && (
          <div
            style={{
              position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
              background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 16,
              padding: "12px 24px", display: "flex", alignItems: "center", gap: 14, zIndex: 40,
              animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
            </span>
            <div style={{ width: 1, height: 24, background: "var(--border2)" }} />
            <button className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12 }} onClick={() => downloadCSV(meetings.filter((m) => selectedIds.has(m.id)), "selection")}>
              <Download size={13} /> Exporter CSV
            </button>
            <button className="rdv-btn" style={{ fontSize: 12, background: "var(--redLight)", color: "var(--red)", border: "1px solid rgba(220,38,38,0.2)" }} onClick={() => deleteMeetings(Array.from(selectedIds))}>
              <Trash2 size={13} /> Supprimer
            </button>
            <button style={{ background: "var(--surface2)", border: "none", color: "var(--ink3)", cursor: "pointer", padding: 6, borderRadius: 8 }} onClick={() => setSelectedIds(new Set())}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════ */

const Avatar = memo(function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const color = hashColor(name);
  const first = name.split(" ").map((w) => w[0] || "").join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "grid", placeContent: "center", fontSize: size * 0.36, fontWeight: 700, color: "white", flexShrink: 0 }}>
      {first}
    </div>
  );
});

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", color: "var(--ink)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: open ? 10 : 0, fontFamily: "'DM Sans', sans-serif" }}>
        {title}
        {open ? <ChevronUp size={14} style={{ color: "var(--ink3)" }} /> : <ChevronDown size={14} style={{ color: "var(--ink3)" }} />}
      </button>
      {open && <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{children}</div>}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accentLight)", color: "var(--accent)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 500 }}>
      {label}
      <button onClick={onRemove} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, display: "flex" }}>
        <X size={12} />
      </button>
    </span>
  );
}

const MeetingRow = memo(function MeetingRow({ meeting, selected, onToggleSelect, onOpen }: { meeting: Meeting; selected: boolean; onToggleSelect: (id: string) => void; onOpen: (m: Meeting) => void }) {
  const status = meetingStatus(meeting);
  const date = formatDateShort(meeting.callbackDate);

  return (
    <div
      className="rdv-row"
      onClick={() => onOpen(meeting)}
      style={{
        display: "flex", alignItems: "center", padding: "0 24px", height: 80,
        borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 0.15s",
        gap: 12, borderLeft: selected ? "3px solid var(--accent)" : "3px solid transparent",
        background: selected ? "rgba(108,99,255,0.04)" : "transparent",
      }}
    >
      <div style={{ width: 36 }} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="rdv-checkbox" checked={selected} onChange={() => onToggleSelect(meeting.id)} />
      </div>

      <div style={{ width: 90, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>{date.day}</div>
        <div style={{ fontSize: 11, color: "var(--ink3)", textTransform: "uppercase", fontWeight: 500 }}>{date.month}</div>
        <span style={{ fontSize: 10, fontWeight: 600, background: `${dateProximityColor(meeting.callbackDate)}15`, color: dateProximityColor(meeting.callbackDate), borderRadius: 5, padding: "2px 7px" }}>
          {date.time}
        </span>
      </div>

      <div style={{ flex: 2, minWidth: 160, display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={contactName(meeting.contact)} size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {contactName(meeting.contact)}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
            {meeting.contact?.title || "—"}
          </div>
        </div>
      </div>

      <div style={{ flex: 2, minWidth: 140, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", display: "grid", placeContent: "center", fontSize: 13, fontWeight: 700, color: "var(--ink3)", flexShrink: 0 }}>
          {(meeting.company?.name || "?")[0]}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
            {meeting.company?.name || "—"}
          </div>
          {meeting.company?.industry && (
            <span style={{ fontSize: 10, color: "var(--ink3)", background: "var(--surface2)", padding: "2px 7px", borderRadius: 4, fontWeight: 500 }}>
              {meeting.company.industry}
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 100 }}>
        {meeting.client && (
          <span className="rdv-pill" style={{ background: `${hashColor(meeting.client.name)}12`, color: hashColor(meeting.client.name), fontWeight: 600 }}>
            {meeting.client.name}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 100, fontSize: 13, color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {meeting.mission.name}
      </div>

      <div style={{ width: 120, display: "flex", alignItems: "center", gap: 8 }}>
        <Avatar name={meeting.sdr.name} size={24} />
        <span style={{ fontSize: 13, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {meeting.sdr.name}
        </span>
      </div>

      <div style={{ width: 44, textAlign: "center", color: "var(--ink3)" }}>{meetingTypeIcon(meeting.meetingType)}</div>

      <div style={{ width: 80, textAlign: "center" }}>
        <span className="rdv-pill" style={{ background: statusBg(status), color: statusColor(status), padding: "4px 12px" }}>
          {statusLabel(status)}
        </span>
      </div>

      <div style={{ width: 44, textAlign: "center" }}>{outcomeIcon(meeting.feedback?.outcome || null)}</div>

      <div style={{ width: 48, position: "relative" }}>
        <div className="rdv-row-actions" style={{ opacity: 0, transition: "opacity 0.15s", display: "flex", gap: 4 }}>
          {meeting.contact?.email && (
            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(meeting.contact!.email!); }} style={{ background: "var(--surface2)", border: "none", color: "var(--ink3)", cursor: "pointer", padding: 4, borderRadius: 6 }} title="Copier email">
              <Copy size={13} />
            </button>
          )}
          {meeting.contact?.linkedin && (
            <a href={meeting.contact.linkedin} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--ink3)", padding: 4, background: "var(--surface2)", borderRadius: 6, display: "flex" }} title="LinkedIn">
              <Linkedin size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
});

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
      <span style={{ fontSize: 13, color: "var(--ink3)", minWidth: 110, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <div style={{ fontSize: 13, color: "var(--ink)", textAlign: "right", flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function HistoryEntry({ time, actor, description, color }: { time: string; actor: string; description: string; color: string }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, marginTop: 5, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 13, color: "var(--ink2)" }}>
          <strong style={{ color: "var(--ink)" }}>{actor}</strong> — {description}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>
          {new Date(time).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 32px", color: "var(--ink3)" }}>
      <svg width="140" height="110" viewBox="0 0 140 110" fill="none" style={{ marginBottom: 28, opacity: 0.5 }}>
        <rect x="15" y="22" width="110" height="78" rx="14" stroke="var(--border2)" strokeWidth="2" fill="var(--surface2)" />
        <rect x="30" y="40" width="80" height="7" rx="3.5" fill="var(--border2)" />
        <rect x="30" y="54" width="55" height="7" rx="3.5" fill="var(--border)" />
        <rect x="30" y="68" width="65" height="7" rx="3.5" fill="var(--border)" />
        <circle cx="70" cy="16" r="12" stroke="var(--accent)" strokeWidth="2" fill="var(--accentLight)" />
        <path d="M65 16l4 4 6-6" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink2)", marginBottom: 10 }}>Aucun rendez-vous trouvé</div>
      <div style={{ fontSize: 14, textAlign: "center", maxWidth: 340, lineHeight: 1.5 }}>
        Ajustez vos filtres ou la période sélectionnée pour afficher des résultats.
      </div>
    </div>
  );
}

function WeekView({ calendarDate, calendarMeetings, openPanel }: { calendarDate: Date; calendarMeetings: Map<string, Meeting[]>; openPanel: (m: Meeting) => void }) {
  const weekStart = new Date(calendarDate);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - ((day + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const hours = Array.from({ length: 12 }, (_, i) => i + 8);

  return (
    <div style={{ display: "flex", gap: 0, overflow: "auto" }}>
      <div style={{ width: 56, flexShrink: 0 }}>
        <div style={{ height: 48 }} />
        {hours.map((h) => (
          <div key={h} style={{ height: 64, fontSize: 11, color: "var(--ink3)", textAlign: "right", paddingRight: 10, paddingTop: 2, fontWeight: 500 }}>
            {h}:00
          </div>
        ))}
      </div>
      {days.map((d) => {
        const key = d.toISOString().slice(0, 10);
        const dayMeetings = calendarMeetings.get(key) || [];
        const isToday = key === new Date().toISOString().slice(0, 10);
        return (
          <div key={key} style={{ flex: 1, minWidth: 110, borderLeft: "1px solid var(--border)" }}>
            <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--accent)" : "var(--ink2)" }}>
              {d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}
            </div>
            <div style={{ position: "relative" }}>
              {hours.map((h) => (<div key={h} style={{ height: 64, borderTop: "1px solid var(--border)" }} />))}
              {dayMeetings.map((m) => {
                if (!m.callbackDate) return null;
                const md = new Date(m.callbackDate);
                const hour = md.getHours();
                const min = md.getMinutes();
                if (hour < 8 || hour >= 20) return null;
                const top = (hour - 8) * 64 + Math.round(min * 64 / 60);
                return (
                  <div key={m.id} onClick={() => openPanel(m)} style={{ position: "absolute", top, left: 3, right: 3, height: 56, borderRadius: 8, background: statusBg(meetingStatus(m)), borderLeft: `3px solid ${statusColor(meetingStatus(m))}`, padding: "6px 8px", cursor: "pointer", overflow: "hidden", fontSize: 12, color: "var(--ink)" }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contactName(m.contact)}</div>
                    <div style={{ color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>{m.company?.name || "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
