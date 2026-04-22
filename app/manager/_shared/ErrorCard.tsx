"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";

export function ErrorCard({
    message,
    onRetry,
    className,
}: {
    message: string;
    onRetry?: () => void;
    className?: string;
}) {
    return (
        <div className={`flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg ${className ?? ""}`}>
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1 text-sm text-red-800">{message}</div>
            {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                    Réessayer
                </Button>
            )}
        </div>
    );
}

export default ErrorCard;
