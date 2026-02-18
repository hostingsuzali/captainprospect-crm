"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function BDIndexPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/bd/dashboard");
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
