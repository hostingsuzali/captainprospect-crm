import { prisma } from "@/lib/prisma";
import { enrichActionFromCallProvider, enrichActionShouldUseForce } from "./enrich-action";

export type CallEnrichmentSyncStatus =
    | "enriched"
    | "no_match"
    | "no_phone"
    | "error"
    | "skipped";

/**
 * Nombre d’actions enrichies en parallèle (appels Allo + Prisma).
 * Défaut 20 — surchargez avec CALL_ENRICHMENT_SYNC_CONCURRENCY si besoin (max 40 en code).
 */
export function getCallEnrichmentSyncConcurrency(): number {
    const raw = process.env.CALL_ENRICHMENT_SYNC_CONCURRENCY ?? "20";
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(n, 40);
}

async function enrichOneAction(
    action: {
        id: string;
        callEnrichmentAt: Date | null;
        callSummary: string | null;
        callRecordingUrl: string | null;
    },
    logPrefix: string,
): Promise<{ actionId: string; status: CallEnrichmentSyncStatus }> {
    try {
        const force = enrichActionShouldUseForce(action);
        await enrichActionFromCallProvider(action.id, { force });
        const after = await prisma.action.findUnique({
            where: { id: action.id },
            select: {
                callEnrichmentAt: true,
                callSummary: true,
                callRecordingUrl: true,
                callEnrichmentError: true,
            },
        });

        if (after?.callEnrichmentAt) {
            return { actionId: action.id, status: "enriched" };
        }
        if (after?.callEnrichmentError === "NO_MATCH") {
            return { actionId: action.id, status: "no_match" };
        }
        if (after?.callEnrichmentError === "NO_PHONE") {
            return { actionId: action.id, status: "no_phone" };
        }
        return { actionId: action.id, status: "skipped" };
    } catch (err) {
        console.error(`${logPrefix} actionId=${action.id}`, err);
        return { actionId: action.id, status: "error" };
    }
}

/** Pool fixe : garde l’ordre des résultats aligné sur `items`. */
async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        for (;;) {
            const i = nextIndex++;
            if (i >= items.length) break;
            results[i] = await fn(items[i]);
        }
    }
    const workers = Math.min(Math.max(1, concurrency), items.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));
    return results;
}

export async function enrichCallActionsParallel(
    actions: Array<{
        id: string;
        callEnrichmentAt: Date | null;
        callSummary: string | null;
        callRecordingUrl: string | null;
    }>,
    logPrefix = "[call-enrichment-sync]",
): Promise<Array<{ actionId: string; status: CallEnrichmentSyncStatus }>> {
    const concurrency = getCallEnrichmentSyncConcurrency();
    return mapPool(actions, concurrency, (action) => enrichOneAction(action, logPrefix));
}
