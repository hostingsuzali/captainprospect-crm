"use client";

import { useState } from "react";
import type { Meeting, LinkContactResult } from "../../_types";
import { Avatar } from "../shared/Avatar";
import { Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface LinkContactModalProps {
  meeting: Meeting;
  onClose: () => void;
  onLinked: (contact: LinkContactResult) => void;
}

export function LinkContactModal({ meeting, onClose, onLinked }: LinkContactModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkContactResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [createError, setCreateError] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(meeting.company?.id ?? "");
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    title: "",
    email: "",
    phone: "",
  });

  const handleSearch = async (q: string) => {
    setQuery(q);
    setLinkError("");
    setCreateError("");
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(q.trim())}&limit=10`);
      const json = await res.json().catch(() => null);
      setResults(json?.data?.items ?? json?.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async (c: LinkContactResult) => {
    setLinkError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/manager/rdv/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: c.id }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        onLinked(c);
        onClose();
      } else {
        setLinkError(json?.error || "Impossible de lier ce contact pour le moment.");
      }
    } catch {
      setLinkError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  };

  // Group by company
  const groups = results.reduce<{ companyId: string | null; companyName: string; contacts: LinkContactResult[] }[]>((acc, c) => {
    const key = c.company?.id ?? "__none__";
    const label = c.company?.name ?? "Sans entreprise";
    const existing = acc.find((g) => (g.companyId ?? "__none__") === key);
    if (existing) existing.contacts.push(c);
    else acc.push({ companyId: c.company?.id ?? null, companyName: label, contacts: [c] });
    return acc;
  }, []);

  const companyOptions = groups
    .filter((g) => !!g.companyId)
    .map((g) => ({ id: g.companyId as string, name: g.companyName }));

  const canCreate =
    !creating &&
    !!selectedCompanyId &&
    (!!newContact.firstName.trim() || !!newContact.lastName.trim()) &&
    (!!newContact.email.trim() || !!newContact.phone.trim());

  const handleCreateAndLink = async () => {
    if (!canCreate) return;
    setCreateError("");
    setCreating(true);
    try {
      const payload = {
        companyId: selectedCompanyId,
        firstName: newContact.firstName.trim() || undefined,
        lastName: newContact.lastName.trim() || undefined,
        title: newContact.title.trim() || undefined,
        email: newContact.email.trim() || undefined,
        phone: newContact.phone.trim() || undefined,
      };
      const createRes = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const createJson = await createRes.json().catch(() => null);
      const created = createJson?.data as LinkContactResult | undefined;
      if (!createRes.ok || !createJson?.success || !created?.id) {
        setCreateError(createJson?.error || "Impossible de créer le contact pour le moment.");
        return;
      }

      await handleLink({
        id: created.id,
        firstName: created.firstName ?? payload.firstName ?? null,
        lastName: created.lastName ?? payload.lastName ?? null,
        email: created.email ?? payload.email ?? null,
        phone: created.phone ?? payload.phone ?? null,
        title: created.title ?? payload.title ?? null,
        company: created.company ?? companyOptions.find((c) => c.id === selectedCompanyId) ?? null,
      });
    } catch {
      setCreateError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !(saving || creating) && onClose()} title="Lier un contact au RDV" size="md">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink3)" }} />
          <input
            className="rdv-input"
            style={{ width: "100%", paddingLeft: 32 }}
            placeholder="Rechercher par nom, email ou nom d'entreprise…"
            value={query}
            autoFocus
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {searching && <div style={{ fontSize: 13, color: "var(--ink3)", textAlign: "center" }}>Recherche…</div>}
        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--ink3)", textAlign: "center" }}>Aucun contact trouvé.</div>
        )}
        {groups.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto" }}>
            {groups.map((g) => (
              <div key={g.companyId ?? "__none__"} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.02em" }}>{g.companyName}</span>
                  <span style={{ fontSize: 11, color: "var(--ink3)", marginLeft: "auto" }}>{g.contacts.length} contact{g.contacts.length > 1 ? "s" : ""}</span>
                </div>
                {g.contacts.map((c, i) => {
                  const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Sans nom";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={saving}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                        background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)",
                        cursor: saving ? "not-allowed" : "pointer", textAlign: "left", width: "100%",
                        border: "none",
                        borderBottom: i < g.contacts.length - 1 ? "1px solid var(--border)" : "none",
                        opacity: saving ? 0.6 : 1,
                      }}
                      onClick={() => handleLink(c)}
                    >
                      <Avatar name={name} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                        {c.title && <div style={{ fontSize: 11, color: "var(--ink3)" }}>{c.title}</div>}
                        {c.email && <div style={{ fontSize: 11, color: "var(--ink3)" }}>{c.email}</div>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>Lier →</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {linkError && (
          <div
            style={{
              fontSize: 12,
              color: "var(--red)",
              background: "color-mix(in srgb, var(--red) 10%, white)",
              border: "1px solid color-mix(in srgb, var(--red) 35%, white)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            {linkError}
          </div>
        )}

        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.02em" }}>
              Créer un contact
            </span>
            <span style={{ fontSize: 11, color: "var(--ink3)" }}>
              Si le contact n&apos;existe pas
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            <select
              className="rdv-input"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              disabled={creating || saving}
            >
              <option value="">Choisir une société…</option>
              {meeting.company?.id && (
                <option value={meeting.company.id}>{meeting.company.name}</option>
              )}
              {companyOptions
                .filter((c) => c.id !== meeting.company?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                className="rdv-input"
                placeholder="Prénom"
                value={newContact.firstName}
                onChange={(e) => setNewContact((prev) => ({ ...prev, firstName: e.target.value }))}
                disabled={creating || saving}
              />
              <input
                className="rdv-input"
                placeholder="Nom"
                value={newContact.lastName}
                onChange={(e) => setNewContact((prev) => ({ ...prev, lastName: e.target.value }))}
                disabled={creating || saving}
              />
            </div>

            <input
              className="rdv-input"
              placeholder="Fonction (optionnel)"
              value={newContact.title}
              onChange={(e) => setNewContact((prev) => ({ ...prev, title: e.target.value }))}
              disabled={creating || saving}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                className="rdv-input"
                placeholder="Email"
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact((prev) => ({ ...prev, email: e.target.value }))}
                disabled={creating || saving}
              />
              <input
                className="rdv-input"
                placeholder="Téléphone"
                value={newContact.phone}
                onChange={(e) => setNewContact((prev) => ({ ...prev, phone: e.target.value }))}
                disabled={creating || saving}
              />
            </div>
          </div>

          <p style={{ fontSize: 11, color: "var(--ink3)" }}>
            Renseignez au moins un nom (prénom/nom) et un canal (email ou téléphone).
          </p>
          {createError && (
            <div style={{ fontSize: 12, color: "var(--red)" }}>{createError}</div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="rdv-btn rdv-btn-primary"
              onClick={handleCreateAndLink}
              disabled={!canCreate || saving}
            >
              {creating ? "Création…" : "Créer et lier"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="rdv-btn rdv-btn-ghost" onClick={onClose} disabled={saving || creating}>Annuler</button>
        </div>
      </div>
    </Modal>
  );
}
