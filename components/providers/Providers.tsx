"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui";
import { createQueryClient } from "@/lib/query-client";

interface ProvidersProps {
    children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
    const [client] = useState(createQueryClient);
    return (
        <QueryClientProvider client={client}>
            <SessionProvider>
                <ToastProvider position="top-right">
                    {children}
                </ToastProvider>
            </SessionProvider>
        </QueryClientProvider>
    );
}
