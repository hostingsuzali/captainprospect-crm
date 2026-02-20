"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui";
import {
  Card,
  Button,
  Badge,
  PageHeader,
} from "@/components/ui";
import {
  FileText,
  Upload,
  Loader2,
  ArrowLeft,
  Check,
  MessageSquare,
} from "lucide-react";
import type {
  ParsedPlaybook,
  ParsedPlaybookClient,
  ParsedPlaybookMission,
  ParsedPlaybookCampaign,
  ParsedPlaybookScript,
  ParsedPlaybookEmailTemplate,
} from "@/lib/playbook/types";

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB

export default function PlaybookImportPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();

  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [content, setContent] = useState("");
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedPlaybook | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Editable state (mirrors parsedData for preview)
  const [edited, setEdited] = useState<ParsedPlaybook | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      showError("Fichier trop volumineux", "Taille max 1 Mo");
      return;
    }
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".md") && !ext.endsWith(".txt")) {
      showError("Format non supporté", "Utilisez un fichier .md ou .txt");
      return;
    }
    setSourceFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ""));
    reader.readAsText(file, "UTF-8");
  };

  const handleParse = async () => {
    if (!content.trim()) {
      showError("Contenu requis", "Collez le texte ou uploadez un fichier.");
      return;
    }
    setIsParsing(true);
    try {
      const res = await fetch("/api/playbook/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          sourceFileName: sourceFileName ?? undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        showError("Erreur", json.error ?? "Impossible d'analyser le playbook");
        return;
      }
      setParsedData(json.data);
      setEdited(json.data);
      setStep("preview");
    } catch (err) {
      console.error(err);
      showError("Erreur", "Une erreur est survenue");
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!edited) return;
    if (!edited.client?.name?.trim()) {
      showError("Erreur", "Le nom du client est requis");
      return;
    }
    setIsImporting(true);
    try {
      const res = await fetch("/api/playbook/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...edited,
          sourceFileName: edited.sourceFileName ?? sourceFileName ?? undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        showError("Erreur", json.error ?? "Impossible de créer les entités");
        return;
      }
      success("Playbook importé", `${edited.client?.name} et les entités ont été créés`);
      router.push(`/manager/clients/${json.data.clientId}`);
    } catch (err) {
      console.error(err);
      showError("Erreur", "Une erreur est survenue");
    } finally {
      setIsImporting(false);
    }
  };

  const updateClient = (updates: Partial<ParsedPlaybookClient>) => {
    setEdited((prev) =>
      prev
        ? {
            ...prev,
            client: prev.client ? { ...prev.client, ...updates } : { name: "", ...updates },
          }
        : null
    );
  };

  const updateCampaign = (updates: Partial<ParsedPlaybookCampaign>) => {
    setEdited((prev) =>
      prev
        ? {
            ...prev,
            campaign: prev.campaign ? { ...prev.campaign, ...updates } : { icp: "", ...updates },
          }
        : null
    );
  };

  const updateScript = (updates: Partial<ParsedPlaybookScript>) => {
    setEdited((prev) =>
      prev ? { ...prev, script: prev.script ? { ...prev.script, ...updates } : ({ ...updates } as ParsedPlaybookScript) } : null
    );
  };

  const updateMissions = (missions: ParsedPlaybookMission[]) => {
    setEdited((prev) => (prev ? { ...prev, missions } : null));
  };

  const updateEmailTemplates = (emailTemplates: ParsedPlaybookEmailTemplate[]) => {
    setEdited((prev) => (prev ? { ...prev, emailTemplates } : null));
  };

  const entityCount =
    (edited?.client ? 1 : 0) +
    (edited?.missions?.length ?? 0) +
    (edited?.campaign ? 1 : 0) +
    (edited?.script ? 1 : 0) +
    (edited?.emailTemplates?.length ?? 0);

  // ----- Upload step -----
  if (step === "upload") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Importer un playbook"
          subtitle="Uploadez ou collez un document Sales Playbook (Notion markdown) pour créer automatiquement Client, Missions, Campagnes, Scripts et Emails"
        />
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Fichier .md ou .txt</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                  <Upload className="w-4 h-4" />
                  Choisir un fichier
                  <input
                    type="file"
                    accept=".md,.txt"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                {sourceFileName && (
                  <span className="text-sm text-slate-500 truncate max-w-[200px]">{sourceFileName}</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ou coller le contenu</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Collez ici le contenu du playbook (export Notion, markdown...)"
                rows={12}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Link href="/manager/clients">
                <Button variant="secondary" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Annuler
                </Button>
              </Link>
              <Button
                variant="primary"
                onClick={handleParse}
                disabled={!content.trim() || isParsing}
                isLoading={isParsing}
                className="gap-2"
              >
                {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Analyser le playbook
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ----- Preview step -----
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Vérification avant création"
        subtitle={`${entityCount} entité(s) détectée(s). Vérifiez et modifiez avant de créer.`}
      />

      <div className="flex items-center justify-between">
        <Link href="/manager/clients">
          <Button variant="secondary" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Annuler
          </Button>
        </Link>
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={!edited?.client?.name?.trim() || isImporting}
          isLoading={isImporting}
          className="gap-2"
        >
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Tout créer ({entityCount} entités)
        </Button>
      </div>

      {edited && (
        <div className="space-y-4">
          {/* 1. Client */}
          <Card className="p-5 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold">1</span>
              <h3 className="font-semibold text-slate-900">Client</h3>
              <Badge variant="primary" className="text-xs">Détecté</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nom</label>
                <input
                  value={edited.client?.name ?? ""}
                  onChange={(e) => updateClient({ name: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Site web</label>
                <input
                  value={edited.client?.website ?? ""}
                  onChange={(e) => updateClient({ website: e.target.value || null })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                  placeholder="ex: upikajob.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Secteur</label>
                <input
                  value={edited.client?.sector ?? edited.client?.industry ?? ""}
                  onChange={(e) => updateClient({ sector: e.target.value || null, industry: e.target.value || null })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <textarea
                  value={edited.client?.description ?? ""}
                  onChange={(e) => updateClient({ description: e.target.value || null })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                />
              </div>
            </div>
          </Card>

          {/* 2. Missions */}
          <Card className="p-5 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold">2</span>
              <h3 className="font-semibold text-slate-900">Missions</h3>
              <Badge variant="primary" className="text-xs">Détecté</Badge>
            </div>
            <div className="space-y-3">
              {(edited.missions ?? []).map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700">{m.name}</span>
                  <Badge variant="secondary">{m.channel}</Badge>
                </div>
              ))}
              {(!edited.missions || edited.missions.length === 0) && (
                <p className="text-sm text-slate-500">2 missions (Appel + Email) seront créées par défaut.</p>
              )}
            </div>
          </Card>

          {/* 3. Campagne ICP */}
          <Card className="p-5 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold">3</span>
              <h3 className="font-semibold text-slate-900">Campagne — ICP & Ciblage</h3>
              <Badge variant="primary" className="text-xs">Détecté</Badge>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Postes cibles / ICP</label>
                <textarea
                  value={edited.campaign?.icp ?? ""}
                  onChange={(e) => updateCampaign({ icp: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Secteurs</label>
                  <input
                    value={(edited.campaign?.secteurs ?? []).join(", ")}
                    onChange={(e) => updateCampaign({ secteurs: e.target.value ? e.target.value.split(",").map((s) => s.trim()) : [] })}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Taille / Zone</label>
                  <input
                    value={[edited.campaign?.taille, edited.campaign?.zone].filter(Boolean).join(" — ")}
                    onChange={(e) => {
                      const v = e.target.value;
                      const [taille, zone] = v.split("—").map((s) => s.trim());
                      updateCampaign({ taille: taille || null, zone: zone || null });
                    }}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* 4. Script téléphonique */}
          <Card className="p-5 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold">4</span>
              <h3 className="font-semibold text-slate-900">Script téléphonique</h3>
              <Badge variant="primary" className="text-xs">Détecté</Badge>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Intro / Premier contact</label>
                <textarea
                  value={edited.script?.intro ?? edited.script?.fullScript ?? ""}
                  onChange={(e) => updateScript({ intro: e.target.value || null })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Objections</label>
                <textarea
                  value={edited.script?.objection ?? (edited.script?.objections ?? []).join("\n\n")}
                  onChange={(e) => updateScript({ objection: e.target.value || null })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                />
              </div>
            </div>
          </Card>

          {/* 5. Sequence email */}
          <Card className="p-5 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold">5</span>
              <h3 className="font-semibold text-slate-900">Sequence email</h3>
              <Badge variant="primary" className="text-xs">Détecté</Badge>
            </div>
            <div className="space-y-3">
              {(edited.emailTemplates ?? []).map((t, i) => (
                <div key={i} className="p-3 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{t.delayLabel ?? `Email ${i + 1}`}</span>
                    <input
                      value={t.name}
                      onChange={(e) => {
                        const next = [...(edited?.emailTemplates ?? [])];
                        next[i] = { ...next[i], name: e.target.value };
                        updateEmailTemplates(next);
                      }}
                      className="flex-1 h-8 px-2 border border-slate-200 rounded text-sm"
                      placeholder="Nom"
                    />
                  </div>
                  <input
                    value={t.subject}
                    onChange={(e) => {
                      const next = [...(edited?.emailTemplates ?? [])];
                      next[i] = { ...next[i], subject: e.target.value };
                      updateEmailTemplates(next);
                    }}
                    className="w-full h-8 px-2 border border-slate-200 rounded text-sm"
                    placeholder="Sujet"
                  />
                  <textarea
                    value={t.bodyHtml}
                    onChange={(e) => {
                      const next = [...(edited?.emailTemplates ?? [])];
                      next[i] = { ...next[i], bodyHtml: e.target.value };
                      updateEmailTemplates(next);
                    }}
                    rows={3}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm resize-none"
                    placeholder="Corps (HTML ou texte)"
                  />
                </div>
              ))}
              {(!edited.emailTemplates || edited.emailTemplates.length === 0) && (
                <p className="text-sm text-slate-500">Aucun email détecté. Vous pourrez en ajouter après création.</p>
              )}
            </div>
          </Card>

          {/* Proposition de valeur (dashed) */}
          <Card className="p-5 border border-dashed border-slate-300 bg-slate-50/50">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-slate-700">Proposition de valeur</h3>
              <span className="text-xs text-slate-500">Stockée comme note sur le Client</span>
            </div>
            <textarea
              value={edited.valueProposition ?? ""}
              onChange={(e) => setEdited((prev) => (prev ? { ...prev, valueProposition: e.target.value || null } : null))}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none bg-white"
              placeholder="Pitch + proposition de valeur..."
            />
          </Card>

          {edited.sourceFileName && (
            <p className="text-xs text-slate-500">Fichier source: {edited.sourceFileName}</p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={!edited?.client?.name?.trim() || isImporting}
          isLoading={isImporting}
          className="gap-2"
        >
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Tout créer ({entityCount} entités)
        </Button>
      </div>
    </div>
  );
}
