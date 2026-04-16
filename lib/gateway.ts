import type { UserRole } from "@prisma/client";
import { getRedirectPath } from "@/lib/auth";

/** Reject open redirects and paths the user’s role cannot access. */
export function resolveGatewayDestination(
    nextParam: string | string[] | null | undefined,
    role: UserRole
): string {
    const fallback = getRedirectPath(role);
    const raw = Array.isArray(nextParam) ? nextParam[0] : nextParam;
    if (!raw || typeof raw !== "string") return fallback;

    let path = raw.trim();
    if (!path.startsWith("/") || path.startsWith("//")) return fallback;

    // Absolute URLs are not trusted server-side (open redirect); only same-app paths.
    if (path.includes("://")) return fallback;

    const pathname = path.split("?")[0] ?? path;
    if (pathname.startsWith("/gateway")) return fallback;
    if (!isPathAllowedForRole(pathname, role)) return fallback;

    return path;
}

function isPathAllowedForRole(pathname: string, role: UserRole): boolean {
    switch (role) {
        case "SDR":
        case "BOOKER":
            return pathname.startsWith("/sdr");
        case "BUSINESS_DEVELOPER":
            return pathname.startsWith("/sdr") || pathname.startsWith("/bd");
        case "MANAGER":
            return pathname.startsWith("/manager");
        case "CLIENT":
            return pathname.startsWith("/client");
        case "DEVELOPER":
            return pathname.startsWith("/developer");
        case "COMMERCIAL":
            return pathname.startsWith("/commercial");
        default:
            return false;
    }
}
