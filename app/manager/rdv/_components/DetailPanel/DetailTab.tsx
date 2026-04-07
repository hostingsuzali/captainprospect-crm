"use client";

import type { Meeting } from "../../_types";
import type { ConfirmationFilter } from "../../_types";
import {
  dateProximityColor,
  meetingTypeIcon,
  meetingTypeLabel,
  categoryBg,
  categoryColor,
  categoryLabel,
  contactName,
  proximityLabel,
  formatDuration,
} from "../../_lib/formatters";
import type { DetailFormState } from "../../_hooks/useDetailPanel";
import { Avatar } from "../shared/Avatar";
import {
  Pencil,
  Check,
  ExternalLink,
  Mail,
  Phone,
  Linkedin,
  ArrowUpRight,
} from "lucide-react";

interface DetailTabProps {
  meeting: Meeting;
  setSelectedMeeting: React.Dispatch<React.SetStateAction<Meeting | null>>;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  detailForm: DetailFormState;
  setDetailForm: React.Dispatch<React.SetStateAction<DetailFormState>>;
  detailSaving: boolean;
  setDetailSaving: (v: boolean) => void;
  updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>;
  onOpenEditContact: () => void;
  onOpenEditCompany: () => void;
  onOpenLinkContact: () => void;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
      <span style={{ fontSize: 13, color: "var(--ink3)", minWidth: 110, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <div style={{ fontSize: 13, color: "var(--ink)", textAlign: "right", flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function DetailTab({
  meeting,
  setSelectedMeeting,
  editMode,
  setEditMode,
  detailForm,
  setDetailForm,
  detailSaving,
  setDetailSaving,
  updateMeeting,
  onOpenEditContact,
  onOpenEditCompany,
  onOpenLinkContact,
}: DetailTabProps) {
  const handleSave = async () => {
    setDetailSaving(true);
    const payload: Record<string, unknown> = {};
    if (detailForm.callbackDate) payload.callbackDate = new Date(detailForm.callbackDate).toISOString();
    if (detailForm.meetingType) payload.meetingType = detailForm.meetingType;
    payload.meetingAddress = detailForm.meetingAddress;
    payload.meetingJoinUrl = detailForm.meetingJoinUrl;
    payload.meetingPhone = detailForm.meetingPhone;
    await updateMeeting(meeting.id, payload);
    setSelectedMeeting({
      ...meeting,
      callbackDate: detailForm.callbackDate ? new Date(detailForm.callbackDate).toISOString() : meeting.callbackDate,
      meetingType: (detailForm.meetingType as Meeting["meetingType"]) || meeting.meetingType,
      meetingAddress: detailForm.meetingAddress || null,
      meetingJoinUrl: detailForm.meetingJoinUrl || null,
      meetingPhone: detailForm.meetingPhone || null,
    });
    setEditMode(false);
    setDetailSaving(false);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setDetailForm({
      callbackDate: meeting.callbackDate ? new Date(meeting.callbackDate).toISOString().slice(0, 16) : "",
      meetingType: meeting.meetingType || "",
      meetingAddress: meeting.meetingAddress || "",
      meetingJoinUrl: meeting.meetingJoinUrl || "",
      meetingPhone: meeting.meetingPhone || "",
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {!editMode ? (
          <button className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setEditMode(true)}>
            <Pencil size={13} /> Éditer
          </button>
        ) : (
          <>
            <button className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={handleCancelEdit}>
              Annuler
            </button>
            <button
              className="rdv-btn rdv-btn-primary"
              style={{ fontSize: 12, padding: "6px 12px" }}
              disabled={detailSaving}
              onClick={handleSave}
            >
              <Check size={13} /> {detailSaving ? "Enregistrement…" : "Sauvegarder"}
            </button>
          </>
        )}
      </div>

      <DetailRow label="Date & heure">
        {editMode ? (
          <input
            type="datetime-local"
            className="rdv-input"
            style={{ fontSize: 13, padding: "6px 10px", width: "100%" }}
            value={detailForm.callbackDate}
            onChange={(e) => setDetailForm((f) => ({ ...f, callbackDate: e.target.value }))}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ color: dateProximityColor(meeting.callbackDate), fontWeight: 500 }}>
              {meeting.callbackDate
                ? new Date(meeting.callbackDate).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
            {meeting.callbackDate && (() => {
              const prox = proximityLabel(meeting.callbackDate);
              return (
                <span style={{ fontSize: 11, fontWeight: 600, color: prox.color, background: `${prox.color}12`, borderRadius: 6, padding: "2px 8px" }}>
                  {prox.text}
                </span>
              );
            })()}
          </div>
        )}
      </DetailRow>

      {meeting.duration != null && meeting.duration > 0 && (
        <DetailRow label="Durée">
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink2)" }}>{formatDuration(meeting.duration)}</span>
        </DetailRow>
      )}

      <DetailRow label="Type de RDV">
        {editMode ? (
          <select
            className="rdv-input"
            style={{ fontSize: 13, padding: "6px 10px", width: "100%" }}
            value={detailForm.meetingType}
            onChange={(e) => setDetailForm((f) => ({ ...f, meetingType: e.target.value }))}
          >
            <option value="">— Sélectionner —</option>
            <option value="VISIO">📹 Visio</option>
            <option value="PHYSIQUE">📍 Physique</option>
            <option value="TELEPHONIQUE">📞 Téléphonique</option>
          </select>
        ) : (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {meetingTypeIcon(meeting.meetingType)} {meetingTypeLabel(meeting.meetingType)}
          </span>
        )}
      </DetailRow>

      <DetailRow label="Catégorie">
        <div style={{ display: "flex", gap: 6 }}>
          {(["EXPLORATOIRE", "BESOIN"] as const).map((cat) => (
            <button
              key={cat}
              className="rdv-pill"
              style={{
                cursor: editMode ? "pointer" : "default",
                padding: "5px 14px",
                fontSize: 12,
                background: meeting.meetingCategory === cat ? categoryBg(cat) : "var(--surface2)",
                color: meeting.meetingCategory === cat ? categoryColor(cat) : "var(--ink3)",
                border: `1.5px solid ${meeting.meetingCategory === cat ? categoryColor(cat) : "transparent"}`,
                fontWeight: meeting.meetingCategory === cat ? 600 : 400,
                transition: "all 0.15s",
                opacity: !editMode && meeting.meetingCategory !== cat ? 0.5 : 1,
              }}
              onClick={() => {
                if (!editMode) return;
                const newCat = meeting.meetingCategory === cat ? null : cat;
                updateMeeting(meeting.id, { meetingCategory: newCat });
                setSelectedMeeting({ ...meeting, meetingCategory: newCat });
              }}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      </DetailRow>

      {(editMode || meeting.meetingJoinUrl) && (
        <DetailRow label="Lien visio">
          {editMode ? (
            <input
              type="url"
              className="rdv-input"
              style={{ fontSize: 13, padding: "6px 10px", width: "100%" }}
              placeholder="https://meet.google.com/…"
              value={detailForm.meetingJoinUrl}
              onChange={(e) => setDetailForm((f) => ({ ...f, meetingJoinUrl: e.target.value }))}
            />
          ) : (
            <a
              href={meeting.meetingJoinUrl!}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)", fontSize: 13, display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}
            >
              Rejoindre <ExternalLink size={12} />
            </a>
          )}
        </DetailRow>
      )}

      {(editMode || meeting.meetingAddress) && (
        <DetailRow label="Adresse">
          {editMode ? (
            <input
              type="text"
              className="rdv-input"
              style={{ fontSize: 13, padding: "6px 10px", width: "100%" }}
              placeholder="Adresse de la réunion…"
              value={detailForm.meetingAddress}
              onChange={(e) => setDetailForm((f) => ({ ...f, meetingAddress: e.target.value }))}
            />
          ) : (
            <span style={{ color: "var(--ink2)" }}>{meeting.meetingAddress}</span>
          )}
        </DetailRow>
      )}

      {(editMode || meeting.meetingPhone) && (
        <DetailRow label="Téléphone RDV">
          {editMode ? (
            <input
              type="tel"
              className="rdv-input"
              style={{ fontSize: 13, padding: "6px 10px", width: "100%" }}
              placeholder="+33 6 00 00 00 00"
              value={detailForm.meetingPhone}
              onChange={(e) => setDetailForm((f) => ({ ...f, meetingPhone: e.target.value }))}
            />
          ) : (
            <a href={`tel:${meeting.meetingPhone}`} style={{ color: "var(--ink2)" }}>{meeting.meetingPhone}</a>
          )}
        </DetailRow>
      )}

      <DetailRow label="SDR">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={meeting.sdr.name} size={26} />
          <span style={{ color: "var(--ink)", fontWeight: 500 }}>{meeting.sdr.name}</span>
        </div>
      </DetailRow>

      <DetailRow label="Commercial client">
        {meeting.interlocuteur ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            <Avatar
              name={[meeting.interlocuteur.firstName, meeting.interlocuteur.lastName].filter(Boolean).join(" ") || "Commercial"}
              size={26}
            />
            <span style={{ color: "var(--ink)", fontWeight: 500 }}>
              {[meeting.interlocuteur.firstName, meeting.interlocuteur.lastName].filter(Boolean).join(" ") || "Assigné"}
              {meeting.interlocuteur.title ? ` · ${meeting.interlocuteur.title}` : ""}
            </span>
          </div>
        ) : (
          <span style={{ color: "var(--ink3)" }}>Non assigné</span>
        )}
      </DetailRow>

      <DetailRow label="Client">{meeting.client?.name || "—"}</DetailRow>
      <DetailRow label="Mission">{meeting.mission.name}</DetailRow>
      <DetailRow label="Campagne">{meeting.campaign.name}</DetailRow>

      {/* Company card */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "var(--ink3)", textTransform: "uppercase" }}>Entreprise</span>
          {meeting.company ? (
            <button type="button" className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={onOpenEditCompany}>
              <Pencil size={12} /> Modifier
            </button>
          ) : (
            <button type="button" className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={onOpenLinkContact}>
              <ArrowUpRight size={12} /> Lier un contact
            </button>
          )}
        </div>
        {meeting.company ? (
          <div>
            <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 14 }}>{meeting.company.name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
              {meeting.company.industry && <div style={{ fontSize: 12, color: "var(--ink3)" }}>🏭 {meeting.company.industry}</div>}
              {meeting.company.country && <div style={{ fontSize: 12, color: "var(--ink3)" }}>🌍 {meeting.company.country}</div>}
              {meeting.company.size && <div style={{ fontSize: 12, color: "var(--ink3)" }}>👥 {meeting.company.size} salariés</div>}
              {meeting.company.phone && <div style={{ fontSize: 12, color: "var(--ink3)" }}>📞 {meeting.company.phone}</div>}
              {meeting.company.website && (
                <a
                  href={meeting.company.website.startsWith("http") ? meeting.company.website : `https://${meeting.company.website}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <ExternalLink size={11} /> {meeting.company.website}
                </a>
              )}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--ink3)", fontStyle: "italic" }}>
            Aucune entreprise liée — liez un contact pour associer son entreprise.
          </div>
        )}
      </div>

      {/* Contact card */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "var(--ink3)", textTransform: "uppercase" }}>Contact</span>
          {meeting.contact ? (
            <button type="button" className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={onOpenEditContact}>
              <Pencil size={12} /> Modifier
            </button>
          ) : (
            <button type="button" className="rdv-btn rdv-btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={onOpenLinkContact}>
              <ArrowUpRight size={12} /> Lier un contact
            </button>
          )}
        </div>
        {meeting.contact ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Avatar name={contactName(meeting.contact)} size={36} />
              <div>
                <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 14 }}>{contactName(meeting.contact)}</div>
                {meeting.contact.title && <div style={{ fontSize: 12, color: "var(--ink3)" }}>{meeting.contact.title}</div>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {meeting.contact.email && (
                <a href={`mailto:${meeting.contact.email}`} style={{ fontSize: 12, color: "var(--ink2)", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                  <Mail size={12} style={{ color: "var(--ink3)" }} /> {meeting.contact.email}
                </a>
              )}
              {meeting.contact.phone && (
                <a href={`tel:${meeting.contact.phone}`} style={{ fontSize: 12, color: "var(--ink2)", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                  <Phone size={12} style={{ color: "var(--ink3)" }} /> {meeting.contact.phone}
                </a>
              )}
              {meeting.contact.linkedin && (
                <a href={meeting.contact.linkedin} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--accent)", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                  <Linkedin size={12} /> LinkedIn
                </a>
              )}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--ink3)", fontStyle: "italic" }}>Aucun contact lié à ce RDV.</div>
        )}
      </div>

      {meeting.note && (
        <DetailRow label="Note SDR">
          <span style={{ color: "var(--ink2)", whiteSpace: "pre-wrap" }}>{meeting.note}</span>
        </DetailRow>
      )}
      <DetailRow label="Créé le">
        {new Date(meeting.createdAt).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </DetailRow>
    </div>
  );
}
