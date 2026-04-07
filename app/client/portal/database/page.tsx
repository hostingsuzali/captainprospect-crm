"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { Building2, Loader2, Search, Users, Globe2, Phone, Mail, X } from "lucide-react";

interface Contact {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
}

interface Company {
    id: string;
    name: string;
    country?: string | null;
    industry?: string | null;
    size?: string | null;
    phone?: string | null;
    website?: string | null;
    contacts: Contact[];
}

interface DatabaseResponse {
    companies: Company[];
}

export default function ClientPortalDatabasePage() {
    const { error: showError } = useToast();
    const [data, setData] = useState<DatabaseResponse>({ companies: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"cards" | "table">("table");

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            try {
                const res = await fetch("/api/client/database");
                const json = await res.json();
                if (json.success) {
                    setData(json.data);
                } else {
                    showError("Erreur", json.error || "Impossible de charger la base de données");
                }
            } catch {
                showError("Erreur", "Impossible de charger la base de données");
            } finally {
                setIsLoading(false);
            }
        })();
    }, [showError]);

    const filteredCompanies = data.companies.filter((c) => {
        if (!search.trim()) return true;
        const haystack = [
            c.name,
            c.industry,
            c.country,
            c.size,
            ...c.contacts.map((ct) =>
                [
                    ct.firstName,
                    ct.lastName,
                    ct.title,
                    ct.email,
                    ct.phone,
                ]
                    .filter(Boolean)
                    .join(" ")
            ),
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        return haystack.includes(search.toLowerCase());
    });

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ animation: "dbFadeUp 0.35s ease both" }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-200">
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#12122A] tracking-tight">Base de données</h1>
                        <p className="text-xs text-[#6B7194] mt-0.5">Entreprises et contacts travaillés dans vos campagnes</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-1 bg-white border border-[#E8EBF0] rounded-xl shadow-sm self-start md:self-auto">
                    <button
                        type="button"
                        onClick={() => setViewMode("cards")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            viewMode === "cards"
                                ? "bg-[#12122A] text-white shadow-sm"
                                : "text-[#6B7194] hover:text-[#12122A]"
                        }`}
                    >
                        Cartes
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("table")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            viewMode === "table"
                                ? "bg-[#12122A] text-white shadow-sm"
                                : "text-[#6B7194] hover:text-[#12122A]"
                        }`}
                    >
                        Tableau
                    </button>
                </div>
            </div>

            <div className="relative max-w-sm" style={{ animation: "dbFadeUp 0.35s ease both", animationDelay: "40ms" }}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher (entreprise, secteur, contact...)"
                    className="w-full h-10 pl-9 pr-8 rounded-xl border border-[#E8EBF0] bg-white text-sm text-[#12122A] placeholder:text-[#A0A3BD] focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/40 shadow-sm"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0A3BD] hover:text-[#6B7194]"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
                        <span className="text-sm text-[#6B7194]">Chargement de la base de données…</span>
                    </div>
                </div>
            ) : filteredCompanies.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-[#E8EBF0] rounded-2xl py-16 px-6 text-center" style={{ animation: "dbFadeUp 0.35s ease both" }}>
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[#F4F5FA] flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-[#A0A3BD]" />
                    </div>
                    <p className="text-sm font-semibold text-[#12122A]">Aucune entreprise trouvée</p>
                    <p className="mt-1 text-xs text-[#6B7194]">
                        Ajustez votre recherche ou réessayez plus tard.
                    </p>
                </div>
            ) : viewMode === "table" ? (
                <div className="bg-white rounded-2xl border border-[#E8EBF0] overflow-hidden shadow-sm" style={{ animation: "dbFadeUp 0.35s ease both", animationDelay: "60ms" }}>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-[#FAFAFA] border-b border-[#F0F1F7]">
                                <tr className="text-[11px] font-bold text-[#A0A3BD] uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left">Entreprise</th>
                                    <th className="px-4 py-3 text-left">Secteur</th>
                                    <th className="px-4 py-3 text-left">Taille</th>
                                    <th className="px-4 py-3 text-left">Pays</th>
                                    <th className="px-4 py-3 text-left">Téléphone</th>
                                    <th className="px-4 py-3 text-left">Site web</th>
                                    <th className="px-4 py-3 text-left">Contacts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F5F6FA]">
                                {filteredCompanies.map((company) => (
                                    <tr key={company.id} className="hover:bg-emerald-50/30 transition-colors">
                                        <td className="px-4 py-3 align-top">
                                            <div className="flex items-center gap-2.5 max-w-xs">
                                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                <p className="font-semibold text-[#12122A] truncate">
                                                    {company.name}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top text-sm text-[#6B7194]">
                                            {company.industry || <span className="text-[#C4C6D4]">—</span>}
                                        </td>
                                        <td className="px-4 py-3 align-top text-sm text-[#6B7194]">
                                            {company.size || <span className="text-[#C4C6D4]">—</span>}
                                        </td>
                                        <td className="px-4 py-3 align-top text-sm text-[#6B7194]">
                                            {company.country || <span className="text-[#C4C6D4]">—</span>}
                                        </td>
                                        <td className="px-4 py-3 align-top text-sm text-[#6B7194]">
                                            {company.phone ? (
                                                <a href={`tel:${company.phone}`} className="inline-flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
                                                    <Phone className="w-3 h-3" />
                                                    {company.phone}
                                                </a>
                                            ) : (
                                                <span className="text-[#C4C6D4]">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top text-sm text-[#6B7194]">
                                            {company.website ? (
                                                <a
                                                    href={company.website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 transition-colors"
                                                >
                                                    <Globe2 className="w-3 h-3" />
                                                    {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                                                </a>
                                            ) : (
                                                <span className="text-[#C4C6D4]">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top text-[#6B7194]">
                                            <div className="flex flex-col gap-1">
                                                <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                                                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                                                    <span className="font-medium">
                                                        {company.contacts.length} contact
                                                        {company.contacts.length > 1 ? "s" : ""}
                                                    </span>
                                                </span>
                                                {company.contacts.slice(0, 2).map((ct) => {
                                                    const name =
                                                        [ct.firstName, ct.lastName].filter(Boolean).join(" ") ||
                                                        "Contact";
                                                    return (
                                                        <div
                                                            key={ct.id}
                                                            className="text-[11px] text-slate-500 flex flex-wrap gap-1"
                                                        >
                                                            <span className="font-medium text-slate-700">
                                                                {name}
                                                            </span>
                                                            {ct.title && (
                                                                <span className="text-slate-400">· {ct.title}</span>
                                                            )}
                                                            {ct.email && (
                                                                <span className="w-full">
                                                                    <a
                                                                        href={`mailto:${ct.email}`}
                                                                        className="inline-flex items-center gap-1 hover:text-emerald-700"
                                                                    >
                                                                        <Mail className="w-3 h-3" />
                                                                        {ct.email}
                                                                    </a>
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {company.contacts.length > 2 && (
                                                    <span className="text-[11px] text-slate-400">
                                                        + {company.contacts.length - 2} autre
                                                        {company.contacts.length - 2 > 1 ? "s" : ""} contact
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" style={{ animation: "dbFadeUp 0.35s ease both", animationDelay: "60ms" }}>
                    {filteredCompanies.map((company, idx) => (
                        <div
                            key={company.id}
                            className="bg-white rounded-2xl border border-[#E8EBF0] p-4 flex flex-col gap-3 hover:border-emerald-300/60 hover:shadow-lg hover:shadow-emerald-100/40 transition-all duration-200"
                            style={{ animation: "dbFadeUp 0.3s ease both", animationDelay: `${60 + idx * 25}ms` }}
                        >
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center text-emerald-700">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">
                                        {company.name}
                                    </p>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                        {company.industry && (
                                            <span>{company.industry}</span>
                                        )}
                                        {company.size && (
                                            <span>· {company.size}</span>
                                        )}
                                        {company.country && (
                                            <span className="inline-flex items-center gap-1">
                                                · <Globe2 className="w-3 h-3" />
                                                {company.country}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {company.phone || company.website ? (
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    {company.phone && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <Phone className="w-3 h-3" />
                                            {company.phone}
                                        </span>
                                    )}
                                    {company.website && (
                                        <a
                                            href={company.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700"
                                        >
                                            <Globe2 className="w-3 h-3" />
                                            {company.website.replace(/^https?:\/\//, "")}
                                        </a>
                                    )}
                                </div>
                            ) : null}

                            <div className="mt-1 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 flex items-center justify-between text-xs text-slate-600">
                                <div className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="font-medium">
                                        {company.contacts.length} contact
                                        {company.contacts.length > 1 ? "s" : ""}
                                    </span>
                                </div>
                            </div>

                            {company.contacts.length > 0 && (
                                <div className="mt-1 space-y-2 max-h-44 overflow-auto pr-1">
                                    {company.contacts.map((ct) => {
                                        const name = [ct.firstName, ct.lastName]
                                            .filter(Boolean)
                                            .join(" ") || "Contact";
                                        return (
                                            <div
                                                key={ct.id}
                                                className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-xs flex flex-col gap-0.5"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-semibold text-slate-900 truncate">
                                                        {name}
                                                    </p>
                                                    {ct.title && (
                                                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                                            {ct.title}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                    {ct.email && (
                                                        <a
                                                            href={`mailto:${ct.email}`}
                                                            className="inline-flex items-center gap-1 hover:text-emerald-700"
                                                        >
                                                            <Mail className="w-3 h-3" />
                                                            {ct.email}
                                                        </a>
                                                    )}
                                                    {ct.phone && (
                                                        <a
                                                            href={`tel:${ct.phone}`}
                                                            className="inline-flex items-center gap-1 hover:text-emerald-700"
                                                        >
                                                            <Phone className="w-3 h-3" />
                                                            {ct.phone}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <style jsx global>{`
                @keyframes dbFadeUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: none; }
                }
            `}</style>
        </div>
    );
}
