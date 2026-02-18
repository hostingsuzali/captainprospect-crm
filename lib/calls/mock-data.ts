/**
 * Mock data for Call Management UI (dialer, history, dashboard).
 * Replace with API calls when using real backend.
 */

// ============================================
// TYPES
// ============================================

export type CallStatus =
    | "ringing"
    | "in-progress"
    | "ended"
    | "completed"
    | "missed"
    | "no-answer"
    | "callback-requested";

export type CallResult =
    | "NO_RESPONSE"
    | "BAD_CONTACT"
    | "INTERESTED"
    | "CALLBACK_REQUESTED"
    | "MEETING_BOOKED"
    | "MEETING_CANCELLED"
    | "DISQUALIFIED"
    | "ENVOIE_MAIL";

export interface MockSDR {
    id: string;
    name: string;
    email: string;
}

export interface MockCampaign {
    id: string;
    name: string;
    missionName: string;
}

export interface MockCall {
    id: string;
    contactName: string;
    companyName: string;
    phone: string;
    date: string; // ISO
    duration: number; // seconds
    status: CallStatus;
    recordingUrl: string | null;
    result: CallResult | null;
    note: string | null;
    callbackDate: string | null; // ISO
    sdrId: string;
    sdrName: string;
    campaignId: string;
    campaignName: string;
}

export interface CallDashboardStats {
    totalCalls: number;
    totalDurationMinutes: number;
    completed: number;
    missed: number;
    callbackRequested: number;
    noAnswer: number;
}

export interface CallsOverTimePoint {
    date: string;
    calls: number;
    duration: number;
}

export interface SDRPerformance {
    sdrId: string;
    sdrName: string;
    calls: number;
    durationMinutes: number;
    completed: number;
}

// ============================================
// MOCK SDRs
// ============================================

export const MOCK_SDRS: MockSDR[] = [
    { id: "sdr-1", name: "Marie Dupont", email: "marie@example.com" },
    { id: "sdr-2", name: "Thomas Martin", email: "thomas@example.com" },
    { id: "sdr-3", name: "Léa Bernard", email: "lea@example.com" },
];

// ============================================
// MOCK CAMPAIGNS
// ============================================

export const MOCK_CAMPAIGNS: MockCampaign[] = [
    { id: "camp-1", name: "Outbound Tech Q1", missionName: "Prospection SaaS 2026" },
    { id: "camp-2", name: "Rappels Enterprise", missionName: "Enterprise France" },
    { id: "camp-3", name: "SDR Léa - Startups", missionName: "Startups B2B" },
];

// ============================================
// MOCK CALL HISTORY (for table + recent)
// ============================================

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

function iso(date: Date): string {
    return date.toISOString();
}

function addDays(d: Date, days: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + days);
    return out;
}

export const MOCK_CALLS: MockCall[] = [
    {
        id: "call-1",
        contactName: "Jean Lefebvre",
        companyName: "TechStart SAS",
        phone: "+33 6 12 34 56 78",
        date: iso(new Date(today.getTime() - 15 * 60 * 1000)),
        duration: 180,
        status: "completed",
        recordingUrl: "https://example.com/recordings/call-1.mp3",
        result: "INTERESTED",
        note: "Souhaite une démo la semaine prochaine.",
        callbackDate: null,
        sdrId: "sdr-1",
        sdrName: "Marie Dupont",
        campaignId: "camp-1",
        campaignName: "Outbound Tech Q1",
    },
    {
        id: "call-2",
        contactName: "Sophie Moreau",
        companyName: "DataCorp",
        phone: "+33 1 23 45 67 89",
        date: iso(addDays(today, -1)),
        duration: 0,
        status: "missed",
        recordingUrl: null,
        result: "NO_RESPONSE",
        note: "Pas de réponse, rappeler jeudi.",
        callbackDate: iso(addDays(today, 2)),
        sdrId: "sdr-2",
        sdrName: "Thomas Martin",
        campaignId: "camp-1",
        campaignName: "Outbound Tech Q1",
    },
    {
        id: "call-3",
        contactName: "Pierre Durand",
        companyName: "CloudNine",
        phone: "+33 6 98 76 54 32",
        date: iso(addDays(today, -1)),
        duration: 320,
        status: "completed",
        recordingUrl: "https://example.com/recordings/call-3.mp3",
        result: "CALLBACK_REQUESTED",
        note: "Rappeler lundi 10h.",
        callbackDate: iso(addDays(today, 2)),
        sdrId: "sdr-1",
        sdrName: "Marie Dupont",
        campaignId: "camp-2",
        campaignName: "Rappels Enterprise",
    },
    {
        id: "call-4",
        contactName: "Anne Petit",
        companyName: "ScaleUp Inc",
        phone: "+33 6 11 22 33 44",
        date: iso(addDays(today, -2)),
        duration: 45,
        status: "completed",
        recordingUrl: "https://example.com/recordings/call-4.mp3",
        result: "BAD_CONTACT",
        note: "N'est plus en poste.",
        callbackDate: null,
        sdrId: "sdr-3",
        sdrName: "Léa Bernard",
        campaignId: "camp-3",
        campaignName: "SDR Léa - Startups",
    },
    {
        id: "call-5",
        contactName: "Marc Dubois",
        companyName: "InnovLab",
        phone: "+33 6 55 66 77 88",
        date: iso(addDays(today, -2)),
        duration: 0,
        status: "no-answer",
        recordingUrl: null,
        result: "NO_RESPONSE",
        note: null,
        callbackDate: null,
        sdrId: "sdr-2",
        sdrName: "Thomas Martin",
        campaignId: "camp-1",
        campaignName: "Outbound Tech Q1",
    },
    {
        id: "call-6",
        contactName: "Claire Rousseau",
        companyName: "DevFactory",
        phone: "+33 1 98 76 54 32",
        date: iso(addDays(today, -3)),
        duration: 420,
        status: "completed",
        recordingUrl: "https://example.com/recordings/call-6.mp3",
        result: "MEETING_BOOKED",
        note: "RDV confirmé 15/02 14h.",
        callbackDate: null,
        sdrId: "sdr-1",
        sdrName: "Marie Dupont",
        campaignId: "camp-1",
        campaignName: "Outbound Tech Q1",
    },
    {
        id: "call-7",
        contactName: "Nicolas Blanc",
        companyName: "AgriTech",
        phone: "+33 6 00 11 22 33",
        date: iso(addDays(today, -4)),
        duration: 90,
        status: "completed",
        recordingUrl: "https://example.com/recordings/call-7.mp3",
        result: "DISQUALIFIED",
        note: "Déjà équipé.",
        callbackDate: null,
        sdrId: "sdr-3",
        sdrName: "Léa Bernard",
        campaignId: "camp-3",
        campaignName: "SDR Léa - Startups",
    },
    {
        id: "call-8",
        contactName: "Julie Mercier",
        companyName: "FinTech Pro",
        phone: "+33 1 11 22 33 44",
        date: iso(addDays(today, -5)),
        duration: 200,
        status: "completed",
        recordingUrl: "https://example.com/recordings/call-8.mp3",
        result: "INTERESTED",
        note: "Envoi doc par email.",
        callbackDate: null,
        sdrId: "sdr-2",
        sdrName: "Thomas Martin",
        campaignId: "camp-2",
        campaignName: "Rappels Enterprise",
    },
];

// ============================================
// MOCK DASHBOARD STATS
// ============================================

export const MOCK_DASHBOARD_STATS: CallDashboardStats = {
    totalCalls: 247,
    totalDurationMinutes: 1840,
    completed: 168,
    missed: 42,
    callbackRequested: 38,
    noAnswer: 37,
};

// ============================================
// MOCK CALLS OVER TIME (last 14 days)
// ============================================

export function getMockCallsOverTime(): CallsOverTimePoint[] {
    const points: CallsOverTimePoint[] = [];
    for (let i = 13; i >= 0; i--) {
        const d = addDays(today, -i);
        const dayCalls = MOCK_CALLS.filter((c) => {
            const callDate = new Date(c.date);
            return (
                callDate.getFullYear() === d.getFullYear() &&
                callDate.getMonth() === d.getMonth() &&
                callDate.getDate() === d.getDate()
            );
        });
        points.push({
            date: d.toISOString().slice(0, 10),
            calls: dayCalls.length + Math.floor(Math.random() * 8),
            duration: dayCalls.reduce((acc, c) => acc + c.duration, 0) + Math.floor(Math.random() * 600),
        });
    }
    return points;
}

// ============================================
// MOCK SDR PERFORMANCE (leaderboard)
// ============================================

export function getMockSDRPerformance(): SDRPerformance[] {
    const bySdr = new Map<string, SDRPerformance>();
    for (const sdr of MOCK_SDRS) {
        bySdr.set(sdr.id, {
            sdrId: sdr.id,
            sdrName: sdr.name,
            calls: 0,
            durationMinutes: 0,
            completed: 0,
        });
    }
    for (const call of MOCK_CALLS) {
        const p = bySdr.get(call.sdrId);
        if (p) {
            p.calls += 1;
            p.durationMinutes += Math.floor(call.duration / 60);
            if (call.status === "completed") p.completed += 1;
        }
    }
    // Pad with mock variance for demo
    const arr = Array.from(bySdr.values());
    arr[0].calls += 42;
    arr[0].durationMinutes += 180;
    arr[0].completed += 38;
    arr[1].calls += 28;
    arr[1].durationMinutes += 120;
    arr[1].completed += 22;
    arr[2].calls += 35;
    arr[2].durationMinutes += 150;
    arr[2].completed += 30;
    return arr.sort((a, b) => b.calls - a.calls);
}

// ============================================
// CALL RESULT OPTIONS (for post-call form)
// ============================================

export const CALL_RESULT_OPTIONS: { value: CallResult; label: string }[] = [
    { value: "NO_RESPONSE", label: "Pas de réponse" },
    { value: "BAD_CONTACT", label: "Mauvais contact" },
    { value: "INTERESTED", label: "Intéressé" },
    { value: "CALLBACK_REQUESTED", label: "Rappel demandé" },
    { value: "MEETING_BOOKED", label: "RDV pris" },
    { value: "MEETING_CANCELLED", label: "RDV annulé" },
    { value: "DISQUALIFIED", label: "Disqualifié" },
    { value: "ENVOIE_MAIL", label: "Envoi mail" },
];

// ============================================
// MOCK NUMBERS FOR "NEW CALL" DIALER
// ============================================

export const MOCK_QUICK_NUMBERS = [
    { label: "TechStart - Jean", number: "+33 6 12 34 56 78" },
    { label: "DataCorp - Sophie", number: "+33 1 23 45 67 89" },
    { label: "CloudNine - Pierre", number: "+33 6 98 76 54 32" },
];
