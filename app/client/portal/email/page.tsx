"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui";
import { Mail, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface SentEmail {
    id: string;
    recipient: string;
    subject: string;
    date: string | null;
    status: string;
}

function formatDate(dateString: string | null) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
    });
}

const STATUS_BADGES: Record<string, string> = {
    Envoyé: "bg-slate-100 text-slate-700 border-slate-200",
    Ouvert: "bg-blue-50 text-blue-700 border-blue-200",
    Répondu: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function ClientPortalEmailPage() {
    const toast = useToast();
    const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
    const [isLoadingSent, setIsLoadingSent] = useState(true);

    const fetchSentEmails = useCallback(async () => {
        setIsLoadingSent(true);
        try {
            const res = await fetch("/api/client/sent-emails?limit=50");
            const json = await res.json();
            if (json.success && json.data?.emails) {
                setSentEmails(json.data.emails);
            } else {
                setSentEmails([]);
            }
        } catch {
            setSentEmails([]);
            toast.error("Erreur", "Impossible de charger les emails envoyés");
        } finally {
            setIsLoadingSent(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchSentEmails();
    }, [fetchSentEmails]);

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-6">
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4" style={{ animation: "dashFadeUp 0.4s ease both" }}>
                <div>
                    <h1 className="text-2xl md:text-[28px] font-bold text-[#12122A] tracking-tight leading-tight">
                        Mes <span className="gradient-text">emails envoyés</span>
                    </h1>
                    <p className="text-sm text-[#6B7194] mt-1.5 max-w-xl">
                        Retrouvez ici les emails envoyés en votre nom par l&apos;équipe.
                    </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7C5CFC] to-[#A78BFA] flex items-center justify-center shadow-lg shadow-[#7C5CFC]/25 shrink-0">
                    <Mail className="w-6 h-6 text-white" />
                </div>
            </div>

            {/* ── Sent emails table ── */}
            <div className="premium-card overflow-hidden" style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "60ms" }}>
                <div className="flex items-center gap-2.5 px-6 pt-5 pb-4 border-b border-[#E8EBF0]">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C5CFC] to-[#A78BFA] flex items-center justify-center shadow-sm shadow-[#7C5CFC]/20">
                        <Send className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-[#12122A] uppercase tracking-wider">
                            Mes emails envoyés
                        </h2>
                        <p className="text-[11px] text-[#6B7194] mt-0.5">
                            Emails envoyés par l&apos;équipe en votre nom.
                        </p>
                    </div>
                </div>

                <div className="p-6">
                    {isLoadingSent ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 className="w-8 h-8 text-[#7C5CFC] animate-spin" />
                            <p className="text-xs text-[#6B7194]">Chargement des emails…</p>
                        </div>
                    ) : sentEmails.length === 0 ? (
                        <div className="text-center py-14">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F4F6F9] to-[#E8EBF0] flex items-center justify-center mx-auto mb-4">
                                <Send className="w-7 h-7 text-[#A0A3BD]" />
                            </div>
                            <p className="text-sm font-semibold text-[#12122A]">Aucun email envoyé</p>
                            <p className="text-xs text-[#6B7194] mt-1 max-w-[280px] mx-auto">
                                Les emails envoyés par l&apos;équipe apparaîtront ici.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto -mx-2 sm:mx-0 rounded-xl border border-[#E8EBF0] overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gradient-to-r from-[#F8F9FC] to-[#F4F6F9]">
                                        <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-[#6B7194] uppercase tracking-wider">
                                            Destinataire
                                        </th>
                                        <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-[#6B7194] uppercase tracking-wider">
                                            Objet
                                        </th>
                                        <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-[#6B7194] uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-[#6B7194] uppercase tracking-wider">
                                            Statut
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sentEmails.map((e, idx) => (
                                        <tr
                                            key={e.id}
                                            className={cn(
                                                "border-b border-[#F0F1F5] last:border-0 transition-colors duration-150",
                                                idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]/50",
                                                "hover:bg-[#7C5CFC]/5"
                                            )}
                                        >
                                            <td className="py-3.5 px-4 text-sm font-medium text-[#12122A] truncate max-w-[180px]">
                                                {e.recipient}
                                            </td>
                                            <td className="py-3.5 px-4 text-sm text-[#6B7194] truncate max-w-[240px]">
                                                {e.subject || "—"}
                                            </td>
                                            <td className="py-3.5 px-4 text-xs text-[#8B8DAF] whitespace-nowrap font-medium">
                                                {formatDate(e.date)}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border",
                                                        STATUS_BADGES[e.status] ??
                                                            "bg-slate-100 text-slate-700 border-slate-200"
                                                    )}
                                                >
                                                    {e.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes dashFadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: none; }
                }
            `}</style>
        </div>
    );
}
