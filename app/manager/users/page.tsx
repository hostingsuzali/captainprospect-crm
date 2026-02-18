"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirects /manager/users to the combined Equipe & Reglages page (Reglages tab).
 */
export default function UsersRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/manager/team?tab=reglages");
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-[200px]">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
