"use client";

import { useState, useCallback, useEffect } from "react";
import type { Meeting } from "../_types";

export interface DetailFormState {
  callbackDate: string;
  meetingType: string;
  meetingAddress: string;
  meetingJoinUrl: string;
  meetingPhone: string;
}

export interface UseDetailPanelReturn {
  selectedMeeting: Meeting | null;
  setSelectedMeeting: React.Dispatch<React.SetStateAction<Meeting | null>>;
  panelOpen: boolean;
  panelSection: "overview" | "scheduling" | "participant" | "outcome" | "internal";
  setPanelSection: (t: "overview" | "scheduling" | "participant" | "outcome" | "internal") => void;
  internalTab: "fiche" | "note" | "history";
  setInternalTab: (t: "fiche" | "note" | "history") => void;
  isCreateMode: boolean;
  openPanel: (m: Meeting, allMeetings: Meeting[]) => void;
  openCreatePanel: () => void;
  closePanel: () => void;
  requestClosePanel: () => boolean;
  setIsDirty: (v: boolean) => void;
  isDirty: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  setSaveState: (v: "idle" | "saving" | "saved" | "error") => void;
  detailEditMode: boolean;
  setDetailEditMode: (v: boolean) => void;
  detailForm: DetailFormState;
  setDetailForm: React.Dispatch<React.SetStateAction<DetailFormState>>;
  detailSaving: boolean;
  setDetailSaving: (v: boolean) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: (allMeetings: Meeting[]) => void;
  clearSelection: () => void;
}

export function useDetailPanel(): UseDetailPanelReturn {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelSection, setPanelSection] = useState<"overview" | "scheduling" | "participant" | "outcome" | "internal">("overview");
  const [internalTab, setInternalTab] = useState<"fiche" | "note" | "history">("fiche");
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [detailForm, setDetailForm] = useState<DetailFormState>({
    callbackDate: "",
    meetingType: "",
    meetingAddress: "",
    meetingJoinUrl: "",
    meetingPhone: "",
  });
  const [detailSaving, setDetailSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const openPanel = useCallback((m: Meeting, allMeetings: Meeting[]) => {
    const resolved = allMeetings.find((x) => x.id === m.id) ?? m;
    setSelectedMeeting(resolved);
    setPanelSection("overview");
    setInternalTab("fiche");
    setPanelOpen(true);
    setIsCreateMode(false);
    setDetailEditMode(false);
    setIsDirty(false);
    setSaveState("idle");
    setDetailForm({
      callbackDate: resolved.callbackDate
        ? new Date(resolved.callbackDate).toISOString().slice(0, 16)
        : "",
      meetingType: resolved.meetingType || "",
      meetingAddress: resolved.meetingAddress || "",
      meetingJoinUrl: resolved.meetingJoinUrl || "",
      meetingPhone: resolved.meetingPhone || "",
    });
  }, []);

  const openCreatePanel = useCallback(() => {
    setSelectedMeeting(null);
    setPanelSection("overview");
    setInternalTab("fiche");
    setPanelOpen(true);
    setIsCreateMode(true);
    setDetailEditMode(false);
    setIsDirty(false);
    setSaveState("idle");
    setDetailForm({
      callbackDate: "",
      meetingType: "VISIO",
      meetingAddress: "",
      meetingJoinUrl: "",
      meetingPhone: "",
    });
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const requestClosePanel = useCallback(() => {
    if (!isDirty) {
      setPanelOpen(false);
      return true;
    }
    const confirmed = window.confirm("Vous avez des modifications non enregistrées. Fermer sans sauvegarder ?");
    if (confirmed) {
      setPanelOpen(false);
      setIsDirty(false);
      return true;
    }
    return false;
  }, [isDirty]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || !panelOpen) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, panelOpen]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((allMeetings: Meeting[]) => {
    setSelectedIds((prev) => {
      if (prev.size === allMeetings.length) return new Set();
      return new Set(allMeetings.map((m) => m.id));
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedMeeting,
    setSelectedMeeting,
    panelOpen,
    panelSection,
    setPanelSection,
    internalTab,
    setInternalTab,
    isCreateMode,
    openPanel,
    openCreatePanel,
    closePanel,
    requestClosePanel,
    setIsDirty,
    isDirty,
    saveState,
    setSaveState,
    detailEditMode,
    setDetailEditMode,
    detailForm,
    setDetailForm,
    detailSaving,
    setDetailSaving,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  };
}
