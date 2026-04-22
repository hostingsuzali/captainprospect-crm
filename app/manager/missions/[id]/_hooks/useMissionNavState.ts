"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

export type MissionTab =
    | "overview"
    | "campaigns"
    | "lists"
    | "sdr-team"
    | "planning"
    | "email-templates"
    | "actions"
    | "reporting"
    | "prospect-sources"
    | "feedback"
    | "comms"
    | "files"
    | "leexi"
    | "settings";

export const MISSION_TAB_IDS: MissionTab[] = [
    "overview",
    "campaigns",
    "lists",
    "sdr-team",
    "planning",
    "email-templates",
    "actions",
    "reporting",
    "prospect-sources",
    "feedback",
    "comms",
    "files",
    "leexi",
    "settings",
];

function isMissionTab(value: string | null): value is MissionTab {
    return !!value && MISSION_TAB_IDS.includes(value as MissionTab);
}

export function useMissionNavState() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    const raw = params.get("tab");
    const tab: MissionTab = isMissionTab(raw) ? raw : "overview";
    const sub = params.get("sub");
    const c = params.get("c");
    const l = params.get("l");

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
        (nextTab: MissionTab) => {
            router.replace(buildUrl({ tab: nextTab, sub: null, c: null, l: null }), { scroll: false });
        },
        [buildUrl, router]
    );

    const setSub = useCallback(
        (nextSub: string | null) => {
            router.replace(buildUrl({ sub: nextSub }), { scroll: false });
        },
        [buildUrl, router]
    );

    const setC = useCallback(
        (nextC: string | null) => {
            router.replace(buildUrl({ c: nextC }), { scroll: false });
        },
        [buildUrl, router]
    );

    const setL = useCallback(
        (nextL: string | null) => {
            router.replace(buildUrl({ l: nextL }), { scroll: false });
        },
        [buildUrl, router]
    );

    const closePanel = useCallback(() => {
        router.replace(buildUrl({ c: null, l: null }), { scroll: false });
    }, [buildUrl, router]);

    return {
        tab,
        sub,
        c,
        l,
        setTab,
        setSub,
        setC,
        setL,
        closePanel,
    };
}
