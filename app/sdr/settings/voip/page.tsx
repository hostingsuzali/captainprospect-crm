"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import { Phone, Loader2 } from "lucide-react";

type VoipProvider = "allo" | "aircall" | "ringover";

const PROVIDER_OPTIONS: { value: VoipProvider; label: string; badge: string }[] = [
  { value: "allo", label: "Allo", badge: "Lien tel:" },
  { value: "aircall", label: "Aircall", badge: "Click-to-Call API" },
  { value: "ringover", label: "Ringover", badge: "Callback 2 étapes" },
];

export default function VoipSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<VoipProvider>("allo");
  const [alloNumber, setAlloNumber] = useState("");
  const [aircallUserId, setAircallUserId] = useState("");
  const [ringoverUserId, setRingoverUserId] = useState("");
  const [ringoverNumber, setRingoverNumber] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;
    fetch("/api/voip/config")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          const c = json.data;
          setProvider((c.provider as VoipProvider) ?? "allo");
          setAlloNumber(c.alloNumber ?? "");
          setAircallUserId(c.aircallUserId != null ? String(c.aircallUserId) : "");
          setRingoverUserId(c.ringoverUserId ?? "");
          setRingoverNumber(c.ringoverNumber ?? "");
        }
      })
      .catch(() => showError("Impossible de charger la configuration"))
      .finally(() => setLoading(false));
  }, [status, router, showError]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/voip/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          alloNumber: provider === "allo" ? alloNumber.trim() || null : null,
          aircallUserId:
            provider === "aircall" && aircallUserId.trim()
              ? parseInt(aircallUserId, 10)
              : null,
          ringoverUserId: provider === "ringover" ? ringoverUserId.trim() || null : null,
          ringoverNumber: provider === "ringover" ? ringoverNumber.trim() || null : null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        success("Configuration VOIP enregistrée");
      } else {
        showError(json.error ?? "Erreur lors de l'enregistrement");
      }
    } catch {
      showError("Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Phone className="w-6 h-6 text-emerald-600" />
        <h1 className="text-xl font-semibold text-slate-800">Configuration VOIP</h1>
      </div>
      <p className="text-sm text-slate-500">
        Choisissez votre fournisseur d&apos;appels. Le bouton &quot;Appeler&quot; dans le tiroir
        utilisera cette configuration.
      </p>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Fournisseur
        </label>
        <div className="flex flex-wrap gap-2">
          {PROVIDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setProvider(opt.value)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                provider === opt.value
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt.label}
              <span className="ml-1.5 text-xs opacity-75">({opt.badge})</span>
            </button>
          ))}
        </div>
      </div>

      {provider === "allo" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Numéro Allo (E.164)
          </label>
          <input
            type="text"
            value={alloNumber}
            onChange={(e) => setAlloNumber(e.target.value)}
            placeholder="+33123456789"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Votre numéro Allo — utilisé pour identifier vos appels automatiquement
          </p>
        </div>
      )}

      {provider === "aircall" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            ID Utilisateur Aircall
          </label>
          <input
            type="number"
            value={aircallUserId}
            onChange={(e) => setAircallUserId(e.target.value)}
            placeholder="ex: 12345"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Trouvé dans Dashboard Aircall &gt; Users
          </p>
        </div>
      )}

      {provider === "ringover" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              ID Utilisateur Ringover
            </label>
            <input
              type="text"
              value={ringoverUserId}
              onChange={(e) => setRingoverUserId(e.target.value)}
              placeholder="ex: usr_abc123"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Numéro Ringover (E.164)
            </label>
            <input
              type="text"
              value={ringoverNumber}
              onChange={(e) => setRingoverNumber(e.target.value)}
              placeholder="+33123456789"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Votre téléphone sonnera sur ce numéro lors du callback
            </p>
          </div>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Enregistrer
      </Button>
    </div>
  );
}
