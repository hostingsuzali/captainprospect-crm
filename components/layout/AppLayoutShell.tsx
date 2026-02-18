"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { UserRole } from "@prisma/client";
import { SidebarProvider, useSidebar } from "./SidebarProvider";
import { PermissionProvider } from "@/lib/permissions/PermissionProvider";
import { GlobalSidebar, MobileMenuButton } from "./GlobalSidebar";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { NavSection, getNavByRole, ROLE_CONFIG } from "@/lib/navigation/config";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

interface AppLayoutShellProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    customNavigation?: NavSection[];
}

function InnerLayout({
    children,
    allowedRoles,
    customNavigation,
}: AppLayoutShellProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const { isCollapsed, isHovering, searchOpen, closeSearch } = useSidebar();

    const userRole = session?.user?.role as UserRole | undefined;
    const roleConfig = userRole ? ROLE_CONFIG[userRole] : null;

    useEffect(() => {
        if (status === "loading") return;

        if (status === "unauthenticated") {
            router.push("/login");
            return;
        }

        if (status === "authenticated") {
            if (userRole && !allowedRoles.includes(userRole)) {
                router.push("/unauthorized");
            }
        }
    }, [session, status, router, allowedRoles, userRole]);

    if (status === "loading" || !session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fafbfc]">
                <div className="flex flex-col items-center gap-3">
                    <div className="cp-spinner" />
                    <p className="text-sm text-slate-400 font-medium">Chargement...</p>
                </div>
            </div>
        );
    }

    if (userRole && !allowedRoles.includes(userRole)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fafbfc]">
                <div className="cp-spinner" />
            </div>
        );
    }

    const navigation =
        customNavigation || (userRole ? getNavByRole(userRole) : []);

    const isEmailPage =
        pathname === "/sdr/email" || pathname === "/manager/email";
    if (isEmailPage) {
        return (
            <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#fafbfc]">
                {children}
            </div>
        );
    }

    const pathParts = pathname.split("/").filter(Boolean);
    const rawPage = pathParts[pathParts.length - 1]?.replace(/-/g, " ") || "Dashboard";
    const pageLabels: Record<string, string> = {
        dashboard: "Tableau de bord",
        prospection: "Appels",
        listing: "Listing",
        missions: "Missions",
        clients: "Clients",
        team: "Performance",
        planning: "Planning",
        projects: "Projets",
    };
    const currentPage = pageLabels[rawPage?.toLowerCase()] || rawPage;

    return (
        <div className="cp-layout">
            <GlobalSearchModal
                open={searchOpen}
                onClose={closeSearch}
                navigation={navigation}
            />
            <GlobalSidebar navigation={navigation} />

            <main
                className={cn(
                    "cp-main",
                    isCollapsed && !isHovering
                        ? "cp-main-collapsed"
                        : "cp-main-expanded"
                )}
            >
                <header className="cp-topbar">
                    <div className="flex items-center gap-3">
                        <MobileMenuButton />
                        <nav className="cp-breadcrumb" aria-label="Breadcrumb">
                            <span className="cp-breadcrumb-root">
                                {roleConfig?.label || "App"}
                            </span>
                            <span className="cp-breadcrumb-sep">/</span>
                            <span className="cp-breadcrumb-current">
                                {currentPage}
                            </span>
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.refresh()}
                            className="w-8 h-8 rounded-lg border border-[#E8EBF0] flex items-center justify-center text-[#8B8BA7] hover:text-[#12122A] hover:border-[#C5C8D4] transition-colors duration-150"
                            title="Rafraîchir"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <NotificationBell />
                    </div>
                </header>

                <div className="cp-content">
                    <div className="max-w-[1440px] mx-auto w-full">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}

export function AppLayoutShell(props: AppLayoutShellProps) {
    return (
        <SidebarProvider>
            <PermissionProvider>
                <InnerLayout {...props} />
            </PermissionProvider>
        </SidebarProvider>
    );
}

export default AppLayoutShell;
