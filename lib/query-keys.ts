/**
 * Shared React Query keys for cache invalidation across pages and components.
 */
export const CLIENTS_QUERY_KEY = ["manager", "clients"] as const;
export const LEEXI_RECAPS_QUERY_KEY = ["manager", "leexi", "recaps"] as const;

export function clientDetailQueryKey(clientId: string | null) {
    return ["manager", "client", clientId] as const;
}

// SDR action page & unified action drawer
export function sdrUnifiedDrawerCompanyKey(companyId: string | null) {
    return ["sdr", "unified-drawer", "company", companyId] as const;
}
export function sdrUnifiedDrawerContactKey(contactId: string | null) {
    return ["sdr", "unified-drawer", "contact", contactId] as const;
}
export function sdrUnifiedDrawerActionsKey(contactId: string | null, companyId: string | null) {
    return ["sdr", "unified-drawer", "actions", contactId ?? companyId ?? ""] as const;
}
export function sdrUnifiedDrawerCampaignsKey(missionId: string | null) {
    return ["sdr", "unified-drawer", "campaigns", missionId] as const;
}
export function sdrUnifiedDrawerStatusConfigKey(missionId: string | null) {
    return ["sdr", "unified-drawer", "action-statuses", missionId] as const;
}
export function sdrActionQueueKey(missionId: string | null, listId: string | null, search: string) {
    return ["sdr", "action-queue", missionId, listId ?? "", search] as const;
}
export function sdrDrawerContactKey(contactId: string | null) {
    return ["sdr", "drawer", "contact", contactId] as const;
}
export function sdrDrawerCompanyKey(companyId: string | null) {
    return ["sdr", "drawer", "company", companyId] as const;
}
export function sdrClientBookingKey(missionId: string | null) {
    return ["sdr", "client-booking", missionId] as const;
}
export function sdrUnifiedDrawerMailboxesKey(missionId: string | null) {
    return ["sdr", "unified-drawer", "mailboxes", missionId] as const;
}
export function sdrUnifiedDrawerTemplatesKey(missionId: string | null) {
    return ["sdr", "unified-drawer", "templates", missionId] as const;
}
export function sdrScriptCompanionCampaignsKey(missionId: string | null) {
    return ["sdr", "script-companion", "campaigns", missionId] as const;
}
export function sdrScriptCompanionDataKey(campaignId: string | null) {
    return ["sdr", "script-companion", "data", campaignId] as const;
}

// Client detail page (manager)
export const qk = {
    client: (id: string) => ["client", id] as const,
    clientMissions: (id: string) => ["client", id, "missions"] as const,
    clientMissionsSummary: (id: string) => ["client", id, "missions-summary"] as const,
    clientSessions: (id: string) => ["client", id, "sessions"] as const,
    clientInterlocuteurs: (id: string) => ["client", id, "interlocuteurs"] as const,
    clientUsers: (id: string) => ["client", id, "users"] as const,
    clientPermissions: (id: string) => ["client", id, "permissions"] as const,
    clientUserPermissions: (clientId: string, userId: string) =>
        ["client", clientId, "users", userId, "permissions"] as const,
    clientOnboarding: (id: string) => ["client", id, "onboarding"] as const,
    clientBillingProfile: (billingClientId: string) =>
        ["billing", "clients", billingClientId] as const,
    clientEngagements: (id: string) => ["client", id, "engagements"] as const,
    clientInvoices: (billingClientId: string) =>
        ["billing", billingClientId, "invoices"] as const,
    clientProspectRules: (id: string) => ["client", id, "prospects", "rules"] as const,
    clientProspectSources: (id: string) => ["client", id, "prospects", "sources"] as const,
    clientPipelineConfig: (id: string) => ["client", id, "prospects", "pipeline"] as const,
    clientFiles: (id: string) => ["client", id, "files"] as const,
    clientReporting: (id: string, from: string, to: string) =>
        ["client", id, "reporting", from, to] as const,
    clientSharedReports: (id: string) => ["client", id, "shared-reports"] as const,
    clientMailboxes: (id: string) => ["client", id, "mailboxes"] as const,
    clientRecentActivity: (id: string) => ["client", id, "recent-activity"] as const,

    // Mission detail page (manager)
    mission: (id: string) => ["mission", id] as const,
    missionCampaigns: (id: string) => ["mission", id, "campaigns"] as const,
    missionCampaign: (missionId: string, campaignId: string) =>
        ["mission", missionId, "campaigns", campaignId] as const,
    missionLists: (id: string) => ["mission", id, "lists"] as const,
    missionList: (missionId: string, listId: string) =>
        ["mission", missionId, "lists", listId] as const,
    missionTemplates: (id: string) => ["mission", id, "templates"] as const,
    missionActionStats: (id: string, range?: { from?: string; to?: string; sdrId?: string }) =>
        ["mission", id, "action-stats", range ?? {}] as const,
    missionActionStatuses: (id: string) => ["mission", id, "action-statuses"] as const,
    missionActions: (id: string) => ["mission", id, "actions"] as const,
    missionPlans: (id: string) => ["mission", id, "plans"] as const,
    missionMonthPlans: (id: string, month?: string) =>
        ["mission", id, "month-plans", month ?? "all"] as const,
    missionFeedback: (id: string, range?: { from?: string; to?: string }) =>
        ["mission", id, "feedback", range ?? {}] as const,
    missionProspectSources: (id: string) => ["mission", id, "prospects", "sources"] as const,
    missionApiKeys: (id: string) => ["mission", id, "api-keys"] as const,
    missionFiles: (id: string) => ["mission", id, "files"] as const,
    missionLeexi: (id: string) => ["mission", id, "leexi"] as const,
    missionReporting: (id: string, from: string, to: string) =>
        ["mission", id, "reporting", from, to] as const,
    missionAnalyticsRange: (id: string) => ["mission", id, "analytics-range"] as const,
    missionClientBooking: (id: string) => ["mission", id, "client-booking"] as const,
    missionSdrAvailability: (id: string, month?: string) =>
        ["mission", id, "sdr-availability", month ?? "all"] as const,
    missionSharedReports: (id: string) => ["mission", id, "shared-reports"] as const,

    // Shared
    sharedMailboxes: () => ["email", "mailboxes"] as const,
    permissions: () => ["permissions"] as const,
    sdrUsers: () => ["users", "sdr"] as const,
} as const;
