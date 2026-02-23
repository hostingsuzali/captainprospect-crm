/**
 * Shared types for client reporting (preview, export, PDF).
 * Single source of truth for report data shape.
 */

export interface ReportMission {
    id: string;
    name: string;
    isActive: boolean;
    objective: string | null;
    startDate: string;
    endDate: string;
    sdrCount: number;
}

export interface ReportData {
    clientName: string;
    missionLabel: string;
    periodLabel: string;
    generatedDate: string;
    meetingsBooked: number;
    meetingsDelta?: number;
    contactsReached: number;
    qualifiedLeads: number;
    opportunities: number;
    conversionRate: number;
    deltas?: [number | null, number | null, number | null, number | null];
    meetingsByPeriod: Array<{ label: string; count: number }>;
    missions: ReportMission[];
}
