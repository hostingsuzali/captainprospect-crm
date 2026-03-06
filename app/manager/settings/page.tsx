"use client";

import { useEffect, useState, useRef } from "react";
import {
  Mail, RotateCcw, Save, Eye, Info,
  CheckCircle2, AlertCircle, Sparkles, Code2,
  ChevronRight, Zap, Variable
} from "lucide-react";
import { RDV_TEMPLATE_VARIABLES } from "@/lib/email/templates/rdv-notification";

// ============================================
// TYPES
// ============================================

interface TemplateData {
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  isCustomized: boolean;
  defaultSubject: string;
  defaultBodyHtml: string;
}

// ============================================
// TOAST
// ============================================

function Toast({ saved, error }: { saved: boolean; error: string | null }) {
  if (!saved && !error) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium backdrop-blur-sm transition-all duration-300 ${
        error
          ? "bg-red-50/90 border border-red-200 text-red-700"
          : "bg-emerald-50/90 border border-emerald-200 text-emerald-700"
      }`}
      style={{ animation: "slideUp 0.3s ease" }}
    >
      {error ? (
        <><AlertCircle className="w-4 h-4 shrink-0" />{error}</>
      ) : (
        <><CheckCircle2 className="w-4 h-4 shrink-0" />Template sauvegardé avec succès</>
      )}
    </div>
  );
}

// ============================================
// VAR CHIP
// ============================================

function VarChip({
  variable,
  onClick,
}: {
  variable: { name: string; description: string };
  onClick: (name: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      title={variable.description}
      onClick={() => {
        onClick(variable.name);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="group relative flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border transition-all duration-200"
      style={{
        background: copied ? "#eef2ff" : "#f8fafc",
        borderColor: copied ? "#a5b4fc" : "#e2e8f0",
        color: copied ? "#4338ca" : "#475569",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: copied ? "#6366f1" : "#94a3b8",
          flexShrink: 0,
          transition: "background 0.2s",
        }}
      />
      {variable.name}
      <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {variable.description}
      </span>
    </button>
  );
}

// ============================================
// SECTION
// ============================================

function Section({
  label,
  icon: Icon,
  badge,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">{label}</span>
        </div>
        {badge}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ============================================
// PAGE
// ============================================

export default function ManagerSettingsPage() {
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/system-templates/rdv_notification")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setTemplate(json.data);
          setSubject(json.data.subject);
          setBodyHtml(json.data.bodyHtml);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const previewHtml = bodyHtml
    .replaceAll("{{contactName}}", "Marie Dupont")
    .replaceAll("{{companyName}}", "Acme Corp")
    .replaceAll("{{missionName}}", "Mission Prospection Q2")
    .replaceAll("{{meetingDate}}", "lundi 10 mars 2026")
    .replaceAll("{{meetingTime}}", "14:30 (Paris)")
    .replaceAll("{{meetingTypeLabel}}", "Visioconférence")
    .replaceAll("{{meetingJoinUrl}}", "https://meet.google.com/abc-defg-hij")
    .replaceAll("{{meetingAddress}}", "12 Rue de la Paix, 75001 Paris")
    .replaceAll("{{meetingPhone}}", "+33 6 12 34 56 78")
    .replaceAll("{{portalUrl}}", "#");

  const previewSubject = subject
    .replaceAll("{{contactName}}", "Marie Dupont")
    .replaceAll("{{companyName}}", "Acme Corp");

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/system-templates/rdv_notification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyHtml }),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(true);
        setTemplate((prev) => (prev ? { ...prev, isCustomized: true } : prev));
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(false), 3000);
      } else {
        setSaveError(json.error || "Erreur lors de la sauvegarde");
      }
    } catch {
      setSaveError("Erreur de connexion");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!template) return;
    if (!window.confirm("Remettre le template par défaut ? Vos modifications seront perdues.")) return;
    setResetting(true);
    try {
      await fetch("/api/system-templates/rdv_notification", { method: "DELETE" });
      setSubject(template.defaultSubject);
      setBodyHtml(template.defaultBodyHtml);
      setTemplate((prev) => (prev ? { ...prev, isCustomized: false } : prev));
    } finally {
      setResetting(false);
    }
  }

  function insertVariable(v: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setBodyHtml((prev) => prev + v);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setBodyHtml(bodyHtml.slice(0, start) + v + bodyHtml.slice(end));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + v.length, start + v.length);
    }, 0);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-100" />
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-slate-400 font-medium">Chargement du template…</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .tab-active { background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.10); color: #1e293b; }
        .tab-inactive { color: #64748b; }
        .tab-inactive:hover { color: #1e293b; }
        textarea.code { caret-color: #818cf8; }
        textarea.code::selection { background: rgba(99,102,241,0.25); }
      `}</style>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-2">
              <Zap className="w-3.5 h-3.5" />
              Configuration
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Template d&apos;email RDV
            </h1>
            <p className="text-sm text-slate-500 max-w-md leading-relaxed">
              Personnalisez l&apos;email envoyé automatiquement à vos clients à chaque nouveau rendez-vous confirmé.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {template?.isCustomized ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200/80 rounded-full">
                <Sparkles className="w-3 h-3" />
                Personnalisé
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full">
                Par défaut
              </span>
            )}
          </div>
        </div>

        {/* Subject */}
        <Section label="Objet de l'email" icon={Mail}>
          <div className="space-y-3">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent font-mono bg-slate-50 text-slate-800 transition-all placeholder:text-slate-400"
              placeholder="Ex: Votre RDV avec {{companyName}}…"
            />
            <div className="flex items-start gap-2 px-1">
              <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-400 leading-relaxed">
                Aperçu avec données réelles :{" "}
                <span className="text-slate-600 font-medium italic">{previewSubject || "—"}</span>
              </p>
            </div>
          </div>
        </Section>

        {/* Variables */}
        <Section
          label="Variables disponibles"
          icon={Variable}
          badge={
            <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Cliquez pour insérer
            </span>
          }
        >
          <div className="flex flex-wrap gap-2">
            {RDV_TEMPLATE_VARIABLES.map((v) => (
              <VarChip key={v.name} variable={v} onClick={insertVariable} />
            ))}
          </div>
        </Section>

        {/* Editor */}
        <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {[
                { id: "editor" as const, icon: Code2, label: "Éditeur" },
                { id: "preview" as const, icon: Eye, label: "Aperçu" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                    activeTab === tab.id ? "tab-active" : "tab-inactive"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              HTML valide
            </div>
          </div>

          {activeTab === "editor" ? (
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute left-0 top-0 bottom-0 w-12 bg-slate-900 text-slate-600 text-xs font-mono leading-[1.6rem] pt-3 pl-3 select-none overflow-hidden pointer-events-none"
                style={{ fontSize: "11px" }}
              >
                {bodyHtml.split("\n").map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                id="bodyHtmlTextarea"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={22}
                spellCheck={false}
                className="code w-full pl-14 pr-4 py-3 text-[12.5px] font-mono text-slate-200 bg-slate-900 focus:outline-none resize-none leading-[1.6rem]"
                style={{ minHeight: 380, letterSpacing: "0.01em" }}
              />
            </div>
          ) : (
            <div className="flex flex-col" style={{ minHeight: 380 }}>
              <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs text-slate-500">
                <span className="font-medium text-slate-600">De :</span>
                <span>notifications@votreapp.fr</span>
                <ChevronRight className="w-3 h-3 text-slate-300 mx-1" />
                <span className="font-medium text-slate-600">Objet :</span>
                <span className="font-medium text-slate-700 italic truncate">{previewSubject}</span>
              </div>
              <iframe
                srcDoc={previewHtml}
                title="Aperçu email"
                className="flex-1 w-full border-0"
                sandbox="allow-same-origin"
                style={{ minHeight: 380, background: "#f1f5f9" }}
              />
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-4 pt-1 pb-6">
          <div>
            {template?.isCustomized && (
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-500 font-medium transition-colors disabled:opacity-40 group"
              >
                <RotateCcw
                  className="w-3.5 h-3.5 transition-transform group-hover:rotate-[-45deg] duration-300"
                />
                {resetting ? "Réinitialisation…" : "Restaurer le template par défaut"}
              </button>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all duration-200 disabled:opacity-60 overflow-hidden"
            style={{
              background: saving
                ? "#818cf8"
                : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              boxShadow: saving ? "none" : "0 4px 14px rgba(99,102,241,0.4)",
            }}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Sauvegarde…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Sauvegarder
              </>
            )}
          </button>
        </div>
      </div>

      <Toast saved={saved} error={saveError} />
    </>
  );
}
