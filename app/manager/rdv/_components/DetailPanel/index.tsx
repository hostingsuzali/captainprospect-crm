"use client";

import { useEffect, useMemo, useState } from "react";
import type { Meeting } from "../../_types";
import {
  statusBg,
  statusColor,
  statusLabel,
  meetingStatus,
  confirmationBg,
  confirmationColor,
  confirmationLabel,
  meetingTypeIcon,
  meetingTypeLabel,
  categoryBg,
  categoryColor,
  categoryLabel,
} from "../../_lib/formatters";
import type { ConfirmationFilter } from "../../_types";
import { Avatar } from "../shared/Avatar";
import { X, Check, Mail, Phone, Linkedin, CalendarPlus, Loader2, AlertCircle } from "lucide-react";
import { downloadICS, proximityLabel } from "../../_lib/formatters";
import { DetailTab } from "./DetailTab";
import { FicheTab } from "./FicheTab";
import { FeedbackTab } from "./FeedbackTab";
import { NoteTab } from "./NoteTab";
import { HistoryTab } from "./HistoryTab";
import type { UseDetailPanelReturn } from "../../_hooks/useDetailPanel";
import type { UseFicheRdvReturn } from "../../_hooks/useFicheRdv";
import type { UseFeedbackReturn } from "../../_hooks/useFeedback";
import type { UseNoteAutosaveReturn } from "../../_hooks/useNoteAutosave";
import { contactName } from "../../_lib/formatters";
import { DateTimePicker } from "@/components/ui";

interface DetailPanelProps {
  panelState: UseDetailPanelReturn;
  ficheState: UseFicheRdvReturn;
  feedbackState: UseFeedbackReturn;
  noteState: UseNoteAutosaveReturn;
  updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>;
  onOpenEditContact: () => void;
  onOpenEditCompany: () => void;
  onOpenLinkContact: () => void;
  onSetMeetings: (fn: (prev: Meeting[]) => Meeting[]) => void;
}

interface Mission { id: string; name: string; channel: string; campaigns: { id: string; name: string; isActive: boolean }[]; lists: { id: string; name: string }[]; }
interface Company { id: string; name: string; contacts: { id: string; firstName: string | null; lastName: string | null; email: string | null; }[]; }

export function DetailPanel({
  panelState,
  ficheState,
  feedbackState,
  noteState,
  updateMeeting,
  onOpenEditContact,
  onOpenEditCompany,
  onOpenLinkContact,
  onSetMeetings,
}: DetailPanelProps) {
  const {
    selectedMeeting,
    setSelectedMeeting,
    panelOpen,
    panelSection,
    setPanelSection,
    internalTab,
    setInternalTab,
    isCreateMode,
    requestClosePanel,
    setIsDirty,
    isDirty,
    saveState,
    setSaveState,
  } = panelState;

  const [createStep, setCreateStep] = useState(1);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [missionId, setMissionId] = useState("");
  const [listId, setListId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createType, setCreateType] = useState<"VISIO" | "PHYSIQUE" | "TELEPHONIQUE">("VISIO");
  const [createCategory, setCreateCategory] = useState<"" | "EXPLORATOIRE" | "BESOIN">("");
  const [createAddress, setCreateAddress] = useState("");
  const [createJoinUrl, setCreateJoinUrl] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createDuration, setCreateDuration] = useState(30);
  const [createNote, setCreateNote] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);

  const canRenderPanel = panelOpen && (isCreateMode || !!selectedMeeting);

  const status = selectedMeeting ? meetingStatus(selectedMeeting) : "upcoming";
  const sections: { key: typeof panelSection; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "scheduling", label: "Scheduling" },
    { key: "participant", label: "Participant" },
    { key: "outcome", label: "Outcome" },
    { key: "internal", label: "Internal" },
  ];

  useEffect(() => {
    if (!isCreateMode || !panelOpen) return;
    setCreateStep(1);
    setCreateError(null);
    setMissionId("");
    setListId("");
    setCompanyId("");
    setContactId("");
    setCreateDate("");
    setCreateType("VISIO");
    setCreateCategory("");
    setCreateAddress("");
    setCreateJoinUrl("");
    setCreatePhone("");
    setCreateDuration(30);
    setCreateNote("");
    fetch("/api/missions?limit=200")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) setMissions(json.data as Mission[]);
      })
      .catch(() => setMissions([]));
  }, [isCreateMode, panelOpen]);

  useEffect(() => {
    if (!missionId) {
      setLists([]);
      setListId("");
      return;
    }
    const mission = missions.find((m) => m.id === missionId);
    setLists(mission?.lists ?? []);
    setListId("");
  }, [missionId, missions]);

  useEffect(() => {
    if (!listId) {
      setCompanies([]);
      setCompanyId("");
      return;
    }
    fetch(`/api/lists/${listId}/companies`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) setCompanies(json.data as Company[]);
      })
      .catch(() => setCompanies([]));
  }, [listId]);

  useEffect(() => {
    setIsDirty(isCreateMode ? createStep > 1 || !!missionId || !!createDate : false);
  }, [createStep, missionId, createDate, isCreateMode, setIsDirty]);

  const handleConfirm = async () => {
    if (!selectedMeeting) return;
    setSaveState("saving");
    try {
      await updateMeeting(selectedMeeting.id, { confirmationStatus: "CONFIRMED" });
      setSelectedMeeting({ ...selectedMeeting, confirmationStatus: "CONFIRMED", confirmedAt: new Date().toISOString() });
      onSetMeetings((prev) =>
        prev.map((x) => x.id === selectedMeeting.id ? { ...x, confirmationStatus: "CONFIRMED" as const, confirmedAt: new Date().toISOString() } : x)
      );
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const handleCancel = async () => {
    if (!selectedMeeting) return;
    setSaveState("saving");
    try {
      await updateMeeting(selectedMeeting.id, { confirmationStatus: "CANCELLED" });
      setSelectedMeeting({ ...selectedMeeting, confirmationStatus: "CANCELLED", confirmedAt: null, confirmedById: null });
      onSetMeetings((prev) =>
        prev.map((x) => x.id === selectedMeeting.id ? { ...x, confirmationStatus: "CANCELLED" as const, confirmedAt: null, confirmedById: null } : x)
      );
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const selectedCompany = companies.find((c) => c.id === companyId);
  const contacts = selectedCompany?.contacts ?? [];
  const selectedContact = contacts.find((c) => c.id === contactId);
  const mission = missions.find((m) => m.id === missionId);
  const campaign = mission?.campaigns?.find((c) => c.isActive) ?? mission?.campaigns?.[0];
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!missionId) errors.push("Mission requise");
    if (!listId) errors.push("Liste requise");
    if (!companyId) errors.push("Société requise");
    if (!contactId) errors.push("Contact requis");
    if (!createDate) errors.push("Date/heure requise");
    if (createType === "VISIO" && createJoinUrl && !/^https?:\/\//.test(createJoinUrl)) errors.push("Lien visio invalide");
    if (createType === "PHYSIQUE" && !createAddress.trim()) errors.push("Adresse requise");
    if (createType === "TELEPHONIQUE" && !createPhone.trim()) errors.push("Téléphone requis");
    return errors;
  }, [missionId, listId, companyId, contactId, createDate, createType, createJoinUrl, createAddress, createPhone]);

  const handleCreate = async () => {
    if (!campaign?.id || validationErrors.length > 0) {
      setCreateError(validationErrors[0] ?? "Veuillez compléter les champs requis.");
      return;
    }
    setCreateSaving(true);
    setSaveState("saving");
    setCreateError(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaign.id,
          channel: (mission?.channel as "CALL" | "EMAIL" | "LINKEDIN") ?? "CALL",
          result: "MEETING_BOOKED",
          callbackDate: new Date(createDate).toISOString(),
          contactId,
          companyId,
          meetingType: createType,
          duration: createDuration,
          note: createNote || undefined,
          meetingCategory: createCategory || undefined,
          meetingAddress: createType === "PHYSIQUE" ? createAddress || undefined : undefined,
          meetingJoinUrl: createType === "VISIO" ? createJoinUrl || undefined : undefined,
          meetingPhone: createType === "TELEPHONIQUE" ? createPhone || undefined : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError((json as { error?: string }).error ?? "Erreur lors de la création du RDV.");
        setSaveState("error");
        return;
      }
      setSaveState("saved");
      setIsDirty(false);
      requestClosePanel();
    } catch {
      setCreateError("Erreur réseau lors de la création du RDV.");
      setSaveState("error");
    } finally {
      setCreateSaving(false);
    }
  };

  if (!canRenderPanel) return null;

  return (
    <div className={`rdv-panel rdv-scrollbar ${panelOpen ? "open" : ""}`}>
      <div style={{ padding: "28px 28px 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          {isCreateMode ? (
            <div>
              <div className="rdv-serif" style={{ fontSize: 22, color: "var(--ink)" }}>Ajouter un RDV</div>
              <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 2 }}>Workflow guidé en 4 étapes</div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Avatar name={contactName(selectedMeeting?.contact ?? null)} size={60} />
              <div>
                <div className="rdv-serif" style={{ fontSize: 22, color: "var(--ink)" }}>
                  {contactName(selectedMeeting?.contact ?? null)}
                </div>
                <div style={{ fontSize: 14, color: "var(--ink2)", marginTop: 2 }}>
                  {selectedMeeting?.contact?.title || "—"} · {selectedMeeting?.company?.name || "—"}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={requestClosePanel}
            style={{ background: "var(--surface2)", border: "none", color: "var(--ink3)", cursor: "pointer", padding: 6, borderRadius: 8 }}
          >
            <X size={16} />
          </button>
        </div>

        {!isCreateMode && selectedMeeting && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <span className="rdv-pill" style={{ background: statusBg(status), color: statusColor(status), padding: "4px 14px" }}>{statusLabel(status)}</span>
              {selectedMeeting.confirmationStatus && <span className="rdv-pill" style={{ background: confirmationBg(selectedMeeting.confirmationStatus as ConfirmationFilter), color: confirmationColor(selectedMeeting.confirmationStatus as ConfirmationFilter), padding: "4px 14px", border: `1px solid ${confirmationColor(selectedMeeting.confirmationStatus as ConfirmationFilter)}` }}>{confirmationLabel(selectedMeeting.confirmationStatus as ConfirmationFilter)}</span>}
              <span className="rdv-pill" style={{ background: "var(--surface2)", color: "var(--ink2)", padding: "4px 14px" }}>{meetingTypeIcon(selectedMeeting.meetingType)} {meetingTypeLabel(selectedMeeting.meetingType)}</span>
              <span className="rdv-pill" style={{ background: selectedMeeting.meetingCategory ? categoryBg(selectedMeeting.meetingCategory) : "var(--surface2)", color: selectedMeeting.meetingCategory ? categoryColor(selectedMeeting.meetingCategory) : "var(--ink3)", padding: "4px 14px" }}>{selectedMeeting.meetingCategory ? categoryLabel(selectedMeeting.meetingCategory) : "Non classé"}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              {selectedMeeting.confirmationStatus !== "CONFIRMED" && <button className="rdv-btn" style={{ fontSize: 12, padding: "6px 12px", background: "var(--greenLight)", color: "var(--green)", border: "1px solid rgba(5,150,105,0.2)" }} onClick={handleConfirm}><Check size={13} /> Confirmer</button>}
              {selectedMeeting.confirmationStatus !== "CANCELLED" && <button className="rdv-btn" style={{ fontSize: 12, padding: "6px 12px", background: "var(--redLight)", color: "var(--red)", border: "1px solid rgba(220,38,38,0.2)" }} onClick={handleCancel}><X size={13} /> Annuler</button>}
              {selectedMeeting.contact?.email && <a href={`mailto:${selectedMeeting.contact.email}`} className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px", textDecoration: "none" }}><Mail size={13} /> Email</a>}
              {selectedMeeting.contact?.phone && <a href={`tel:${selectedMeeting.contact.phone}`} className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px", textDecoration: "none" }}><Phone size={13} /> Appeler</a>}
              {selectedMeeting.contact?.linkedin && <a href={selectedMeeting.contact.linkedin} target="_blank" rel="noreferrer" className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px", textDecoration: "none" }}><Linkedin size={13} /> LinkedIn</a>}
              {selectedMeeting.callbackDate && <button className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => downloadICS(selectedMeeting)}><CalendarPlus size={13} /> Exporter .ics</button>}
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 8 }}>
          {sections.map((section) => (
            <button key={section.key} className={`rdv-tab ${panelSection === section.key ? "active" : ""}`} onClick={() => setPanelSection(section.key)}>
              {section.label}
            </button>
          ))}
        </div>
        {selectedMeeting?.callbackDate && (
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: proximityLabel(selectedMeeting.callbackDate).color, background: `${proximityLabel(selectedMeeting.callbackDate).color}12`, borderRadius: 6, padding: "3px 10px" }}>{proximityLabel(selectedMeeting.callbackDate).text}</span>
          </div>
        )}
        {isCreateMode && (
          <div style={{ marginBottom: 16, fontSize: 12, color: "var(--ink2)" }}>
            Étape {createStep}/4
          </div>
        )}
      </div>

      <div style={{ padding: 28, paddingBottom: 90 }}>
        {isCreateMode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {createStep === 1 && (
              <>
                <select className="rdv-input" value={missionId} onChange={(e) => { setMissionId(e.target.value); setIsDirty(true); }}>
                  <option value="">Mission *</option>
                  {missions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select className="rdv-input" value={listId} onChange={(e) => { setListId(e.target.value); setIsDirty(true); }} disabled={!missionId}>
                  <option value="">Liste *</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <select className="rdv-input" value={companyId} onChange={(e) => { setCompanyId(e.target.value); setContactId(""); setIsDirty(true); }} disabled={!listId}>
                  <option value="">Société *</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="rdv-input" value={contactId} onChange={(e) => { setContactId(e.target.value); setIsDirty(true); }} disabled={!companyId}>
                  <option value="">Contact *</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.id}</option>)}
                </select>
              </>
            )}
            {createStep === 2 && (
              <>
                <DateTimePicker value={createDate} onChange={(v) => { setCreateDate(v); setIsDirty(true); }} placeholder="Date et heure du RDV *" allowPastDates />
                <div style={{ display: "flex", gap: 8 }}>
                  {(["VISIO", "PHYSIQUE", "TELEPHONIQUE"] as const).map((t) => (
                    <button key={t} type="button" className="rdv-btn" style={{ background: createType === t ? "var(--accent)" : "var(--surface2)", color: createType === t ? "white" : "var(--ink2)", border: "none" }} onClick={() => { setCreateType(t); setIsDirty(true); }}>
                      {t}
                    </button>
                  ))}
                </div>
                {createType === "VISIO" && <input className="rdv-input" placeholder="Lien visio (https://...)" value={createJoinUrl} onChange={(e) => { setCreateJoinUrl(e.target.value); setIsDirty(true); }} />}
                {createType === "PHYSIQUE" && <input className="rdv-input" placeholder="Adresse *" value={createAddress} onChange={(e) => { setCreateAddress(e.target.value); setIsDirty(true); }} />}
                {createType === "TELEPHONIQUE" && <input className="rdv-input" placeholder="Téléphone *" value={createPhone} onChange={(e) => { setCreatePhone(e.target.value); setIsDirty(true); }} />}
              </>
            )}
            {createStep === 3 && (
              <>
                <select className="rdv-input" value={createCategory} onChange={(e) => { setCreateCategory(e.target.value as "" | "EXPLORATOIRE" | "BESOIN"); setIsDirty(true); }}>
                  <option value="">Catégorie</option>
                  <option value="EXPLORATOIRE">Exploratoire</option>
                  <option value="BESOIN">Analyse de besoin</option>
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  {[15, 30, 45, 60, 90].map((d) => <button key={d} className="rdv-btn" type="button" style={{ background: createDuration === d ? "var(--accentLight)" : "var(--surface2)", border: "none" }} onClick={() => { setCreateDuration(d); setIsDirty(true); }}>{d}m</button>)}
                </div>
                <textarea className="rdv-input" style={{ minHeight: 90 }} placeholder="Notes internes" value={createNote} onChange={(e) => { setCreateNote(e.target.value); setIsDirty(true); }} />
              </>
            )}
            {createStep === 4 && (
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--surface2)" }}>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 8 }}>Review</div>
                <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>
                  <div><strong>Mission:</strong> {mission?.name || "—"}</div>
                  <div><strong>Contact:</strong> {selectedContact ? [selectedContact.firstName, selectedContact.lastName].filter(Boolean).join(" ") : "—"}</div>
                  <div><strong>Date:</strong> {createDate || "—"}</div>
                  <div><strong>Type:</strong> {createType}</div>
                  <div><strong>Catégorie:</strong> {createCategory || "—"}</div>
                </div>
                {validationErrors.length > 0 && (
                  <div style={{ marginTop: 10, color: "var(--red)", fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                    <AlertCircle size={14} /> {validationErrors[0]}
                  </div>
                )}
              </div>
            )}
            {createError && <div style={{ fontSize: 12, color: "var(--red)" }}>{createError}</div>}
          </div>
        ) : (
          <>
            {panelSection === "overview" && selectedMeeting && (
              <DetailTab
                meeting={selectedMeeting}
                setSelectedMeeting={setSelectedMeeting}
                editMode={panelState.detailEditMode}
                setEditMode={panelState.setDetailEditMode}
                detailForm={panelState.detailForm}
                setDetailForm={panelState.setDetailForm}
                detailSaving={panelState.detailSaving}
                setDetailSaving={panelState.setDetailSaving}
                updateMeeting={updateMeeting}
                onOpenEditContact={onOpenEditContact}
                onOpenEditCompany={onOpenEditCompany}
                onOpenLinkContact={onOpenLinkContact}
              />
            )}
            {panelSection === "scheduling" && selectedMeeting && (
              <DetailTab
                meeting={selectedMeeting}
                setSelectedMeeting={setSelectedMeeting}
                editMode={true}
                setEditMode={panelState.setDetailEditMode}
                detailForm={panelState.detailForm}
                setDetailForm={panelState.setDetailForm}
                detailSaving={panelState.detailSaving}
                setDetailSaving={panelState.setDetailSaving}
                updateMeeting={updateMeeting}
                onOpenEditContact={onOpenEditContact}
                onOpenEditCompany={onOpenEditCompany}
                onOpenLinkContact={onOpenLinkContact}
              />
            )}
            {panelSection === "participant" && selectedMeeting && (
              <div style={{ display: "grid", gap: 10 }}>
                <div className="rdv-board-card">
                  <div style={{ fontSize: 11, color: "var(--ink3)", marginBottom: 4 }}>Contact</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{contactName(selectedMeeting.contact)}</div>
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>{selectedMeeting.contact?.email || "Aucun email"}</div>
                </div>
                <div className="rdv-board-card">
                  <div style={{ fontSize: 11, color: "var(--ink3)", marginBottom: 4 }}>Entreprise</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedMeeting.company?.name || "Non liée"}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="rdv-btn rdv-btn-ghost" onClick={onOpenEditContact}>Modifier contact</button>
                  <button className="rdv-btn rdv-btn-ghost" onClick={onOpenEditCompany}>Modifier société</button>
                </div>
              </div>
            )}
            {panelSection === "outcome" && selectedMeeting && <FeedbackTab meeting={selectedMeeting} feedbackState={feedbackState} updateMeeting={updateMeeting} />}
            {panelSection === "internal" && selectedMeeting && (
              <>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {(["fiche", "note", "history"] as const).map((t) => (
                    <button key={t} className={`rdv-btn ${internalTab === t ? "rdv-btn-primary" : "rdv-btn-ghost"}`} style={{ fontSize: 12 }} onClick={() => setInternalTab(t)}>
                      {t}
                    </button>
                  ))}
                </div>
                {internalTab === "fiche" && <FicheTab meeting={selectedMeeting} setSelectedMeeting={setSelectedMeeting} ficheState={ficheState} updateMeeting={updateMeeting} />}
                {internalTab === "note" && <NoteTab meeting={selectedMeeting} noteState={noteState} updateMeeting={updateMeeting} />}
                {internalTab === "history" && <HistoryTab meeting={selectedMeeting} />}
              </>
            )}
          </>
        )}
      </div>

      <div style={{ position: "sticky", bottom: 0, borderTop: "1px solid var(--border)", background: "var(--surface)", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: saveState === "error" ? "var(--red)" : "var(--ink3)" }}>
          {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Erreur de sauvegarde" : isDirty ? "Modifications non enregistrées" : "Prêt"}
        </div>
        {isCreateMode ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="rdv-btn rdv-btn-ghost" onClick={() => createStep > 1 ? setCreateStep((s) => s - 1) : requestClosePanel()} disabled={createSaving}>Retour</button>
            {createStep < 4 ? (
              <button className="rdv-btn rdv-btn-primary" onClick={() => setCreateStep((s) => Math.min(4, s + 1))}>Continuer</button>
            ) : (
              <button className="rdv-btn rdv-btn-primary" onClick={handleCreate} disabled={createSaving || validationErrors.length > 0}>
                {createSaving ? <><Loader2 size={14} className="animate-spin" /> Création…</> : "Créer le RDV"}
              </button>
            )}
          </div>
        ) : (
          <button className="rdv-btn rdv-btn-ghost" onClick={requestClosePanel}>Fermer</button>
        )}
      </div>
    </div>
  );
}
