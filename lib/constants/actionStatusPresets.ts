/**
 * Presets for mission-scoped action status definitions.
 * - SHORT: 7 statuses (e.g. NRP, RDV, FAUX NUMERO, REFUS, MAIL DOC, RAPPEL, INVALIDE) with colors.
 * - FULL: 8 statuses matching global defaults, with optional colors.
 */

export type PresetStatusItem = {
    code: string;
    label: string;
    color: string | null;
    sortOrder: number;
    requiresNote: boolean;
    priorityLabel: "CALLBACK" | "FOLLOW_UP" | "NEW" | "RETRY" | "SKIP";
    priorityOrder: number | null;
    triggersOpportunity: boolean;
    triggersCallback: boolean;
};

export const MISSION_STATUS_PRESETS = {
    SHORT: [
        { code: "NO_RESPONSE", label: "NRP", color: "#F5F5DC", sortOrder: 1, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
        { code: "MEETING_BOOKED", label: "RDV", color: "#90EE90", sortOrder: 2, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: true, triggersCallback: false },
        { code: "BAD_CONTACT", label: "FAUX NUMERO", color: "#FFB6C1", sortOrder: 3, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "DISQUALIFIED", label: "REFUS", color: "#FFA07A", sortOrder: 4, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "ENVOIE_MAIL", label: "MAIL DOC", color: "#87CEEB", sortOrder: 5, requiresNote: true, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "CALLBACK_REQUESTED", label: "RAPPEL", color: "#DDA0DD", sortOrder: 6, requiresNote: true, priorityLabel: "CALLBACK" as const, priorityOrder: 1, triggersOpportunity: false, triggersCallback: true },
        { code: "MEETING_CANCELLED", label: "INVALIDE", color: "#D3D3D3", sortOrder: 7, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
    ] as PresetStatusItem[],
    FULL: [
        { code: "NO_RESPONSE", label: "Pas de réponse", color: "#E8E8E8", sortOrder: 1, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
        { code: "BAD_CONTACT", label: "Standard / Mauvais contact", color: "#FFCDD2", sortOrder: 2, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "INTERESTED", label: "Intéressé", color: "#C8E6C9", sortOrder: 3, requiresNote: true, priorityLabel: "FOLLOW_UP" as const, priorityOrder: 2, triggersOpportunity: true, triggersCallback: false },
        { code: "CALLBACK_REQUESTED", label: "Rappel demandé", color: "#BBDEFB", sortOrder: 4, requiresNote: true, priorityLabel: "CALLBACK" as const, priorityOrder: 1, triggersOpportunity: false, triggersCallback: true },
        { code: "MEETING_BOOKED", label: "Meeting booké", color: "#A5D6A7", sortOrder: 5, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: true, triggersCallback: false },
        { code: "MEETING_CANCELLED", label: "Meeting annulé", color: "#FFCC80", sortOrder: 6, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
        { code: "DISQUALIFIED", label: "Disqualifié", color: "#D7CCC8", sortOrder: 7, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "ENVOIE_MAIL", label: "Envoie mail", color: "#B39DDB", sortOrder: 8, requiresNote: true, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
    ] as PresetStatusItem[],
};
