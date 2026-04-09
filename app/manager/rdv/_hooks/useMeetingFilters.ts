"use client";

import { useState, useMemo, useCallback } from "react";
import type {
  StatusFilter,
  ConfirmationFilter,
  DatePreset,
  MeetingTypeFilter,
  MeetingCategoryFilter,
  OutcomeFilter,
  FilterOption,
  MeetingFilters,
} from "../_types";
import { buildDateRange } from "../_lib/formatters";

export interface MeetingFiltersState extends MeetingFilters {
  setSearch: (v: string) => void;
  setStatusFilter: (v: StatusFilter) => void;
  setConfirmationFilter: (v: ConfirmationFilter) => void;
  setDatePreset: (v: DatePreset) => void;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  setSelectedClients: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedMissions: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedSdrs: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedMeetingTypes: React.Dispatch<React.SetStateAction<Set<MeetingTypeFilter>>>;
  setSelectedMeetingCategories: React.Dispatch<React.SetStateAction<Set<MeetingCategoryFilter>>>;
  setSelectedOutcomes: React.Dispatch<React.SetStateAction<Set<OutcomeFilter>>>;
  clearAllFilters: () => void;
  activeFilterCount: number;
  dateRange: { from: string; to: string };
  filterSummary: string;
  clientOptions: FilterOption[];
  missionOptions: FilterOption[];
  sdrOptions: FilterOption[];
  setClientOptions: (v: FilterOption[]) => void;
  setMissionOptions: (v: FilterOption[]) => void;
  setSdrOptions: (v: FilterOption[]) => void;
}

export function useMeetingFilters(): MeetingFiltersState {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [confirmationFilter, setConfirmationFilter] = useState<ConfirmationFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("3months");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [selectedMissions, setSelectedMissions] = useState<Set<string>>(new Set());
  const [selectedSdrs, setSelectedSdrs] = useState<Set<string>>(new Set());
  const [selectedMeetingTypes, setSelectedMeetingTypes] = useState<Set<MeetingTypeFilter>>(new Set());
  const [selectedMeetingCategories, setSelectedMeetingCategories] = useState<Set<MeetingCategoryFilter>>(new Set());
  const [selectedOutcomes, setSelectedOutcomes] = useState<Set<OutcomeFilter>>(new Set());

  const [clientOptions, setClientOptions] = useState<FilterOption[]>([]);
  const [missionOptions, setMissionOptions] = useState<FilterOption[]>([]);
  const [sdrOptions, setSdrOptions] = useState<FilterOption[]>([]);

  const dateRange = useMemo(
    () => buildDateRange(datePreset, dateFrom, dateTo),
    [datePreset, dateFrom, dateTo]
  );

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (search) c++;
    if (statusFilter !== "all") c++;
    if (confirmationFilter !== "all") c++;
    if (selectedClients.size > 0) c++;
    if (selectedMissions.size > 0) c++;
    if (selectedSdrs.size > 0) c++;
    if (selectedMeetingTypes.size > 0) c++;
    if (selectedMeetingCategories.size > 0) c++;
    if (selectedOutcomes.size > 0) c++;
    return c;
  }, [search, statusFilter, confirmationFilter, selectedClients, selectedMissions, selectedSdrs, selectedMeetingTypes, selectedMeetingCategories, selectedOutcomes]);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setConfirmationFilter("all");
    setDatePreset("3months");
    setDateFrom("");
    setDateTo("");
    setSelectedClients(new Set());
    setSelectedMissions(new Set());
    setSelectedSdrs(new Set());
    setSelectedMeetingTypes(new Set());
    setSelectedMeetingCategories(new Set());
    setSelectedOutcomes(new Set());
  }, []);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter !== "all") parts.push(statusFilter);
    if (selectedClients.size > 0) parts.push(`${selectedClients.size}clients`);
    return parts.join("_");
  }, [statusFilter, selectedClients]);

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    confirmationFilter,
    setConfirmationFilter,
    datePreset,
    setDatePreset,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    selectedClients,
    setSelectedClients,
    selectedMissions,
    setSelectedMissions,
    selectedSdrs,
    setSelectedSdrs,
    selectedMeetingTypes,
    setSelectedMeetingTypes,
    selectedMeetingCategories,
    setSelectedMeetingCategories,
    selectedOutcomes,
    setSelectedOutcomes,
    clearAllFilters,
    activeFilterCount,
    dateRange,
    filterSummary,
    clientOptions,
    missionOptions,
    sdrOptions,
    setClientOptions,
    setMissionOptions,
    setSdrOptions,
  };
}
