// User roles in the system
export type UserRole = "SDR" | "MANAGER" | "CLIENT" | "DEVELOPER" | "BUSINESS_DEVELOPER";

// Communication channels
export type Channel = "CALL" | "EMAIL" | "LINKEDIN";

// List source types
export type ListType = "SUZALI" | "CLIENT" | "MIXED";

// Contact/Company completeness
export type CompletenessStatus = "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";

// SDR action results (PRD Section 7)
export type ActionResult =
    | "NO_RESPONSE"
    | "BAD_CONTACT"
    | "INTERESTED"
    | "CALLBACK_REQUESTED"
    | "MEETING_BOOKED"
    | "MEETING_CANCELLED"
    | "DISQUALIFIED"
    | "ENVOIE_MAIL";

// Opportunity urgency levels
export type Urgency = "SHORT" | "MEDIUM" | "LONG";

// Labels for displaying in UI (fallback when config API unavailable)
export const ACTION_RESULT_LABELS: Record<string, string> = {
    NO_RESPONSE: "Pas de réponse",
    BAD_CONTACT: "Standard / Mauvais contact",
    INTERESTED: "Intéressé",
    CALLBACK_REQUESTED: "Rappel demandé",
    MEETING_BOOKED: "Meeting booké",
    MEETING_CANCELLED: "Meeting annulé",
    DISQUALIFIED: "Disqualifié",
    ENVOIE_MAIL: "Envoie mail",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
    CALL: "Appel",
    EMAIL: "Email",
    LINKEDIN: "LinkedIn",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
    SHORT: "Court terme",
    MEDIUM: "Moyen terme",
    LONG: "Long terme",
};

export const LIST_TYPE_LABELS: Record<ListType, string> = {
    SUZALI: "Liste Suzali",
    CLIENT: "Liste Client",
    MIXED: "Liste mixte",
};

export const STATUS_LABELS: Record<CompletenessStatus, string> = {
    INCOMPLETE: "Incomplet",
    PARTIAL: "Partiel",
    ACTIONABLE: "Actionnable",
};
