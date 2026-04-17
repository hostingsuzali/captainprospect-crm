export interface AssistantRuntimeContext {
    role?: string;
    pathname?: string;
    missionName?: string;
    currentPage?: string;
}

const PATH_CONTEXT_RULES: Array<{ match: RegExp; guidance: string }> = [
    {
        match: /\/planning\/conflicts/i,
        guidance:
            "User is on the planning conflicts page. Focus on conflict severity (P0/P1/P2), resolution steps, and capacity adjustments. Give direct resolution actions.",
    },
    {
        match: /\/planning/i,
        guidance:
            "User is in the planning module. Prioritize MissionMonthPlan, SdrDayAllocation, conflict detection (P0/P1/P2), assignment/capacity/overlap logic. They may want to add allocations, manage absences, or resolve conflicts.",
    },
    {
        match: /\/sdr\/action|\/prospection/i,
        guidance:
            "User is on the call/action screen. They are actively prospecting. Prioritize: disposition codes (MEETING_BOOKED, CALLBACK_REQUESTED, etc.), note quality tips, booking a meeting, callback scheduling, next-contact navigation.",
    },
    {
        match: /\/sdr\/callbacks/i,
        guidance:
            "User is on the callbacks page. They want to manage pending callbacks. Prioritize: filtering callbacks, calling back a contact, dismissing callbacks, understanding overdue callbacks.",
    },
    {
        match: /\/sdr\/history/i,
        guidance:
            "User is on action history. They may want to find a past action, understand filters, or review their activity. Explain date range presets, result filters, and how to search by contact.",
    },
    {
        match: /\/sdr\/meetings|\/manager\/rdv/i,
        guidance:
            "User is on the meetings/RDV page. They want to view, confirm, or manage booked meetings. Prioritize: meeting status lifecycle, confirmation workflow, feedback recording, how to find a specific meeting.",
    },
    {
        match: /\/listings?|\/prospects?|\/import|\/enricher/i,
        guidance:
            "User is in the listing/import/prospects context. Prioritize: CSV import mapping, duplicate detection, contact status (Actionable/Partial/Incomplete), enrichment workflow, phone lookup, prospect qualification rules.",
    },
    {
        match: /\/manager\/team/i,
        guidance:
            "User is on the team page. They may want to manage users (Réglages tab), view SDR performance, check who is online/offline, or compare SDR stats. If asking about adding/editing users, point to the Réglages tab specifically.",
    },
    {
        match: /\/manager\/clients/i,
        guidance:
            "User is on the clients page. They may want to create a client, check onboarding status, view readiness indicators, or configure client portal settings.",
    },
    {
        match: /\/manager\/missions/i,
        guidance:
            "User is on the missions page. Prioritize: mission creation wizard (3 steps), mission statuses, assigning SDRs via planning, linking campaigns and lists, understanding mission lifecycle.",
    },
    {
        match: /\/manager\/campaigns/i,
        guidance:
            "User is on campaigns. Explain campaign structure (ICP, pitch, script), how to create/activate/pause campaigns, and how campaigns link to missions and lists.",
    },
    {
        match: /\/analytics|\/dashboard|\/team/i,
        guidance:
            "User is in analytics/dashboard context. Prioritize: metric definitions (conversion rate, contact rate, actions/hour), date range filter usage, how to interpret leaderboard and charts, how to drill down by SDR/mission/campaign.",
    },
    {
        match: /\/manager\/emails?\/mailboxes?/i,
        guidance:
            "User is managing mailboxes. Prioritize: Gmail/Outlook OAuth setup, IMAP configuration, health score interpretation, daily send limits, warmup settings.",
    },
    {
        match: /\/manager\/emails?\/sequences?/i,
        guidance:
            "User is managing email sequences. Prioritize: sequence creation, step configuration, enrollment process, sequence statuses, stop conditions (reply/bounce), performance metrics.",
    },
    {
        match: /\/manager\/emails?/i,
        guidance:
            "User is in the Email Hub. Prioritize: mailbox health, sequence performance, pending replies/bounces, overall email deliverability, connecting new mailboxes.",
    },
    {
        match: /\/sdr\/emails?/i,
        guidance:
            "User is on the SDR email view. Prioritize: reading and replying to emails, using email templates, quick-send from call screen, understanding inbox filters.",
    },
    {
        match: /\/billing/i,
        guidance:
            "User is in billing. Prioritize: invoice creation workflow, status lifecycle (DRAFT→VALIDATED→SENT→PAID), marking as paid, generating credit notes, understanding aging buckets, billing client profiles.",
    },
    {
        match: /\/comms/i,
        guidance:
            "User is in internal messaging (Comms). Prioritize: creating new threads, filtering by mission/client/group, replying to messages, searching conversation history.",
    },
    {
        match: /\/notifications/i,
        guidance:
            "User is in notifications. Prioritize: marking as read/unread, filtering by type, understanding notification meanings, clearing old notifications.",
    },
    {
        match: /\/client\/portal/i,
        guidance:
            "User is in the CLIENT portal. They can only see their own campaign data. Prioritize: reading their dashboard stats, generating/printing reports, viewing meetings, understanding what is visible to them vs hidden.",
    },
    {
        match: /\/commercial\/portal/i,
        guidance:
            "User is in the COMMERCIAL (ClientInterlocuteur) portal. Prioritize: viewing booked meetings, monthly objective, navigating meeting history by month.",
    },
    {
        match: /\/developer/i,
        guidance:
            "User is in the developer workspace. Prioritize: project and task management, integrations setup, API key usage.",
    },
    {
        match: /\/manager\/api/i,
        guidance:
            "User is on the API & Integrations page. Prioritize: generating API keys, configuring third-party connections, webhook setup, OAuth flows for integrations.",
    },
    {
        match: /\/manager\/projects?|\/developer\/projects?|\/sdr\/projects?/i,
        guidance:
            "User is in project management. Prioritize: creating projects, managing task boards (TODO/IN_PROGRESS/IN_REVIEW/DONE), assigning tasks, tracking time, project member management.",
    },
    {
        match: /\/manager\/settings/i,
        guidance:
            "User is in system settings. Prioritize: SMTP email configuration, master password management, integration config.",
    },
    {
        match: /\/sdr\/lists?/i,
        guidance:
            "User is browsing prospect lists. Prioritize: navigating contacts in a list, understanding status indicators (Actionable/Partial/Incomplete), opening ContactDrawer, filtering and searching contacts.",
    },
    {
        match: /\/sdr\/calendar/i,
        guidance:
            "User is viewing their calendar. Explain schedule blocks, missions per day, how the schedule is set by the manager, and how to read block colors.",
    },
    {
        match: /\/shared\/report/i,
        guidance:
            "User is viewing a shared public report. Explain: this is a read-only report link, no login required, how to print/save as PDF, what metrics are shown.",
    },
];

export function buildAssistantRuntimeContextPrompt(
    runtime: AssistantRuntimeContext | undefined
): string {
    if (!runtime) return "";

    const lines: string[] = [];
    if (runtime.role) lines.push(`Current user role: ${runtime.role}`);
    if (runtime.pathname) lines.push(`Current app path: ${runtime.pathname}`);
    if (runtime.currentPage) lines.push(`Current page label: ${runtime.currentPage}`);
    if (runtime.missionName) lines.push(`Current mission context: ${runtime.missionName}`);

    if (runtime.pathname) {
        const matched = PATH_CONTEXT_RULES.find((rule) =>
            rule.match.test(runtime.pathname || "")
        );
        if (matched) {
            lines.push(`Page guidance: ${matched.guidance}`);
        }
    }

    if (lines.length === 0) return "";
    return `## Runtime Context\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

export function getAssistantQuickPrompts(pathname?: string, role?: string): string[] {
    // Planning page
    if (pathname?.includes("/planning/conflicts")) {
        return [
            "Explain this P0 conflict and how to fix it.",
            "What happens if I ignore a P1 conflict?",
            "How do I reduce an SDR's allocation to resolve overloading?",
        ];
    }

    if (pathname?.includes("/planning")) {
        return [
            "How do I add an allocation for an SDR to a mission?",
            "Explain P0 vs P1 vs P2 conflicts and the correct fix for each.",
            "How do I add a vacation absence for an SDR?",
        ];
    }

    // Call / action screen
    if (pathname?.includes("/sdr/action") || pathname?.includes("/prospection")) {
        return [
            "When should I use CALLBACK_REQUESTED vs INTERESTED?",
            "How do I book a meeting directly from this screen?",
            "What makes a good call note for managers?",
        ];
    }

    // Callbacks
    if (pathname?.includes("/callbacks")) {
        return [
            "How do I call back a contact from this list?",
            "What happens to overdue callbacks?",
            "How do I filter callbacks by mission?",
        ];
    }

    // Meetings / RDV
    if (pathname?.includes("/rdv") || pathname?.includes("/meetings")) {
        return [
            "How do I confirm a meeting as a manager?",
            "How do I record feedback after a meeting took place?",
            "Where can I see cancelled or rescheduled meetings?",
        ];
    }

    // Analytics / dashboard
    if (pathname?.includes("/analytics") || pathname?.includes("/dashboard")) {
        return [
            "How is the conversion rate calculated?",
            "How do I filter stats to a specific mission or SDR?",
            "What does the leaderboard sort by?",
        ];
    }

    // Team / users
    if (pathname?.includes("/manager/team")) {
        return [
            "How do I add a new SDR user?",
            "How do I reset a user's password?",
            "How do I see which SDRs are online right now?",
        ];
    }

    // Email hub
    if (pathname?.includes("/email")) {
        return [
            "How do I connect a Gmail mailbox?",
            "How do I create and activate an email sequence?",
            "What does a low mailbox health score mean?",
        ];
    }

    // Billing
    if (pathname?.includes("/billing")) {
        return [
            "How do I create and send an invoice?",
            "How do I mark an invoice as paid?",
            "How do I generate a credit note (avoir)?",
        ];
    }

    // Lists / prospects
    if (pathname?.includes("/lists") || pathname?.includes("/prospects") || pathname?.includes("/enricher")) {
        return [
            "How do I import contacts from a CSV file?",
            "What does 'Incomplet' contact status mean?",
            "How do I enrich phone numbers for a list?",
        ];
    }

    // Missions
    if (pathname?.includes("/missions")) {
        return [
            "Walk me through creating a new mission step by step.",
            "How do I assign SDRs to a mission after creating it?",
            "How do I pause and then reactivate a mission?",
        ];
    }

    // Client portal
    if (pathname?.includes("/client/portal")) {
        return [
            "How do I generate and download my campaign report?",
            "What data can I see in this portal?",
            "How do I filter the meetings by a specific month?",
        ];
    }

    // Role-specific defaults
    if (role === "MANAGER") {
        return [
            "How do I add a new SDR to the team?",
            "Where do I find today's call activity for the whole team?",
            "How do I create a new mission for a client?",
        ];
    }

    if (role === "SDR" || role === "BOOKER") {
        return [
            "How do I start calling and log my first action?",
            "Where do I see my callbacks for today?",
            "How do I book a meeting from the call screen?",
        ];
    }

    if (role === "CLIENT") {
        return [
            "How do I download my monthly report as a PDF?",
            "What do the stats on my dashboard mean?",
            "How do I see all meetings booked this month?",
        ];
    }

    if (role === "BUSINESS_DEVELOPER") {
        return [
            "How do I onboard a new client?",
            "How do I check onboarding readiness for a client?",
            "How do I create a mission for one of my clients?",
        ];
    }

    // Generic fallback
    return [
        "How do I add a new user to the CRM?",
        "Where do I find the team's performance stats?",
        "How do I create a new mission from scratch?",
    ];
}
