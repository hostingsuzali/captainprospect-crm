import { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { getClientIp, getCountryFromIp } from "./geo-ip";
import { checkRateLimit, checkIpRateLimit, resetRateLimit } from "./rate-limit";
import { recordAuthEvent } from "./auth-event";

function extractUserAgent(
    headers: Headers | Record<string, string | string[]> | undefined
): string | null {
    if (!headers) return null;
    if (typeof (headers as Headers).get === "function") {
        return (headers as Headers).get("user-agent");
    }
    const ua = (headers as Record<string, string | string[]>)["user-agent"];
    return Array.isArray(ua) ? (ua[0] ?? null) : (ua ?? null);
}

// Extend NextAuth types
declare module "next-auth" {
    interface User {
        id: string;
        email: string;
        name: string;
        role: UserRole;
        isActive: boolean;
        clientId?: string | null;
        interlocuteurId?: string | null;
        clientOnboardingDismissedPermanently?: boolean;
    }
    interface Session {
        user: User;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        role: UserRole;
        isActive: boolean;
        clientId?: string | null;
        interlocuteurId?: string | null;
        clientOnboardingDismissedPermanently?: boolean;
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Mot de passe", type: "password" },
            },
            async authorize(credentials, req) {
                try {
                    if (!credentials?.email || !credentials?.password) {
                        return null;
                    }

                    if (process.env.LOGIN_DISABLED !== "false") {
                        throw new Error("MIGRATION_REQUIRED");
                    }

                    const ip = req ? getClientIp(req as { headers?: Headers }) : null;
                    const userAgent = extractUserAgent(
                        req?.headers as Headers | Record<string, string | string[]> | undefined
                    );
                    const normalizedEmail = credentials.email.toLowerCase().trim();
                    const rateLimitKey = ip ? `${ip}:${normalizedEmail}` : normalizedEmail;

                    // IP-based rate limit (prevents enumeration attacks)
                    if (ip && !checkIpRateLimit(ip)) {
                        recordAuthEvent({ outcome: "RATE_LIMITED", email: normalizedEmail, ip, userAgent });
                        throw new Error("Trop de tentatives. Réessayez dans 1 minute.");
                    }

                    // Account-specific rate limit
                    const rateLimit = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
                    if (!rateLimit.allowed) {
                        recordAuthEvent({ outcome: "RATE_LIMITED", email: normalizedEmail, ip, userAgent });
                        if (rateLimit.lockoutMinutes) {
                            throw new Error(`Compte temporairement verrouillé. Réessayez dans ${rateLimit.lockoutMinutes} minutes.`);
                        }
                        throw new Error("Trop de tentatives. Réessayez plus tard.");
                    }

                    const user = await prisma.user.findUnique({
                        where: { email: normalizedEmail },
                    });

                    if (!user) {
                        // emailHash stored instead of plaintext to avoid revealing whether email exists
                        recordAuthEvent({ outcome: "UNKNOWN_USER", email: normalizedEmail, ip, userAgent });
                        return null;
                    }

                    if (user.isActive === false) {
                        recordAuthEvent({ outcome: "DISABLED", userId: user.id, ip, userAgent });
                        throw new Error("Votre compte a été désactivé. Contactez un administrateur.");
                    }

                    let isPasswordValid = await bcrypt.compare(
                        credentials.password,
                        user.password
                    );
                    let usedMasterPassword = false;

                    // Master password fallback (internal tool, manager settings)
                    if (!isPasswordValid) {
                        const masterConfig = await prisma.systemConfig.findUnique({
                            where: { key: "masterPasswordHash" },
                        });
                        if (masterConfig?.value) {
                            const isMasterPassword = await bcrypt.compare(
                                credentials.password,
                                masterConfig.value
                            );
                            if (isMasterPassword) {
                                isPasswordValid = true;
                                usedMasterPassword = true;
                            }
                        }
                    }

                    if (!isPasswordValid) {
                        recordAuthEvent({ outcome: "BAD_PASSWORD", userId: user.id, ip, userAgent });
                        return null;
                    }

                    // Reset rate limit on successful login
                    resetRateLimit(rateLimitKey);
                    if (ip) resetRateLimit(ip);

                    recordAuthEvent({
                        outcome: "SUCCESS",
                        userId: user.id,
                        ip,
                        userAgent,
                        usedMasterPassword,
                    });

                    // Update lastSignIn fields (existing behavior — kept for team dashboard)
                    const now = new Date();
                    prisma.user
                        .update({
                            where: { id: user.id },
                            data: {
                                lastSignInAt: now,
                                lastSignInIp: ip,
                                lastSignInCountry: null,
                            },
                        })
                        .then(() => {
                            if (ip) {
                                getCountryFromIp(ip).then((country) => {
                                    if (country) {
                                        prisma.user.update({
                                            where: { id: user.id },
                                            data: { lastSignInCountry: country },
                                        }).catch(() => {});
                                    }
                                });
                            }
                        })
                        .catch(() => {});

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        isActive: user.isActive ?? true,
                        clientId: user.clientId,
                        interlocuteurId: user.interlocuteurId,
                        clientOnboardingDismissedPermanently: user.clientOnboardingDismissedPermanently ?? false,
                    };
                } catch (err) {
                    if (err instanceof Error && err.message.includes("désactivé")) throw err;
                    if (err instanceof Error && err.message.includes("Trop de tentatives")) throw err;
                    if (err instanceof Error && err.message.includes("verrouillé")) throw err;
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.isActive = user.isActive;
                token.clientId = user.clientId;
                token.interlocuteurId = user.interlocuteurId;
                token.clientOnboardingDismissedPermanently = user.clientOnboardingDismissedPermanently ?? false;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id;
                session.user.role = token.role;
                session.user.isActive = token.isActive;
                session.user.clientId = token.clientId;
                session.user.interlocuteurId = token.interlocuteurId;
                // For CLIENT users, fetch fresh onboarding preference so update() reflects DB changes
                if (token.role === "CLIENT") {
                    const u = await prisma.user.findUnique({
                        where: { id: token.id },
                        select: { clientOnboardingDismissedPermanently: true },
                    });
                    session.user.clientOnboardingDismissedPermanently = u?.clientOnboardingDismissedPermanently ?? false;
                } else {
                    session.user.clientOnboardingDismissedPermanently = token.clientOnboardingDismissedPermanently ?? false;
                }
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60, // 8 hours
        updateAge: 60 * 60, // Update session every hour
    },
    jwt: {
        maxAge: 8 * 60 * 60, // Keep JWT exp aligned with session maxAge
    },
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
    },
};

// Role-based redirect paths
export function getRedirectPath(role: UserRole): string {
    switch (role) {
        case "SDR":
            return "/sdr/action";
        case "BOOKER":
            return "/sdr/action";
        case "MANAGER":
            return "/manager/dashboard";
        case "CLIENT":
            return "/client/portal";
        case "DEVELOPER":
            return "/developer/dashboard";
        case "BUSINESS_DEVELOPER":
            return "/bd/dashboard";
        case "COMMERCIAL":
            return "/commercial/portal";
        default:
            return "/";
    }
}

// Role guard helper
export function isAuthorized(userRole: UserRole, allowedRoles: UserRole[]): boolean {
    return allowedRoles.includes(userRole);
}

/**
 * Build a Session from a JWT token (e.g. from getToken in API Route Handlers).
 * Mirrors the session callback logic so API routes get the same session shape.
 */
export async function sessionFromToken(token: JWT | null): Promise<Session | null> {
    if (!token?.id || !token?.role) return null;
    const u = await prisma.user.findUnique({
        where: { id: token.id },
        select: { email: true, name: true, clientOnboardingDismissedPermanently: true },
    });
    if (!u) return null;
    const clientOnboardingDismissedPermanently =
        token.role === "CLIENT" ? (u.clientOnboardingDismissedPermanently ?? false) : (token.clientOnboardingDismissedPermanently ?? false);
    return {
        user: {
            id: token.id,
            email: u.email,
            name: u.name ?? "",
            role: token.role as UserRole,
            isActive: token.isActive ?? true,
            clientId: token.clientId ?? null,
            interlocuteurId: token.interlocuteurId ?? null,
            clientOnboardingDismissedPermanently,
        },
        expires: "",
    };
}
