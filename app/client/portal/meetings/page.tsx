"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Badge, useToast } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Calendar, Search, X, ThumbsUp, Minus, ThumbsDown, XCircle,
  Mail, Phone, Linkedin, Download, Check, Loader2, Eye,
  MessageSquare, Edit3, Clock, FileSpreadsheet, AlertTriangle,
  CalendarClock, Send, Building2, MapPin, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMeetingCancellationLabel } from "@/lib/constants/meetingCancellationReasons";
import { MeetingsSkeleton } from "@/components/client/skeletons";

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS  — single source of truth
═══════════════════════════════════════════════════════════════ */
const tk = {
  bg:           "#F2F3F7",
  surface:      "#FFFFFF",
  surfaceRaised:"#FAFAFA",
  border:       "rgba(0,0,0,0.07)",
  borderStrong: "rgba(0,0,0,0.12)",

  ink:  "#0A0A0B",
  ink2: "#2D2D35",
  ink3: "#6B6B7B",
  ink4: "#A0A0B0",

  accent:      "#5B4FE8",
  accentMid:   "#7B72EF",
  accentLight: "#EEEDFB",
  accentText:  "#4238D0",

  green:      "#12A05C",
  greenLight: "#E8F8EF",
  greenMid:   "#4DB87A",
  greenText:  "#0A6E3D",

  amber:      "#D4860A",
  amberLight: "#FEF6E4",
  amberText:  "#8A4A00",

  red:        "#D93025",
  redLight:   "#FDE8E7",
  redText:    "#8B1A14",
} as const;

/* ═══════════════════════════════════════════════════════════════
   GLOBAL CSS  — injected once at runtime
═══════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap');

.cp-page *, .cp-page *::before, .cp-page *::after { box-sizing: border-box; }
.cp-page { font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

/* ── Keyframes ── */
@keyframes cp-fade-up   { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
@keyframes cp-fade-in   { from { opacity:0; } to { opacity:1; } }
@keyframes cp-scale-in  { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:none; } }
@keyframes cp-slide-down{ from { opacity:0; max-height:0; transform:translateY(-8px); } to { opacity:1; max-height:800px; transform:none; } }
@keyframes cp-spin      { to { transform:rotate(360deg); } }
@keyframes cp-bounce-in { 0%{transform:scale(0.6);opacity:0;} 60%{transform:scale(1.1);} 100%{transform:scale(1);opacity:1;} }
@keyframes cp-stripe-in { from{transform:scaleX(0);transform-origin:left;} to{transform:scaleX(1);} }
@keyframes cp-count-in  { from{opacity:0;transform:translateY(5px) scale(0.92);} to{opacity:1;transform:none;} }

/* ── Entry animations ── */
.cp-enter       { animation: cp-fade-up  0.4s cubic-bezier(0.16,1,0.3,1) both; }
.cp-enter-scale { animation: cp-scale-in 0.28s cubic-bezier(0.16,1,0.3,1) both; }
.cp-enter-fade  { animation: cp-fade-in  0.25s ease both; }

/* ── Cards ── */
.cp-card {
  background: ${tk.surface};
  border: 1px solid ${tk.border};
  border-radius: 16px;
  overflow: hidden;
  transition: box-shadow 0.25s ease, border-color 0.22s ease;
}
.cp-card:hover {
  box-shadow: 0 8px 32px -8px rgba(0,0,0,0.11);
  border-color: ${tk.borderStrong};
}
.cp-card-upcoming:hover {
  box-shadow: 0 8px 32px -8px rgba(91,79,232,0.16);
  border-color: rgba(91,79,232,0.18);
}

/* ── Stat button ── */
.cp-stat {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  border: 1px solid ${tk.border};
  border-radius: 14px;
  background: ${tk.surface};
  transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
  outline: none;
}
.cp-stat:hover { transform: translateY(-2px); box-shadow: 0 6px 20px -6px rgba(0,0,0,0.1); }
.cp-stat:focus-visible { box-shadow: 0 0 0 3px rgba(91,79,232,0.3); }

/* ── Pill ── */
.cp-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px 3px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
  white-space: nowrap;
}

/* ── Tab ── */
.cp-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  transition: all 0.16s ease;
  white-space: nowrap;
  font-family: inherit;
  color: ${tk.ink3};
  outline: none;
}
.cp-tab:focus-visible { box-shadow: 0 0 0 2px ${tk.accent}; }
.cp-tab:not(.active):hover { color: ${tk.ink2}; background: rgba(0,0,0,0.04); }
.cp-tab.active {
  background: ${tk.surface};
  color: ${tk.ink};
  font-weight: 600;
  box-shadow: 0 1px 6px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.05);
}
.cp-tab-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 99px;
  transition: all 0.16s ease;
}

/* ── Buttons ── */
.cp-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border-radius: 10px; font-size: 13px; font-weight: 600;
  cursor: pointer; border: none; transition: all 0.16s ease;
  white-space: nowrap; user-select: none; font-family: inherit;
  outline: none;
}
.cp-btn:focus-visible { box-shadow: 0 0 0 3px rgba(91,79,232,0.3); }
.cp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.cp-btn:active:not(:disabled) { transform: scale(0.97); }
.cp-btn-primary {
  background: ${tk.accent}; color: white;
  padding: 0 18px; height: 36px;
  box-shadow: 0 2px 10px rgba(91,79,232,0.28);
}
.cp-btn-primary:hover:not(:disabled) {
  background: ${tk.accentText};
  box-shadow: 0 4px 18px rgba(91,79,232,0.38);
  transform: translateY(-1px);
}
.cp-btn-secondary {
  background: ${tk.surface}; color: ${tk.ink2};
  border: 1px solid ${tk.border};
  padding: 0 14px; height: 36px;
}
.cp-btn-secondary:hover:not(:disabled) {
  background: ${tk.surfaceRaised}; border-color: ${tk.borderStrong};
}
.cp-btn-danger {
  background: ${tk.redLight}; color: ${tk.redText};
  border: 1px solid rgba(217,48,37,0.15);
  padding: 0 14px; height: 36px;
}
.cp-btn-danger:hover:not(:disabled) {
  background: #fbd6d4; border-color: rgba(217,48,37,0.3);
}
.cp-btn-ghost {
  background: transparent; color: ${tk.ink3};
  padding: 0 10px; height: 36px;
}
.cp-btn-ghost:hover:not(:disabled) { color: ${tk.ink2}; background: rgba(0,0,0,0.04); }

/* ── Inputs ── */
.cp-input {
  width: 100%; font-family: inherit; font-size: 13px; color: ${tk.ink};
  background: ${tk.surface}; border: 1px solid ${tk.border};
  border-radius: 10px; padding: 0 12px; height: 38px; outline: none;
  transition: border-color 0.16s, box-shadow 0.16s;
}
.cp-input:focus { border-color: ${tk.accent}; box-shadow: 0 0 0 3px rgba(91,79,232,0.11); }
.cp-input::placeholder { color: ${tk.ink4}; }
.cp-textarea {
  width: 100%; font-family: inherit; font-size: 13px; color: ${tk.ink};
  background: ${tk.surface}; border: 1px solid ${tk.border};
  border-radius: 10px; padding: 10px 14px; outline: none;
  resize: vertical; transition: border-color 0.16s, box-shadow 0.16s; line-height: 1.6;
}
.cp-textarea:focus { border-color: ${tk.accent}; box-shadow: 0 0 0 3px rgba(91,79,232,0.11); }
.cp-textarea::placeholder { color: ${tk.ink4}; }

/* ── Modal ── */
.cp-overlay {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center; padding: 20px;
  background: rgba(10,10,11,0.52);
  backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  animation: cp-fade-in 0.18s ease;
}
.cp-modal {
  background: ${tk.surface}; border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 24px 64px -10px rgba(0,0,0,0.22), 0 8px 20px -4px rgba(0,0,0,0.1);
  width: 100%; max-height: 88vh;
  display: flex; flex-direction: column; overflow: hidden;
  animation: cp-scale-in 0.28s cubic-bezier(0.16,1,0.3,1);
}
.cp-modal-header {
  padding: 22px 24px 18px;
  border-bottom: 1px solid ${tk.border};
  display: flex; align-items: flex-start; justify-content: space-between;
  flex-shrink: 0;
  background: linear-gradient(180deg, #FAFBFF 0%, ${tk.surface} 100%);
}
.cp-modal-title {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-size: 22px; font-weight: 400;
  color: ${tk.ink}; letter-spacing: -0.025em; line-height: 1.2; margin: 0;
}
.cp-modal-sub { font-size: 12px; color: ${tk.ink3}; margin: 3px 0 0; }
.cp-modal-close {
  width: 30px; height: 30px; border-radius: 8px;
  border: 1px solid ${tk.border}; background: ${tk.surfaceRaised};
  color: ${tk.ink3}; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.14s ease; flex-shrink: 0; margin-left: 12px;
  outline: none;
}
.cp-modal-close:hover { background: #EFEFF5; color: ${tk.ink}; border-color: ${tk.borderStrong}; }
.cp-modal-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
.cp-modal-body::-webkit-scrollbar { width: 5px; }
.cp-modal-body::-webkit-scrollbar-track { background: transparent; }
.cp-modal-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 3px; }
.cp-modal-footer {
  padding: 14px 20px; border-top: 1px solid ${tk.border};
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  flex-shrink: 0; background: ${tk.surfaceRaised};
}

/* ── Modal sections ── */
.cp-section { padding: 20px 24px; }
.cp-section + .cp-section { border-top: 1px solid ${tk.border}; }
.cp-section-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: ${tk.ink4}; margin-bottom: 12px;
}

/* ── Avatar ── */
.cp-avatar {
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-weight: 700; flex-shrink: 0; letter-spacing: -0.02em;
}

/* ── Date block ── */
.cp-date-block {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 70px; flex-shrink: 0; padding: 16px 6px;
  border-right: 1px solid ${tk.border};
}

/* ── Note quote ── */
.cp-note-quote {
  position: relative; padding: 12px 14px 12px 18px; border-radius: 10px;
  background: linear-gradient(135deg, rgba(91,79,232,0.04), rgba(91,79,232,0.02));
  border: 1px solid rgba(91,79,232,0.1);
  font-size: 13px; font-style: italic; color: ${tk.ink3}; line-height: 1.65;
}
.cp-note-quote::before {
  content: ''; position: absolute; left: 0; top: 10px; bottom: 10px;
  width: 3px; border-radius: 2px;
  background: linear-gradient(to bottom, ${tk.accentMid}, ${tk.accent});
}

/* ── AI summary ── */
.cp-ai-summary {
  padding: 14px 16px; border-radius: 12px;
  background: linear-gradient(135deg, #EEEDFB, #F3F2FD);
  border: 1px solid rgba(91,79,232,0.14);
  font-size: 13px; line-height: 1.65; color: ${tk.ink2};
}

/* ── Field ── */
.cp-field { display: flex; flex-direction: column; gap: 2px; }
.cp-field-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${tk.ink4}; }
.cp-field-val { font-size: 13px; color: ${tk.ink2}; font-weight: 500; }
.cp-field-nil { font-size: 13px; color: ${tk.ink4}; }

/* ── Signal panel ── */
.cp-signal {
  overflow: hidden;
  animation: cp-slide-down 0.32s cubic-bezier(0.16,1,0.3,1);
  border-top: 1px solid ${tk.border};
}
.cp-signal-inner {
  padding: 16px 20px 20px;
  background: linear-gradient(to bottom, #FFF8F7, #FEF2F1);
}
.cp-signal-form { animation: cp-fade-up 0.22s cubic-bezier(0.16,1,0.3,1); }

/* ── Choice button ── */
.cp-choice {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 7px;
  padding: 14px 8px; border-radius: 12px;
  border: 1.5px solid rgba(0,0,0,0.07);
  background: ${tk.surface}; cursor: pointer;
  font-family: inherit; font-size: 12px; font-weight: 600; color: ${tk.ink3};
  transition: all 0.18s cubic-bezier(0.16,1,0.3,1); outline: none;
}
.cp-choice:hover { border-color: rgba(0,0,0,0.14); color: ${tk.ink2}; transform: translateY(-1px); }
.cp-choice.sel {
  border-color: ${tk.red}; background: ${tk.redLight}; color: ${tk.redText};
  box-shadow: 0 4px 14px rgba(217,48,37,0.14); transform: translateY(-1px);
}
.cp-choice-ico {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.04); color: ${tk.ink4};
  transition: all 0.18s ease;
}
.cp-choice.sel .cp-choice-ico { background: rgba(217,48,37,0.12); color: ${tk.red}; }

/* ── Toggle ── */
.cp-toggle {
  flex: 1; height: 38px; border-radius: 10px;
  border: 1.5px solid ${tk.border}; background: ${tk.surface};
  font-family: inherit; font-size: 13px; font-weight: 600; color: ${tk.ink3};
  cursor: pointer; transition: all 0.16s ease; outline: none;
}
.cp-toggle:hover { border-color: ${tk.borderStrong}; color: ${tk.ink2}; }
.cp-toggle.sel { border-color: ${tk.accent}; background: ${tk.accentLight}; color: ${tk.accentText}; box-shadow: 0 2px 8px rgba(91,79,232,0.13); }

/* ── Outcome card ── */
.cp-outcome {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 16px 8px; border-radius: 14px;
  border: 1.5px solid ${tk.border}; background: ${tk.surface};
  cursor: pointer; font-family: inherit; font-size: 12.5px; font-weight: 600;
  color: ${tk.ink3}; transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
  user-select: none; outline: none;
}
.cp-outcome:hover { transform: translateY(-2px); border-color: ${tk.borderStrong}; color: ${tk.ink2}; }
.cp-outcome.sel { transform: translateY(-2px); }
.cp-outcome-ico {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.18s ease;
}

/* ── Recontact btn ── */
.cp-recontact {
  flex: 1; height: 40px; border-radius: 10px;
  border: 1.5px solid ${tk.border}; background: ${tk.surface};
  font-family: inherit; font-size: 13px; font-weight: 600; color: ${tk.ink3};
  cursor: pointer; transition: all 0.16s ease; outline: none;
}
.cp-recontact:hover { border-color: ${tk.borderStrong}; color: ${tk.ink2}; }
.cp-recontact.sel { border-color: ${tk.accent}; background: ${tk.accentLight}; color: ${tk.accentText}; box-shadow: 0 2px 8px rgba(91,79,232,0.12); }

/* ── Action button (inside card) ── */
.cp-action {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; border-radius: 8px; font-family: inherit;
  font-size: 12px; font-weight: 600; cursor: pointer;
  border: 1px solid ${tk.border}; background: ${tk.surface}; color: ${tk.ink3};
  transition: all 0.16s ease; white-space: nowrap; outline: none;
}
.cp-action:hover { background: ${tk.surfaceRaised}; border-color: ${tk.borderStrong}; color: ${tk.ink2}; }
.cp-action:active { transform: scale(0.97); }
.cp-action.prim {
  background: ${tk.accent}; color: white; border-color: transparent;
  box-shadow: 0 2px 8px rgba(91,79,232,0.25);
}
.cp-action.prim:hover { background: ${tk.accentText}; box-shadow: 0 4px 14px rgba(91,79,232,0.35); transform: translateY(-1px); }
.cp-action.dngr { background: ${tk.redLight}; color: ${tk.redText}; border-color: rgba(217,48,37,0.15); }
.cp-action.dngr:hover { background: #fbd6d4; border-color: rgba(217,48,37,0.28); }

/* ── Contact link ── */
.cp-link {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 500; color: ${tk.accentText};
  text-decoration: none; transition: color 0.14s;
}
.cp-link:hover { color: ${tk.accent}; text-decoration: underline; }

/* ── Empty ── */
.cp-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 80px 24px; text-align: center;
  background: ${tk.surface}; border-radius: 16px;
  border: 1px dashed ${tk.borderStrong};
}

/* ── Done check ── */
.cp-done-ico {
  width: 64px; height: 64px; border-radius: 50%; background: ${tk.greenLight};
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 18px;
  animation: cp-bounce-in 0.45s cubic-bezier(0.34,1.56,0.64,1);
}

/* ── Search ── */
.cp-search { position: relative; }
.cp-search input { padding-left: 36px; padding-right: 32px; }
.cp-search-ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); pointer-events: none; color: ${tk.ink4}; }
.cp-search-clr {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  color: ${tk.ink4}; background: none; border: none; cursor: pointer; padding: 2px;
  display: flex; transition: color 0.13s; outline: none;
}
.cp-search-clr:hover { color: ${tk.ink2}; }

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .cp-page * { animation: none !important; transition: none !important; }
}
`;

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
interface Meeting {
  id: string;
  createdAt: string;
  callbackDate?: string | null;
  result?: string;
  note?: string | null;
  voipSummary?: string | null;
  cancellationReason?: string | null;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    email: string | null;
    phone?: string | null;
    linkedin?: string | null;
    customData?: Record<string, unknown> | null;
    company: {
      id: string;
      name: string;
      industry?: string | null;
      country?: string | null;
      website?: string | null;
      size?: string | null;
      customData?: Record<string, unknown> | null;
    };
  };
  campaign: { id: string; name: string; mission: { id: string; name: string } };
  sdr?: { id: string; name: string | null } | null;
  meetingFeedback?: {
    id: string;
    outcome: string;
    recontactRequested: string;
    clientNote?: string | null;
  } | null;
  meetingType?: "VISIO" | "PHYSIQUE" | "TELEPHONIQUE" | null;
  meetingAddress?: string | null;
}

type TabId      = "upcoming" | "past" | "rescheduled" | "cancelled" | "all";
type RdvStatus  = "upcoming" | "past" | "rescheduled" | "cancelled";
type ModalType  = null | "detail" | "feedback" | "reschedule";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const getRdvStatus = (m: Meeting): RdvStatus => {
  if (m.result === "MEETING_CANCELLED") return "cancelled";
  return new Date(m.callbackDate || m.createdAt) >= new Date() ? "upcoming" : "past";
};

const getInitials = (m: Meeting) => {
  const first = m.contact?.firstName?.[0] ?? "";
  const last  = m.contact?.lastName?.[0] ?? "";
  const ini   = (first + last).toUpperCase();
  return ini || "?";
};

const AVT = [
  { bg: "#EEEDFB", fg: "#4238D0" }, { bg: "#E8F8EF", fg: "#0A6E3D" },
  { bg: "#FEF6E4", fg: "#8A4A00" }, { bg: "#EDF6FF", fg: "#0A4F8B" },
  { bg: "#FDF0FB", fg: "#7A1F72" }, { bg: "#FDE8E7", fg: "#8B1A14" },
];
const avt = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return AVT[Math.abs(h) % AVT.length];
};

const fmtFull = (s: string) => new Date(s).toLocaleDateString("fr-FR", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});
const fmtCard = (s: string) => {
  const d = new Date(s);
  return {
    day:   d.getDate(),
    month: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").toUpperCase(),
    time:  d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
};
const fmtCustomKey = (k: string) =>
  k.replace(/_/g," ").replace(/([a-z])([A-Z])/g,"$1 $2")
   .split(" ").filter(Boolean).map(w => w[0].toUpperCase()+w.slice(1)).join(" ");

/* ═══════════════════════════════════════════════════════════════
   SEMANTIC CONFIG
═══════════════════════════════════════════════════════════════ */
const S: Record<RdvStatus, {
  label: string; dot: string;
  pill: { color: string; bg: string; border: string };
  stripe: string;
}> = {
  upcoming:   { label:"À venir",  dot:tk.green,  pill:{color:tk.greenText, bg:tk.greenLight, border:"#BBF7D0"}, stripe:tk.green  },
  past:       { label:"Passé",    dot:tk.ink4,   pill:{color:tk.ink3,      bg:"#F3F4F6",     border:"#E5E7EB"}, stripe:"#CBD5E1" },
  rescheduled:{ label:"Reporté",  dot:tk.amber,  pill:{color:tk.amberText, bg:tk.amberLight, border:"#FDE68A"}, stripe:tk.amber  },
  cancelled:  { label:"Annulé",   dot:tk.red,    pill:{color:tk.redText,   bg:tk.redLight,   border:"#FECACA"}, stripe:tk.red    },
};

const OM: Record<string, { label:string; color:string; bg:string; iconBg:string }> = {
  POSITIVE: { label:"Positif",  color:tk.greenText,  bg:tk.greenLight, iconBg:tk.greenMid  },
  NEUTRAL:  { label:"Neutre",   color:tk.accentText, bg:tk.accentLight,iconBg:tk.accentMid },
  NEGATIVE: { label:"Négatif",  color:tk.redText,    bg:tk.redLight,   iconBg:tk.red       },
  NO_SHOW:  { label:"Absent",   color:tk.ink3,       bg:"#F3F4F6",     iconBg:tk.ink4      },
};

const OUTCOME_OPTS = [
  { value:"POSITIVE", label:"Positif",  Icon:ThumbsUp  },
  { value:"NEUTRAL",  label:"Neutre",   Icon:Minus     },
  { value:"NEGATIVE", label:"Négatif",  Icon:ThumbsDown},
  { value:"NO_SHOW",  label:"Absent",   Icon:XCircle   },
] as const;

const MTY = {
  VISIO:        { label:"Visioconférence",       emoji:"📹" },
  PHYSIQUE:     { label:"Rendez-vous physique",  emoji:"📍" },
  TELEPHONIQUE: { label:"Appel téléphonique",    emoji:"📞" },
};

/* ═══════════════════════════════════════════════════════════════
   EXPORT UTILS
═══════════════════════════════════════════════════════════════ */
function genICS(m: Meeting) {
  const nameParts = [m.contact?.firstName, m.contact?.lastName].filter(Boolean) as string[];
  const name = nameParts.join(" ") || "Contact inconnu";
  const dt = new Date(m.callbackDate || m.createdAt);
  const p  = (n: number) => n.toString().padStart(2,"0");
  const f  = (d: Date)   => `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
  const end = new Date(dt.getTime()+30*60000);
  const companyName = m.contact?.company?.name || "Client";
  const txt = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CaptainProspect//RDV//FR",
    "BEGIN:VEVENT",`DTSTART:${f(dt)}`,`DTEND:${f(end)}`,
    `SUMMARY:RDV - ${name} (${companyName})`,
    `DESCRIPTION:${(m.note||"").replace(/\n/g,"\\n").slice(0,200)}`,
    "END:VEVENT","END:VCALENDAR"].join("\r\n");
  const a = Object.assign(document.createElement("a"),{
    href:URL.createObjectURL(new Blob([txt],{type:"text/calendar;charset=utf-8"})),
    download:`rdv-${name.replace(/\s+/g,"-").toLowerCase()}.ics`,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

function genCSV(meetings: Meeting[]) {
  const esc = (v: string) => v.includes('"')||v.includes(",")||v.includes("\n")?`"${v.replace(/"/g,'""')}"`:v;
  const rows = meetings.map(m=>{
    const d=new Date(m.callbackDate||m.createdAt), fb=m.meetingFeedback;
    const c = m.contact;
    const co = c?.company;
    return [d.toLocaleDateString("fr-FR"),d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}),
      S[getRdvStatus(m)].label,m.campaign.mission.name,m.campaign.name,
      c?.firstName??"",c?.lastName??"",c?.title??"",c?.email??"",
      c?.phone??"",c?.linkedin??"",co?.name??"",
      co?.industry??"",co?.country??"",
      co?.size??"",co?.website??"",m.note??"",
      fb?(OM[fb.outcome]?.label??fb.outcome):"",
      fb?.recontactRequested??"",fb?.clientNote??"",
    ].map(String).map(esc);
  });
  const hdrs=["Date","Heure","Statut","Mission","Campagne","Prénom","Nom","Poste","Email","Téléphone",
    "LinkedIn","Entreprise","Secteur","Pays","Taille","Site web","Note SDR","Retour","Recontact","Commentaire"];
  const csv=[hdrs.join(","),...rows.map(r=>r.join(","))].join("\n");
  const a=Object.assign(document.createElement("a"),{
    href:URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"})),
    download:`mes-rendez-vous-${new Date().toISOString().slice(0,10)}.csv`,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

/* ═══════════════════════════════════════════════════════════════
   PRIMITIVES
═══════════════════════════════════════════════════════════════ */
function Pill({ label, color, bg, border, dot }: {
  label:string; color:string; bg:string; border?:string; dot?:string;
}) {
  return (
    <span className="cp-pill" style={{color, background:bg, borderColor:border??bg}}>
      {dot && <span style={{width:5,height:5,borderRadius:"50%",background:dot,display:"inline-block"}} />}
      {label}
    </span>
  );
}

function Avt({ m, size=38 }: { m:Meeting; size?:number }) {
  const s = avt(m.contact?.id || m.id);
  return (
    <div className="cp-avatar" style={{width:size,height:size,background:s.bg,color:s.fg,fontSize:size*0.34}}
      aria-hidden="true">
      {getInitials(m)}
    </div>
  );
}

type BV = "primary"|"secondary"|"danger"|"ghost";
function Btn({ children, onClick, disabled, loading, variant="secondary", type="button" }: {
  children:React.ReactNode; onClick?:()=>void; disabled?:boolean;
  loading?:boolean; variant?:BV; type?:"button"|"submit";
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled||loading}
      className={`cp-btn cp-btn-${variant}`}>
      {loading && <Loader2 style={{width:14,height:14,animation:"cp-spin 0.8s linear infinite"}} />}
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MODAL SHELL
═══════════════════════════════════════════════════════════════ */
function Modal({ children, onClose, title, subtitle, wide, footer }: {
  children:React.ReactNode; onClose:()=>void; title:string;
  subtitle?:string; wide?:boolean; footer?:React.ReactNode;
}) {
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==="Escape") onClose(); };
    document.addEventListener("keydown",h);
    document.body.style.overflow="hidden";
    return ()=>{ document.removeEventListener("keydown",h); document.body.style.overflow=""; };
  },[onClose]);

  return (
    <div className="cp-overlay" role="dialog" aria-modal="true" aria-label={title}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="cp-modal" style={{maxWidth:wide?760:520}}>
        <div className="cp-modal-header">
          <div>
            <h2 className="cp-modal-title">{title}</h2>
            {subtitle && <p className="cp-modal-sub">{subtitle}</p>}
          </div>
          <button className="cp-modal-close" onClick={onClose} aria-label="Fermer">
            <X style={{width:13,height:13}} />
          </button>
        </div>
        <div className="cp-modal-body">{children}</div>
        {footer && <div className="cp-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

function Sec({ children, label, last }: { children:React.ReactNode; label?:string; last?:boolean }) {
  return (
    <div className={cn("cp-section", !last && "border-b")} style={!last?{borderBottomColor:tk.border}:{}}>
      {label && <div className="cp-section-label">{label}</div>}
      {children}
    </div>
  );
}

function Fld({ label, children }: { label:string; children?:React.ReactNode }) {
  return (
    <div className="cp-field">
      <span className="cp-field-lbl">{label}</span>
      {children
        ? <span className="cp-field-val">{children}</span>
        : <span className="cp-field-nil">—</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function ClientPortalMeetingsPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const clientId = (session?.user as { clientId?: string })?.clientId;

  const [meetings, setMeetings]   = useState<Meeting[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<TabId>("upcoming");
  const [q, setQ]                 = useState("");

  const [modal, setModal]         = useState<ModalType>(null);
  const [sel, setSel]             = useState<Meeting|null>(null);

  const [fbOut, setFbOut]         = useState("");
  const [fbRec, setFbRec]         = useState("");
  const [fbNote, setFbNote]       = useState("");
  const [fbSub, setFbSub]         = useState(false);
  const [fbDone, setFbDone]       = useState(false);

  const [rsDate, setRsDate]       = useState("");
  const [rsTime, setRsTime]       = useState("10:00");
  const [rsReason, setRsReason]   = useState("");
  const [rsSub, setRsSub]         = useState(false);

  const [sigId, setSigId]         = useState<string|null>(null);
  const [sigType, setSigType]     = useState<"NO_SHOW"|"CANCEL"|null>(null);
  const [sigRec, setSigRec]       = useState("");
  const [sigNote, setSigNote]     = useState("");
  const [sigSub, setSigSub]       = useState(false);

  useEffect(()=>{
    if (!clientId) return;
    (async()=>{
      setLoading(true);
      try {
        const res = await fetch(`/api/clients/${clientId}/meetings`);
        const json = await res.json();
        if (json.success && json.data) setMeetings(json.data.allMeetings??[]);
      } catch(e){ console.error(e); }
      finally { setLoading(false); }
    })();
  },[clientId]);

  const stats = useMemo(()=>{
    const s = {upcoming:0,past:0,rescheduled:0,cancelled:0,all:meetings.length};
    meetings.forEach(m=>{ s[getRdvStatus(m)]++; });
    return s;
  },[meetings]);

  const filtered = useMemo(()=>{
    let list = tab==="all" ? meetings : meetings.filter(m=>getRdvStatus(m)===tab);
    if (q.trim()) {
      const lq = q.toLowerCase();
      list = list.filter(m=>{
        const c = m.contact;
        const co = c?.company;
        const haystack = [
          c?.firstName,
          c?.lastName,
          co?.name,
          m.campaign?.name,
          m.campaign?.mission?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(lq);
      });
    }
    return list.sort((a,b)=>{
      const da=new Date(a.callbackDate||a.createdAt).getTime();
      const db=new Date(b.callbackDate||b.createdAt).getTime();
      return tab==="upcoming" ? da-db : db-da;
    });
  },[meetings,tab,q]);

  useEffect(()=>{
    if (!loading && stats.upcoming===0 && stats.past>0 && tab==="upcoming") setTab("past");
  },[loading,stats,tab]);

  const openModal = (m:Meeting, t:ModalType) => {
    setSel(m);
    if (t==="feedback"){ setFbOut(m.meetingFeedback?.outcome??""); setFbRec(m.meetingFeedback?.recontactRequested??""); setFbNote(m.meetingFeedback?.clientNote??""); setFbDone(false); }
    if (t==="reschedule"){ setRsDate(""); setRsTime("10:00"); setRsReason(""); }
    setModal(t);
  };
  const closeModal = useCallback(()=>setModal(null),[]);

  const submitFeedback = async ()=>{
    if (!sel||!fbOut||!fbRec) return;
    setFbSub(true);
    try {
      const r = await fetch(`/api/client/meetings/${sel.id}/feedback`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({outcome:fbOut,recontactRequested:fbRec,clientNote:fbNote||null}),
      });
      const j=await r.json();
      if (j.success){ setFbDone(true); setMeetings(p=>p.map(m=>m.id===sel.id?{...m,meetingFeedback:j.data}:m)); toast.success("Retour enregistré","Votre avis a été transmis à l'équipe."); setTimeout(closeModal,1400); }
      else toast.error("Erreur",j.error??"Une erreur est survenue.");
    } catch { toast.error("Erreur","Impossible de soumettre votre retour."); }
    finally { setFbSub(false); }
  };

  const submitReschedule = async ()=>{
    if (!sel||!rsDate) return;
    setRsSub(true);
    try {
      const r=await fetch(`/api/client/meetings/${sel.id}/reschedule`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({newDate:`${rsDate}T${rsTime}:00`,reason:rsReason||null}),
      });
      const j=await r.json();
      if (j.success){ toast.success("Demande envoyée","L'équipe vous recontactera pour confirmer."); closeModal(); }
      else toast.error("Erreur",j.error??"Impossible d'envoyer la demande.");
    } catch { toast.error("Erreur","Impossible d'envoyer la demande."); }
    finally { setRsSub(false); }
  };

  const submitSignal = async (mid:string)=>{
    if (!sigType) return;
    if (sigType==="NO_SHOW"&&!sigRec) return;
    if (sigType==="CANCEL"&&!sigNote) return;
    setSigSub(true);
    try {
      const r=await fetch(`/api/client/meetings/${mid}/feedback`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          // Map to allowed outcome codes for API:
          // - NO_SHOW  -> "NO_SHOW"
          // - CANCEL   -> "NEGATIVE" (annulé par le client)
          outcome:sigType==="NO_SHOW"?"NO_SHOW":"NEGATIVE",
          recontactRequested:sigType==="NO_SHOW"?sigRec:"NO",
          clientNote:sigNote||null,
        }),
      });
      const j=await r.json();
      if (j.success){
        setMeetings(p=>p.map(m=>m.id===mid?{...m,meetingFeedback:j.data,...(sigType==="CANCEL"?{result:"MEETING_CANCELLED",cancellationReason:"CLIENT_REQUEST"}:{})}:m));
        toast.success("Signalement envoyé",sigType==="NO_SHOW"?"Marqué comme absent.":"Annulation signalée.");
        setSigId(null);
      } else toast.error("Erreur",j.error??"Une erreur est survenue.");
    } catch { toast.error("Erreur","Impossible de soumettre."); }
    finally { setSigSub(false); }
  };

  const toggleSig=(id:string)=>{
    setSigId(sigId===id?null:id);
    setSigType(null); setSigRec(""); setSigNote("");
  };

  if (!clientId||loading) return <MeetingsSkeleton />;

  const STAT_CFG=[
    {key:"upcoming"   as const, label:"À venir",  stripe:tk.green  },
    {key:"past"       as const, label:"Passés",   stripe:"#CBD5E1" },
    {key:"rescheduled"as const, label:"Reportés", stripe:tk.amber  },
    {key:"cancelled"  as const, label:"Annulés",  stripe:tk.red    },
  ];

  const TABS: {id:TabId; label:string}[] = [
    {id:"all",label:"Tous"},{id:"upcoming",label:"À venir"},
    {id:"past",label:"Passés"},{id:"rescheduled",label:"Reportés"},
    {id:"cancelled",label:"Annulés"},
  ];

  return (
    <div className="cp-page" style={{minHeight:"100%",background:tk.bg,padding:"28px 28px 56px"}}>
      <style dangerouslySetInnerHTML={{__html:GLOBAL_CSS}} />

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="cp-enter" style={{display:"flex",flexWrap:"wrap",alignItems:"flex-start",justifyContent:"space-between",gap:16,marginBottom:32}}>
        <div>
          <h1 style={{fontFamily:"'Instrument Serif',Georgia,serif",fontStyle:"italic",fontSize:32,fontWeight:400,color:tk.ink,letterSpacing:"-0.025em",margin:0,lineHeight:1.15}}>
            Mes rendez-vous
          </h1>
          <p style={{fontSize:13.5,color:tk.ink3,marginTop:6,lineHeight:1.5}}>
            Consultez vos rendez-vous, donnez votre avis, demandez un report.
          </p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div className="cp-search" style={{width:260}}>
            <Search className="cp-search-ico" style={{width:15,height:15}} />
            <input className="cp-input" type="search" placeholder="Contact, entreprise…" value={q} onChange={e=>setQ(e.target.value)} aria-label="Rechercher" />
            {q && <button className="cp-search-clr" onClick={()=>setQ("")} aria-label="Effacer"><X style={{width:13,height:13}} /></button>}
          </div>
          <button className="cp-btn cp-btn-secondary" style={{gap:7,padding:"0 14px"}} onClick={()=>genCSV(filtered)}>
            <FileSpreadsheet style={{width:15,height:15}} />Exporter
          </button>
        </div>
      </header>

      {/* ── Stats ──────────────────────────────────────────── */}
      <div className="cp-enter" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24,animationDelay:"0.05s"}}>
        {STAT_CFG.map(({key,label,stripe})=>{
          const active=tab===key;
          return (
            <button key={key} type="button" onClick={()=>setTab(key)} aria-pressed={active}
              className="cp-stat"
              style={{
                border:`1px solid ${active?stripe+"30":tk.border}`,
                background: active?`linear-gradient(135deg,${stripe}08,${stripe}04)`:tk.surface,
                boxShadow: active?`0 4px 20px -6px ${stripe}35`:"none",
              }}>
              <div style={{width:3,height:38,borderRadius:2,background:stripe,opacity:active?1:0.3,flexShrink:0,transition:"opacity 0.2s ease"}} />
              <div>
                <div style={{fontSize:30,fontWeight:800,color:active?stripe:tk.ink,lineHeight:1,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.04em",animation:"cp-count-in 0.4s ease"}}>
                  {stats[key]}
                </div>
                <div style={{fontSize:11.5,color:tk.ink3,marginTop:3,fontWeight:500}}>{label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className="cp-enter" style={{display:"flex",gap:2,padding:4,background:"rgba(0,0,0,0.04)",borderRadius:14,width:"fit-content",marginBottom:24,animationDelay:"0.09s"}}
        role="tablist" aria-label="Filtrer les rendez-vous">
        {TABS.map(t=>{
          const active=tab===t.id;
          const count=t.id==="all"?stats.all:stats[t.id as RdvStatus]??0;
          return (
            <button key={t.id} role="tab" aria-selected={active} type="button" onClick={()=>setTab(t.id)}
              className={cn("cp-tab",active&&"active")}>
              {t.label}
              <span className="cp-tab-badge" style={{background:active?tk.accentLight:"rgba(0,0,0,0.08)",color:active?tk.accentText:tk.ink4}}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── List ───────────────────────────────────────────── */}
      {filtered.length===0 ? (
        <div className="cp-empty cp-enter-fade" style={{animationDelay:"0.1s"}}>
          <Calendar style={{width:40,height:40,color:tk.ink4,marginBottom:12}} />
          <p style={{fontSize:15,fontWeight:600,color:tk.ink2,margin:0}}>
            {q?"Aucun résultat pour cette recherche":"Aucun rendez-vous dans cette catégorie"}
          </p>
          <p style={{fontSize:13,color:tk.ink4,marginTop:6}}>
            {tab==="upcoming"?"Vos prochains rendez-vous apparaîtront ici.":"Essayez un autre filtre."}
          </p>
        </div>
      ) : (
        <ul style={{display:"flex",flexDirection:"column",gap:10,listStyle:"none",margin:0,padding:0}}>
          {filtered.map((meeting,idx)=>(
            <Card key={meeting.id} m={meeting} idx={idx}
              sigOpen={sigId===meeting.id} sigType={sigType}
              sigRec={sigRec} sigNote={sigNote} sigSub={sigSub}
              onDetail={()=>openModal(meeting,"detail")}
              onFeedback={()=>openModal(meeting,"feedback")}
              onICS={()=>genICS(meeting)}
              onToggleSig={()=>toggleSig(meeting.id)}
              onSigType={setSigType} onSigRec={setSigRec} onSigNote={setSigNote}
              onSigSubmit={()=>submitSignal(meeting.id)}
            />
          ))}
        </ul>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
      {modal==="detail" && sel && (
        <DetailModal m={sel} onClose={closeModal}
          onFeedback={()=>openModal(sel,"feedback")}
          onICS={()=>genICS(sel)}
        />
      )}
      {modal==="feedback" && sel && (
        <FbModal m={sel} onClose={closeModal}
          out={fbOut} rec={fbRec} note={fbNote} done={fbDone} sub={fbSub}
          onOut={setFbOut} onRec={setFbRec} onNote={setFbNote} onSubmit={submitFeedback}
        />
      )}
      {modal==="reschedule" && sel && (
        <RsModal m={sel} onClose={closeModal}
          date={rsDate} time={rsTime} reason={rsReason} sub={rsSub}
          onDate={setRsDate} onTime={setRsTime} onReason={setRsReason} onSubmit={submitReschedule}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MEETING CARD
═══════════════════════════════════════════════════════════════ */
function Card({
  m, idx, sigOpen, sigType, sigRec, sigNote, sigSub,
  onDetail, onFeedback, onICS, onToggleSig,
  onSigType, onSigRec, onSigNote, onSigSubmit,
}: {
  m:Meeting; idx:number; sigOpen:boolean; sigType:"NO_SHOW"|"CANCEL"|null;
  sigRec:string; sigNote:string; sigSub:boolean;
  onDetail:()=>void; onFeedback:()=>void; onICS:()=>void; onToggleSig:()=>void;
  onSigType:(t:"NO_SHOW"|"CANCEL"|null)=>void;
  onSigRec:(v:string)=>void; onSigNote:(v:string)=>void; onSigSubmit:()=>void;
}) {
  const st     = getRdvStatus(m);
  const sm     = S[st];
  const fb     = m.meetingFeedback;
  const up     = st==="upcoming";
  const dt     = fmtCard(m.callbackDate||m.createdAt);
  const sigDis = sigSub||(sigType==="NO_SHOW"&&!sigRec)||(sigType==="CANCEL"&&!sigNote);

  return (
    <li className={cn("cp-card cp-enter", up&&"cp-card-upcoming")}
      style={{animationDelay:`${idx*0.04}s`,opacity:st==="cancelled"?0.72:1}}>
      {/* Status stripe top */}
      <div style={{height:3,background:sm.stripe,width:"100%",animation:"cp-stripe-in 0.4s ease"}} aria-hidden="true" />

      <div style={{display:"flex"}}>
        {/* Date column */}
        <div className="cp-date-block">
          <span style={{fontSize:30,fontWeight:800,color:tk.ink,lineHeight:1,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.04em"}}>
            {dt.day}
          </span>
          <span style={{fontSize:10,fontWeight:700,color:tk.ink4,letterSpacing:"0.1em",marginTop:3}}>
            {dt.month}
          </span>
          <div style={{marginTop:10,fontSize:11.5,fontWeight:700,color:tk.accentText,background:tk.accentLight,padding:"3px 7px",borderRadius:99,whiteSpace:"nowrap"}}>
            {dt.time}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,padding:"14px 16px",display:"flex",flexDirection:"column",gap:9,minWidth:0}}>
          {/* Badges */}
          <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:5}}>
            <Pill label={sm.label} color={sm.pill.color} bg={sm.pill.bg} border={sm.pill.border} dot={sm.dot} />
            {m.meetingType && (
              <Pill label={`${MTY[m.meetingType].emoji} ${MTY[m.meetingType].label}`} color={tk.ink3} bg="#F3F4F6" border="rgba(0,0,0,0.07)" />
            )}
            <Pill label={m.campaign.mission.name} color={tk.accentText} bg={tk.accentLight} border="rgba(91,79,232,0.18)" />
            <span style={{fontSize:11.5,color:tk.ink4}}>{m.campaign.name}</span>
          </div>

          {/* Contact */}
          <div style={{display:"flex",alignItems:"flex-start",gap:11}}>
            <Avt m={m} />
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",flexWrap:"wrap",alignItems:"baseline",gap:"2px 7px"}}>
                <span style={{fontSize:14.5,fontWeight:700,color:tk.ink}}>
                  {[m.contact?.firstName, m.contact?.lastName].filter(Boolean).join(" ") || "Contact inconnu"}
                </span>
                {m.contact?.title && <span style={{fontSize:12,color:tk.ink3}}>{m.contact.title}</span>}
              </div>
              <div style={{fontSize:12.5,fontWeight:600,color:tk.ink2,marginTop:2,display:"flex",alignItems:"center",gap:5}}>
                <Building2 style={{width:12,height:12,color:tk.ink4,flexShrink:0}} aria-hidden="true" />
                {m.contact?.company?.name || "Entreprise inconnue"}
                {m.contact?.company?.industry && <span style={{fontWeight:400,color:tk.ink3}}>· {m.contact.company.industry}</span>}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"3px 12px",marginTop:6}}>
                {m.contact?.email   && <a href={`mailto:${m.contact.email}`}  className="cp-link" onClick={e=>e.stopPropagation()}><Mail   style={{width:11,height:11}} />{m.contact.email}</a>}
                {m.contact?.phone   && <a href={`tel:${m.contact.phone}`}     className="cp-link" onClick={e=>e.stopPropagation()}><Phone  style={{width:11,height:11}} />{m.contact.phone}</a>}
                {m.contact?.linkedin&& <a href={m.contact.linkedin} target="_blank" rel="noopener noreferrer" className="cp-link" onClick={e=>e.stopPropagation()}><Linkedin style={{width:11,height:11}} />LinkedIn</a>}
              </div>
            </div>
          </div>

          {/* SDR note */}
          {m.note && (
            <div className="cp-note-quote">
              <div style={{fontSize:9.5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:tk.ink4,fontStyle:"normal",marginBottom:4}}>
                Note{m.sdr?.name?` · ${m.sdr.name}`:""}
              </div>
              &ldquo;{m.note}&rdquo;
            </div>
          )}

          {/* Feedback badge */}
          {fb && (
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <span style={{fontSize:11.5,color:tk.ink4}}>Votre avis :</span>
              <Pill label={OM[fb.outcome]?.label??fb.outcome} color={OM[fb.outcome]?.color??tk.ink3} bg={OM[fb.outcome]?.bg??"#F3F4F6"} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{width:152,flexShrink:0,display:"flex",flexDirection:"column",justifyContent:"center",gap:6,padding:"14px 12px",borderLeft:`1px solid ${tk.border}`}}>
          <button type="button" className="cp-action" onClick={onDetail}>
            <Eye style={{width:12,height:12}} />Voir la fiche
          </button>
          {up && (
            <button type="button" className="cp-action" onClick={onICS}>
              <Download style={{width:12,height:12}} />Calendrier
            </button>
          )}
          {!up && !fb && (
            <>
              <button type="button" className="cp-action prim" onClick={onFeedback}>
                <MessageSquare style={{width:12,height:12}} />Donner mon avis
              </button>
              <button type="button" className="cp-action dngr" onClick={onToggleSig} aria-expanded={sigOpen}>
                <AlertTriangle style={{width:12,height:12}} />Signaler
              </button>
            </>
          )}
          {fb && (
            <button type="button" className="cp-action" onClick={onFeedback}>
              <Edit3 style={{width:12,height:12}} />Modifier l&apos;avis
            </button>
          )}
        </div>
      </div>

      {/* ── Signal panel ─────────────────────────────────── */}
      {sigOpen && !up && !fb && (
        <div className="cp-signal">
          <div className="cp-signal-inner">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:tk.redLight,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <AlertTriangle style={{width:15,height:15,color:tk.red}} />
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:tk.redText}}>Signaler un problème</div>
                <div style={{fontSize:11.5,color:"#C08080",marginTop:1}}>
                  Indiquez ce qui s&apos;est passé — l&apos;équipe prendra en charge.
                </div>
              </div>
              <button type="button" onClick={onToggleSig} aria-label="Fermer"
                style={{width:26,height:26,border:"none",background:"rgba(217,48,37,0.08)",borderRadius:7,color:tk.redText,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <X style={{width:12,height:12}} />
              </button>
            </div>

            {/* Type */}
            <div style={{display:"flex",gap:10,marginBottom:sigType?16:0}}>
              {([
                {id:"NO_SHOW" as const, label:"Contact absent",         Icon:XCircle},
                {id:"CANCEL"  as const, label:"Annuler définitivement", Icon:X},
              ] as const).map(({id,label,Icon})=>(
                <button key={id} type="button" aria-pressed={sigType===id}
                  onClick={()=>onSigType(id)}
                  className={cn("cp-choice",sigType===id&&"sel")}>
                  <div className="cp-choice-ico"><Icon style={{width:16,height:16}} /></div>
                  {label}
                </button>
              ))}
            </div>

            {sigType && (
              <div className="cp-signal-form" style={{display:"flex",flexDirection:"column",gap:12}}>
                {sigType==="NO_SHOW" && (
                  <div>
                    <div style={{fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:tk.ink4,marginBottom:8}}>
                      Recontacter ce prospect ? <span style={{color:tk.red}}>*</span>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      {[{v:"YES",l:"Oui, recontacter"},{v:"NO",l:"Non, clôturer"}].map(({v,l})=>(
                        <button key={v} type="button" aria-pressed={sigRec===v} onClick={()=>onSigRec(v)}
                          className={cn("cp-toggle",sigRec===v&&"sel")} style={{flex:1}}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:tk.ink4,marginBottom:8}}>
                    Commentaire
                    {sigType==="CANCEL"
                      ? <span style={{color:tk.red}}> *</span>
                      : <span style={{color:tk.ink4,textTransform:"none",fontWeight:400}}> (optionnel)</span>}
                  </div>
                  <input className="cp-input" type="text" value={sigNote} onChange={e=>onSigNote(e.target.value)} placeholder="Précisez la raison…" />
                </div>
                <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                  <Btn variant="ghost" onClick={()=>onSigType(null)}>Annuler</Btn>
                  <Btn variant="danger" onClick={onSigSubmit} disabled={sigDis} loading={sigSub}>
                    <Send style={{width:13,height:13}} />Confirmer le signalement
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DETAIL MODAL
═══════════════════════════════════════════════════════════════ */
function DetailModal({ m, onClose, onFeedback, onICS }: {
  m:Meeting; onClose:()=>void; onFeedback:()=>void; onICS:()=>void;
}) {
  const st = getRdvStatus(m);
  const sm = S[st];
  const fb = m.meetingFeedback;
  const up = st==="upcoming";
  const cn_name = [m.contact?.firstName,m.contact?.lastName].filter(Boolean).join(" ") || "Contact inconnu";
  const companyName = m.contact?.company?.name || "Entreprise inconnue";

  return (
    <Modal wide title="Fiche du rendez-vous" subtitle={`${cn_name} · ${companyName}`} onClose={onClose}
      footer={<>
        {up && <Btn variant="secondary" onClick={onICS}><Download style={{width:14,height:14}} />Ajouter au calendrier</Btn>}
        {!up && !fb && <Btn variant="primary" onClick={onFeedback}><MessageSquare style={{width:14,height:14}} />Donner mon avis</Btn>}
        {fb && <Btn variant="secondary" onClick={onFeedback}><Edit3 style={{width:14,height:14}} />Modifier mon avis</Btn>}
        <Btn onClick={onClose}>Fermer</Btn>
      </>}>

      {/* Status + date */}
      <Sec>
        <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:10,marginBottom:m.cancellationReason||m.meetingType?"12px":0}}>
          <div style={{width:38,height:38,borderRadius:10,background:sm.pill.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Calendar style={{width:17,height:17,color:sm.dot}} />
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:tk.ink}}>{fmtFull(m.callbackDate||m.createdAt)}</div>
            <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:6,marginTop:4}}>
              <Pill label={sm.label} color={sm.pill.color} bg={sm.pill.bg} border={sm.pill.border} dot={sm.dot} />
              {m.meetingType && <span style={{fontSize:12,color:tk.ink3}}>{MTY[m.meetingType].emoji} {MTY[m.meetingType].label}</span>}
            </div>
          </div>
        </div>
        {m.cancellationReason && (
          <div style={{padding:"10px 14px",background:tk.redLight,border:"1px solid rgba(217,48,37,0.15)",borderRadius:10,fontSize:12.5,color:tk.redText,fontStyle:"italic"}}>
            Motif d&apos;annulation : {getMeetingCancellationLabel(m.cancellationReason)}
          </div>
        )}
        {m.meetingType==="PHYSIQUE" && m.meetingAddress && (
          <div style={{marginTop:10,display:"flex",alignItems:"center",gap:7,fontSize:13,color:tk.ink2}}>
            <MapPin style={{width:14,height:14,color:tk.ink4,flexShrink:0}} />
            <span>{m.meetingAddress}</span>
            <a href={`https://maps.google.com/?q=${encodeURIComponent(m.meetingAddress)}`} target="_blank" rel="noopener noreferrer"
              style={{fontSize:12,color:tk.accentText,textDecoration:"none",marginLeft:2}}>Itinéraire →</a>
          </div>
        )}
        {m.meetingType==="TELEPHONIQUE" && m.contact?.phone && (
          <div style={{marginTop:10}}>
            <a href={`tel:${m.contact.phone}`} className="cp-btn cp-btn-secondary" style={{display:"inline-flex",textDecoration:"none"}}>
              <Phone style={{width:14,height:14}} />Appeler {m.contact.phone}
            </a>
          </div>
        )}
      </Sec>

      {/* Contact + Company */}
      <Sec label="Coordonnées">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px 28px"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:16}}>
              <Avt m={m} size={44} />
              <div>
                <div style={{fontSize:15,fontWeight:700,color:tk.ink}}>{cn_name}</div>
                <div style={{fontSize:12.5,color:tk.ink3,marginTop:2}}>{m.contact?.title||<span style={{color:tk.ink4}}>—</span>}</div>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              <Fld label="E-mail">{m.contact?.email&&<a href={`mailto:${m.contact.email}`} style={{color:tk.accentText,textDecoration:"none"}}>{m.contact.email}</a>}</Fld>
              <Fld label="Téléphone">{m.contact?.phone&&<a href={`tel:${m.contact.phone}`} style={{color:tk.accentText,textDecoration:"none"}}>{m.contact.phone}</a>}</Fld>
              <Fld label="LinkedIn">{m.contact?.linkedin&&<a href={m.contact.linkedin} target="_blank" rel="noopener noreferrer" style={{color:tk.accentText,textDecoration:"none"}}>Voir le profil →</a>}</Fld>
            </div>
          </div>
          <div style={{borderLeft:`1px solid ${tk.border}`,paddingLeft:24}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,fontSize:15,fontWeight:700,color:tk.ink}}>
              <Building2 style={{width:16,height:16,color:tk.ink4,flexShrink:0}} />{companyName}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              <Fld label="Secteur">{m.contact?.company?.industry}</Fld>
              <Fld label="Pays">{m.contact?.company?.country}</Fld>
              <Fld label="Effectif">{m.contact?.company?.size}</Fld>
              <Fld label="Site web">{m.contact?.company?.website&&<a href={m.contact.company.website} target="_blank" rel="noopener noreferrer" style={{color:tk.accentText,textDecoration:"none"}}>{m.contact.company.website.replace(/^https?:\/\//,"")}</a>}</Fld>
            </div>
          </div>
        </div>
        {m.contact?.customData && Object.keys(m.contact.customData).length>0 && (
          <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${tk.border}`}}>
            <div className="cp-section-label" style={{marginBottom:8}}>Données complémentaires</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {Object.entries(m.contact.customData as Record<string,unknown>).map(([k,v])=>v?(
                <span key={k} style={{display:"inline-flex",gap:4,padding:"3px 9px",borderRadius:8,background:"#F3F4F6",border:`1px solid ${tk.border}`,fontSize:12,color:tk.ink2}}>
                  <span style={{color:tk.ink4}}>{fmtCustomKey(k)}:</span>
                  <span style={{fontWeight:600}}>{String(v)}</span>
                </span>
              ):null)}
            </div>
          </div>
        )}
      </Sec>

      {/* SDR note */}
      {m.note && (
        <Sec label={`Note du commercial${m.sdr?.name?` · ${m.sdr.name}`:""}`}>
          <div className="cp-note-quote">&ldquo;{m.note}&rdquo;</div>
        </Sec>
      )}

      {/* AI summary */}
      {m.voipSummary && (
        <Sec label="Résumé de l'appel (IA)">
          <div className="cp-ai-summary">
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:tk.accentText}}>
              <Sparkles style={{width:11,height:11}} />IA · Résumé automatique
            </div>
            {m.voipSummary}
          </div>
        </Sec>
      )}

      {/* Feedback */}
      {fb && (
        <Sec label="Votre retour" last>
          <div style={{padding:16,borderRadius:12,background:tk.greenLight,border:"1px solid rgba(18,160,92,0.2)"}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:fb.clientNote?10:0}}>
              <Pill label={OM[fb.outcome]?.label??fb.outcome} color={OM[fb.outcome]?.color??tk.ink3} bg={OM[fb.outcome]?.bg??"#F3F4F6"} />
              <Pill label={`Recontact : ${fb.recontactRequested==="YES"?"Oui":fb.recontactRequested==="NO"?"Non":"À rediscuter"}`} color={tk.ink3} bg="#F3F4F6" />
            </div>
            {fb.clientNote && <p style={{fontSize:13,fontStyle:"italic",color:tk.greenText,margin:0,lineHeight:1.6}}>&ldquo;{fb.clientNote}&rdquo;</p>}
          </div>
        </Sec>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FEEDBACK MODAL
═══════════════════════════════════════════════════════════════ */
function FbModal({ m, onClose, out, rec, note, done, sub, onOut, onRec, onNote, onSubmit }: {
  m:Meeting; onClose:()=>void;
  out:string; rec:string; note:string; done:boolean; sub:boolean;
  onOut:(v:string)=>void; onRec:(v:string)=>void; onNote:(v:string)=>void; onSubmit:()=>void;
}) {
  const name=[m.contact?.firstName,m.contact?.lastName].filter(Boolean).join(" ") || "Contact inconnu";
  const companyName = m.contact?.company?.name || "Entreprise inconnue";

  if (done) return (
    <Modal title="Retour enregistré" onClose={onClose}
      footer={<Btn variant="primary" onClick={onClose}>Fermer</Btn>}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"56px 32px",textAlign:"center"}}>
        <div className="cp-done-ico"><Check style={{width:28,height:28,color:tk.green}} /></div>
        <h3 style={{fontFamily:"'Instrument Serif',Georgia,serif",fontStyle:"italic",fontSize:22,fontWeight:400,color:tk.ink,margin:"0 0 8px"}}>
          Merci pour votre retour
        </h3>
        <p style={{fontSize:13.5,color:tk.ink3,maxWidth:280,lineHeight:1.6,margin:0}}>
          Votre avis a été transmis à votre équipe CaptainProspect.
        </p>
      </div>
    </Modal>
  );

  return (
    <Modal title="Feedback sur le rendez-vous" subtitle={`${name} · ${companyName}`} onClose={onClose}
      footer={<>
        <span style={{fontSize:11,color:tk.ink4,marginRight:"auto"}}>* champs requis</span>
        <Btn onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" onClick={onSubmit} disabled={!out||!rec} loading={sub}>
          <Send style={{width:13,height:13}} />Envoyer mon avis
        </Btn>
      </>}>

      <Sec label="Comment s'est passé ce rendez-vous ? *">
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {OUTCOME_OPTS.map(({value,label,Icon})=>{
            const sel=out===value; const meta=OM[value];
            return (
              <button key={value} type="button" aria-pressed={sel} onClick={()=>onOut(value)}
                className={cn("cp-outcome",sel&&"sel")}
                style={{borderColor:sel?meta.color:tk.border,background:sel?meta.bg:tk.surface,color:sel?meta.color:tk.ink3,boxShadow:sel?`0 6px 20px -4px ${meta.color}40`:"none"}}>
                <div className="cp-outcome-ico" style={{background:sel?meta.iconBg:"#F3F4F6",color:sel?"#fff":tk.ink4}}>
                  <Icon style={{width:17,height:17}} />
                </div>
                {label}
              </button>
            );
          })}
        </div>
      </Sec>

      <Sec label="Souhaitez-vous que l'on recontacte ce prospect ? *">
        <div style={{display:"flex",gap:10}}>
          {[{v:"YES",l:"Oui, à recontacter"},{v:"NO",l:"Non merci"},{v:"MAYBE",l:"À rediscuter"}].map(({v,l})=>(
            <button key={v} type="button" aria-pressed={rec===v} onClick={()=>onRec(v)}
              className={cn("cp-recontact",rec===v&&"sel")}>
              {l}
            </button>
          ))}
        </div>
      </Sec>

      <Sec label="Commentaire" last>
        <textarea className="cp-textarea" value={note} onChange={e=>onNote(e.target.value)} rows={4}
          placeholder="Points clés abordés, impressions, prochaines étapes…"
          style={{minHeight:100}} />
        <p style={{fontSize:11,color:tk.ink4,marginTop:8}}>Visible uniquement par votre équipe CaptainProspect.</p>
      </Sec>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RESCHEDULE MODAL
═══════════════════════════════════════════════════════════════ */
function RsModal({ m, onClose, date, time, reason, sub, onDate, onTime, onReason, onSubmit }: {
  m:Meeting; onClose:()=>void;
  date:string; time:string; reason:string; sub:boolean;
  onDate:(v:string)=>void; onTime:(v:string)=>void; onReason:(v:string)=>void; onSubmit:()=>void;
}) {
  const name=[m.contact?.firstName,m.contact?.lastName].filter(Boolean).join(" ") || "Contact inconnu";
  const companyName = m.contact?.company?.name || "Entreprise inconnue";
  const tmrw=new Date(); tmrw.setDate(tmrw.getDate()+1);
  const minDate=tmrw.toISOString().split("T")[0];

  return (
    <Modal title="Demander un report" subtitle={`${name} · ${companyName}`} onClose={onClose}
      footer={<>
        <Btn onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" onClick={onSubmit} disabled={!date} loading={sub}>
          <CalendarClock style={{width:14,height:14}} />Envoyer la demande
        </Btn>
      </>}>

      <Sec>
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"#F7F8FF",borderRadius:12,border:"1px solid rgba(91,79,232,0.1)"}}>
          <div style={{width:40,height:40,borderRadius:12,background:tk.accentLight,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Calendar style={{width:17,height:17,color:tk.accentText}} />
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:tk.ink4}}>Date actuelle</div>
            <div style={{fontSize:14,fontWeight:600,color:tk.ink,marginTop:2}}>{fmtFull(m.callbackDate||m.createdAt)}</div>
          </div>
        </div>
      </Sec>

      <Sec label="Nouvelle date souhaitée *">
        <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
          <div style={{flex:1,minWidth:180}}>
            <DatePicker value={date} onChange={onDate} placeholder="Sélectionner une date" minDate={minDate} />
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:tk.ink4,marginBottom:8}}>Horaire</div>
            <input type="time" value={time} onChange={e=>onTime(e.target.value)} className="cp-input" style={{width:130}} />
          </div>
        </div>
      </Sec>

      <Sec label="Motif" last>
        <textarea className="cp-textarea" value={reason} onChange={e=>onReason(e.target.value)} rows={3}
          placeholder="Indisponibilité, changement de priorité…"
          style={{minHeight:80}} />
        <p style={{fontSize:11,color:tk.ink4,marginTop:8}}>L&apos;équipe vous recontactera pour confirmer le nouveau créneau.</p>
      </Sec>
    </Modal>
  );
}