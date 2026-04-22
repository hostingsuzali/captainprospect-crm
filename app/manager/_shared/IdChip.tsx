"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

interface IdChipProps {
    id: string;
    className?: string;
    length?: number;
    label?: string;
}

export function IdChip({ id, className, length = 8, label }: IdChipProps) {
    const [copied, setCopied] = useState(false);
    const { success } = useToast();

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(id).then(() => {
            setCopied(true);
            success("ID copié", id);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    const display = length >= id.length ? id : `${id.slice(0, length)}…`;

    return (
        <button
            onClick={handleCopy}
            title={label ? `${label}: ${id}` : id}
            className={cn(
                "inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 px-1.5 py-0.5 rounded transition-colors cursor-pointer border border-slate-200",
                className
            )}
        >
            <span>{display}</span>
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
        </button>
    );
}

export default IdChip;
