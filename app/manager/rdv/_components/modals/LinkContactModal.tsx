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
  const [linkError, setLinkError] = useState("");

  const handleSearch = async (q: string) => {
    setQuery(q);
    setLinkError("");
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

  return (
    <Modal isOpen onClose={() => !saving && onClose()} title="Lier un contact au RDV" size="md">
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
        {linkError && (
          <div style={{ fontSize: 12, color: "var(--red)", textAlign: "center" }}>{linkError}</div>
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
                        cursor: "pointer", textAlign: "left", width: "100%",
                        borderBottom: i < g.contacts.length - 1 ? "1px solid var(--border)" : "none",
                        opacity: saving ? 0.6 : 1, border: "none",
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

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="rdv-btn rdv-btn-ghost" onClick={onClose} disabled={saving}>Annuler</button>
        </div>
      </div>
    </Modal>
  );
}
