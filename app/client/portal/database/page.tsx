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
        <div className="min-h-full bg-[#F3F4F8] p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                            <Building2 className="w-4 h-4" />
                        </span>
                        Base de données
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Liste des entreprises et contacts travaillés dans vos campagnes.
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                    <button
                        type="button"
                        onClick={() => setViewMode("cards")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            viewMode === "cards"
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                        Vue cartes
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("table")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            viewMode === "table"
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                        Vue tableau
                    </button>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher (entreprise, contact, secteur, pays...)"
                    className="w-full h-10 pl-9 pr-8 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        <span className="text-sm">Chargement de la base de données...</span>
                    </div>
                </div>
            ) : filteredCompanies.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-200 rounded-2xl py-16 px-6 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-900">Aucune entreprise trouvée</p>
                    <p className="mt-1 text-xs text-slate-500">
                        Ajustez votre recherche ou réessayez plus tard.
                    </p>
                </div>
            ) : viewMode === "table" ? (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                    <th className="px-4 py-3 text-left">Entreprise</th>
                                    <th className="px-4 py-3 text-left">Secteur</th>
                                    <th className="px-4 py-3 text-left">Taille</th>
                                    <th className="px-4 py-3 text-left">Pays</th>
                                    <th className="px-4 py-3 text-left">Téléphone</th>
                                    <th className="px-4 py-3 text-left">Site web</th>
                                    <th className="px-4 py-3 text-left">Contacts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCompanies.map((company) => (
                                    <tr key={company.id} className="hover:bg-emerald-50/40 transition-colors">
                                        <td className="px-4 py-3 align-top">
                                            <div className="flex items-center gap-2 max-w-xs">
                                                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900 truncate">
                                                        {company.name}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-700">
                                            {company.industry || "-"}
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-700">
                                            {company.size || "-"}
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-700">
                                            {company.country || "-"}
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-700">
                                            {company.phone ? (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Phone className="w-3 h-3" />
                                                    {company.phone}
                                                </span>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-700">
                                            {company.website ? (
                                                <a
                                                    href={company.website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700"
                                                >
                                                    <Globe2 className="w-3 h-3" />
                                                    {company.website.replace(/^https?:\/\//, "")}
                                                </a>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-700">
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredCompanies.map((company) => (
                        <div
                            key={company.id}
                            className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100/60 transition-all"
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
        </div>
    );
}

