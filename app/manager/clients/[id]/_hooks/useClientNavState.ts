"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

export type ClientTab =
    | "overview"
    | "missions"
    | "sessions"
    | "interlocuteurs"
    | "users"
    | "onboarding"
    | "billing"
    | "reporting"
    | "prospects"
    | "comms"
    | "files"
    | "portal-settings";

export const CLIENT_TAB_IDS: ClientTab[] = [
    "overview",
    "missions",
    "sessions",
    "interlocuteurs",
    "users",
    "onboarding",
    "billing",
    "reporting",
    "prospects",
    "comms",
    "files",
    "portal-settings",
];

function isClientTab(value: string | null): value is ClientTab {
    return !!value && CLIENT_TAB_IDS.includes(value as ClientTab);
}

export function useClientNavState() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    const raw = params.get("tab");
    const tab: ClientTab = isClientTab(raw) ? raw : "overview";
    const sub = params.get("sub");
    const m = params.get("m");
    const s = params.get("s");

    const buildUrl = useCallback(
        (overrides: Record<string, string | null | undefined>) => {
            const next = new URLSearchParams(params.toString());
            for (const [key, value] of Object.entries(overrides)) {
                if (value === null || value === undefined || value === "") {
                    next.delete(key);
                } else {
                    next.set(key, value);
                }
            }
            const qs = next.toString();
            return `${pathname}${qs ? `?${qs}` : ""}`;
        },
        [params, pathname]
    );

    const setTab = useCallback(
        (nextTab: ClientTab) => {
            router.replace(buildUrl({ tab: nextTab, sub: null, m: null, s: null }), { scroll: false });
        },
        [buildUrl, router]
    );

    const setSub = useCallback(
        (nextSub: string | null) => {
            router.replace(buildUrl({ sub: nextSub }), { scroll: false });
        },
        [buildUrl, router]
    );

    const setM = useCallback(
        (nextM: string | null) => {
            router.replace(buildUrl({ m: nextM }), { scroll: false });
        },
        [buildUrl, router]
    );

    const setS = useCallback(
        (nextS: string | null) => {
            router.replace(buildUrl({ s: nextS }), { scroll: false });
        },
        [buildUrl, router]
    );

    const closePanel = useCallback(() => {
        router.replace(buildUrl({ m: null, s: null }), { scroll: false });
    }, [buildUrl, router]);

    return {
        tab,
        sub,
        m,
        s,
        setTab,
        setSub,
        setM,
        setS,
        closePanel,
    };
}
