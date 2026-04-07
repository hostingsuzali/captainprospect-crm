export interface AssistantRuntimeContext {
    role?: string;
    pathname?: string;
    missionName?: string;
    currentPage?: string;
}

const PATH_CONTEXT_RULES: Array<{ match: RegExp; guidance: string }> = [
    {
        match: /\/planning/i,
        guidance:
            "User is in planning context. Prioritize MissionMonthPlan, allocation logic, and conflict priority explanations (P0/P1/P2).",
    },
    {
        match: /\/prospection|\/action|\/callbacks/i,
        guidance:
            "User is in call execution context. Prioritize dispositions, callback scheduling, note quality, and session productivity tips.",
    },
    {
        match: /\/listing|\/prospects|\/import/i,
        guidance:
            "User is in listing/import context. Prioritize CSV mapping, validation, duplicate handling, and import troubleshooting.",
    },
    {
        match: /\/analytics|\/dashboard|\/team/i,
        guidance:
            "User is in analytics context. Prioritize metric definitions, calculation logic, trend interpretation, and coaching insights.",
    },
    {
        match: /\/notifications/i,
        guidance:
            "User is in notifications context. Prioritize notification meaning, read/unread flow, and action links.",
    },
    {
        match: /\/client\/portal/i,
        guidance:
            "User is in client portal context. Prioritize visibility boundaries, report interpretation, and trust-building workflow.",
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
    if (runtime.missionName) lines.push(`Current mission: ${runtime.missionName}`);

    if (runtime.pathname) {
        const matched = PATH_CONTEXT_RULES.find((rule) =>
            rule.match.test(runtime.pathname || "")
        );
        if (matched) {
            lines.push(`Context guidance: ${matched.guidance}`);
        }
    }

    if (lines.length === 0) return "";
    return `Runtime context:\n- ${lines.join("\n- ")}`;
}

export function getAssistantQuickPrompts(pathname?: string, role?: string): string[] {
    const base = [
        "How do I import a CSV list step by step?",
        "What does each prospect status mean in practice?",
        "How should I diagnose a drop in conversion this week?",
    ];

    if (pathname?.includes("/planning")) {
        return [
            "Explain P0 vs P1 conflicts and how to fix them.",
            "How do I edit allocations without overloading SDR capacity?",
            "What happens when two missions overlap the same SDR day?",
        ];
    }

    if (pathname?.includes("/action") || pathname?.includes("/prospection")) {
        return [
            "Give me the best call workflow from start to callback.",
            "How should I log notes so managers can coach effectively?",
            "When should I mark callback vs qualified vs not interested?",
        ];
    }

    if (pathname?.includes("/analytics")) {
        return [
            "Explain today's dashboard metrics and what to act on first.",
            "How are weekly stats calculated for SDR performance?",
            "What trend signals should a manager monitor daily?",
        ];
    }

    if (role === "CLIENT") {
        return [
            "What can clients see in the portal and what is hidden?",
            "How should I read mission progress and report trends?",
            "What actions can I take directly from the client portal?",
        ];
    }

    return base;
}
