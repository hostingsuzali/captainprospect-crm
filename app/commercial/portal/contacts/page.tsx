"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, X, Building2, User, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui";

// ── Types ──────────────────────────────────────────────────────────────────

interface Company {
    id: string;
    name: string;
    industry?: string | null;
    country?: string | null;
    website?: string | null;
    size?: string | null;
}

interface Contact {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    title?: string | null;
    company: Company;
}

// ── Company row with expandable contacts ───────────────────────────────────

function CompanyRow({ company, contacts }: { company: Company; contacts: Contact[] }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="premium-card overflow-hidden">
            <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#FAFBFF] transition-colors"
                onClick={() => setOpen((v) => !v)}
            >
                {/* Logo placeholder */}
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F0F1F5] to-[#E8EBF0] flex items-center justify-center shrink-0 font-bold text-[13px] text-[#8B8DAF]">
                    {company.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-[#12122A] truncate">{company.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {company.industry && (
                            <span className="text-[11.5px] text-[#8B8DAF]">{company.industry}</span>
                        )}
                        {company.country && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#A0A3BD]">
                                <Globe className="w-3 h-3" />{company.country}
                            </span>
                        )}
                        {company.size && (
                            <span className="text-[11px] text-[#A0A3BD]">{company.size}</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-[#6B7194] bg-[#F4F5FA] border border-[#E8EBF0] px-2 py-1 rounded-full">
                        {contacts.length} contact{contacts.length > 1 ? "s" : ""}
                    </span>
                    {company.website && (
                        <a
                            href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-blue-600 hover:text-blue-700 font-medium underline-offset-2 hover:underline"
                        >
                            Site web
                        </a>
                    )}
                    {open ? (
                        <ChevronUp className="w-4 h-4 text-[#A0A3BD]" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-[#A0A3BD]" />
                    )}
                </div>
            </div>

            {open && (
                <div className="border-t border-[#F0F1F5]">
                    {contacts.map((c, i) => (
                        <div
                            key={c.id}
                            className={cn(
                                "flex items-center gap-3 px-5 py-3",
                                i < contacts.length - 1 && "border-b border-[#F8F8FA]",
                                "hover:bg-[#FAFBFF] transition-colors"
                            )}
                        >
                            <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[13px] font-semibold text-[#12122A]">
                                    {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Contact"}
                                </p>
                                {c.title && (
                                    <p className="text-[11.5px] text-[#8B8DAF]">{c.title}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CommercialContactsPage() {
    const toast = useToast();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchContacts = useCallback(async (q: string) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ limit: "200" });
            if (q) params.set("search", q);
            const res = await fetch(`/api/commercial/contacts?${params}`);
            const json = await res.json();
            if (json.success) {
                setContacts(json.data?.contacts ?? []);
                setTotal(json.data?.total ?? 0);
            }
        } catch {
            toast.error("Erreur", "Impossible de charger les contacts");
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchContacts(debouncedSearch);
    }, [fetchContacts, debouncedSearch]);

    // Group contacts by company
    const companiesMap = useMemo(() => {
        const map = new Map<string, { company: Company; contacts: Contact[] }>();
        for (const c of contacts) {
            if (!map.has(c.company.id)) {
                map.set(c.company.id, { company: c.company, contacts: [] });
            }
            map.get(c.company.id)!.contacts.push(c);
        }
        return Array.from(map.values()).sort((a, b) =>
            a.company.name.localeCompare(b.company.name)
        );
    }, [contacts]);

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-[22px] font-bold text-[#12122A] tracking-tight">Contacts</h1>
                <p className="text-sm text-[#6B7194] mt-0.5">
                    {total} contact{total > 1 ? "s" : ""} dans votre portefeuille
                </p>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                <input
                    type="text"
                    placeholder="Rechercher un contact ou une entreprise..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 text-sm bg-white border border-[#E8EBF0] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all"
                />
                {search && (
                    <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="w-3.5 h-3.5 text-[#A0A3BD] hover:text-[#6B7194]" />
                    </button>
                )}
            </div>

            {/* Company groups */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="animate-pulse h-16 bg-white rounded-2xl border border-[#E8EBF0]" />
                    ))}
                </div>
            ) : companiesMap.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-[#F4F6F9] flex items-center justify-center mx-auto mb-4">
                        <Building2 className="w-6 h-6 text-[#A0A3BD]" />
                    </div>
                    <p className="text-sm font-medium text-[#6B7194]">Aucun contact trouvé</p>
                    {search && (
                        <p className="text-xs text-[#A0A3BD] mt-1">Essayez un autre terme de recherche</p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {companiesMap.map(({ company, contacts: companyContacts }) => (
                        <CompanyRow
                            key={company.id}
                            company={company}
                            contacts={companyContacts}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
