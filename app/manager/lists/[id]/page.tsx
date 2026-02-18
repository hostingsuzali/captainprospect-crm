"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, Badge, Button, DataTable, ConfirmModal, useToast } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import { CompanyDrawer, ContactDrawer } from "@/components/drawers";
import {
    ArrowLeft,
    List,
    Building2,
    Users,
    Edit,
    Trash2,
    Download,
    Mail,
    CheckCircle,
    AlertCircle,
    Clock,
    RefreshCw,
    Plus,
} from "lucide-react";
import Link from "next/link";

// ============================================
// TYPES
// ============================================

interface ListDetail {
    id: string;
    name: string;
    type: string;
    source: string;
    mission: {
        id: string;
        name: string;
        client: {
            name: string;
        };
    };
    _count: {
        companies: number;
    };
    createdAt: string;
    updatedAt: string;
}

interface Company {
    id: string;
    name: string;
    industry: string | null;
    country: string | null;
    website: string | null;
    phone: string | null;
    size: string | null;
    status: "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";
    // JSON blob storing any custom fields imported from CSV
    customData?: Record<string, any> | null;
    _count: {
        contacts: number;
    };
    contacts: Contact[];
}

interface Contact {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    title: string | null;
    linkedin: string | null;
    status: "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";
    companyId: string;
    companyName?: string;
}

// ============================================
// STATUS CONFIG
// ============================================

const STATUS_CONFIG = {
    INCOMPLETE: { label: "Incomplet", color: "text-red-500", bg: "bg-red-50", icon: AlertCircle },
    PARTIAL: { label: "Partiel", color: "text-amber-500", bg: "bg-amber-50", icon: Clock },
    ACTIONABLE: { label: "Actionnable", color: "text-emerald-500", bg: "bg-emerald-50", icon: CheckCircle },
};

// ============================================
// LIST DETAIL PAGE
// ============================================

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { data: session } = useSession();
    const router = useRouter();
    const { success, error: showError } = useToast();

    const isManager = session?.user?.role === "MANAGER";

    const [listId, setListId] = useState<string>("");
    const [list, setList] = useState<ListDetail | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [view, setView] = useState<"companies" | "contacts">("companies");

    // Drawer states
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [selectedContact, setSelectedContact] = useState<(Contact & { companyName: string }) | null>(null);
    const [showCompanyDrawer, setShowCompanyDrawer] = useState(false);
    const [showContactDrawer, setShowContactDrawer] = useState(false);
    const [isCreatingCompany, setIsCreatingCompany] = useState(false);
    const [isCreatingContact, setIsCreatingContact] = useState(false);

    // Resolve params
    useEffect(() => {
        params.then((p) => setListId(p.id));
    }, [params]);

    // ============================================
    // FETCH LIST
    // ============================================

    const fetchList = async () => {
        if (!listId) return;

        setIsLoading(true);
        try {
            const [listRes, companiesRes] = await Promise.all([
                fetch(`/api/lists/${listId}`),
                fetch(`/api/lists/${listId}/companies`),
            ]);

            const listJson = await listRes.json();
            const companiesJson = await companiesRes.json();

            if (listJson.success) {
                setList(listJson.data);
            } else {
                showError("Erreur", listJson.error || "Liste non trouvée");
                router.push("/manager/lists");
            }

            if (companiesJson.success) {
                setCompanies(companiesJson.data);
            }
        } catch (err) {
            console.error("Failed to fetch list:", err);
            showError("Erreur", "Impossible de charger la liste");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (listId) {
            fetchList();
        }
    }, [listId]);

    // ============================================
    // DRAWER HANDLERS
    // ============================================

    const handleCompanyClick = (company: Company) => {
        setSelectedCompany(company);
        setShowCompanyDrawer(true);
    };

    const handleContactClick = (contact: Contact & { companyName: string }) => {
        setSelectedContact(contact);
        setShowContactDrawer(true);
    };

    const handleCompanyUpdate = (updatedCompany: Company) => {
        setCompanies((prev) =>
            prev.map((c) => (c.id === updatedCompany.id ? { ...c, ...updatedCompany } : c))
        );
        setSelectedCompany((prev) => (prev?.id === updatedCompany.id ? { ...prev, ...updatedCompany } : prev));
        // Refresh list to update counts if needed
        if (updatedCompany._count.contacts !== selectedCompany?._count.contacts) {
            fetchList();
        }
    };

    const handleCompanyCreate = (newCompany: Company) => {
        setCompanies((prev) => [newCompany, ...prev]);
        fetchList(); // Refresh to update counts
    };

    const handleContactCreate = (newContact: Contact & { companyName: string }) => {
        // Find company and add contact
        setCompanies((prev) =>
            prev.map((company) => {
                if (company.id === newContact.companyId) {
                    return {
                        ...company,
                        contacts: [...company.contacts, newContact],
                        _count: {
                            contacts: company._count.contacts + 1,
                        },
                    };
                }
                return company;
            })
        );
        fetchList(); // Refresh to update counts
    };

    const handleContactUpdate = (updatedContact: Contact) => {
        // Update in companies list (nested)
        setCompanies((prev) =>
            prev.map((company) => {
                if (company.id === updatedContact.companyId) {
                    return {
                        ...company,
                        contacts: company.contacts.map((c) =>
                            c.id === updatedContact.id ? { ...c, ...updatedContact } : c
                        ),
                    };
                }
                return company;
            })
        );

        // Update selected contact if open
        if (selectedContact?.id === updatedContact.id) {
            setSelectedContact({
                ...updatedContact,
                companyName: selectedContact.companyName,
            });
        }

        // Update selected company's contacts if open
        if (selectedCompany && selectedCompany.id === updatedContact.companyId) {
            setSelectedCompany(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    contacts: prev.contacts.map(c => c.id === updatedContact.id ? updatedContact : c)
                }
            })
        }
    };

    // Handle contact click from inside CompanyDrawer
    const handleCompanyContactClick = (contact: Contact) => {
        if (!selectedCompany) return;

        setSelectedContact({
            ...contact,
            companyName: selectedCompany.name,
            companyId: selectedCompany.id
        });
        // We keep company drawer open but maybe overlay or switch? 
        // For better UX, let's close company and open contact, or just stack them.
        // Stacking might be complex with current implementation (one z-index).
        // Let's close company drawer and open contact drawer for now.
        setShowCompanyDrawer(false);
        setTimeout(() => setShowContactDrawer(true), 100);
    };

    // ============================================
    // DELETE LIST
    // ============================================

    const handleDelete = async () => {
        if (!list) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/lists/${list.id}`, {
                method: "DELETE",
            });

            const json = await res.json();

            if (json.success) {
                success("Liste supprimée", `${list.name} a été supprimée`);
                router.push("/manager/lists");
            } else {
                showError("Erreur", json.error);
            }
        } catch (err) {
            showError("Erreur", "Impossible de supprimer la liste");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    // ============================================
    // EXPORT CSV
    // ============================================

    const handleExport = () => {
        if (!list) return;
        window.location.href = `/api/lists/${list.id}/export`;
    };

    // ============================================
    // CUSTOM COMPANY FIELDS (FROM CSV IMPORT)
    // ============================================

    // Discover all custom field keys present in this list's companies
    const customCompanyFieldKeys = Array.from(
        new Set(
            companies.flatMap((company) =>
                company.customData ? Object.keys(company.customData) : []
            )
        )
    );

    const formatCustomFieldLabel = (key: string) => {
        // Convert snake_case / camelCase to "Title Case"
        const withSpaces = key
            .replace(/_/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2");
        return withSpaces
            .split(" ")
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    };

    // ============================================
    // COMPANY TABLE COLUMNS
    // ============================================

    const companyColumns: Column<Company>[] = [
        {
            key: "name",
            header: "Société",
            sortable: true,
            render: (_, company) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <p className="font-medium text-slate-900">{company.name}</p>
                        {company.website && (
                            <a
                                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-600 hover:underline"
                            >
                                {company.website}
                            </a>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: "industry",
            header: "Industrie",
            sortable: true,
            render: (value) => <span className="text-slate-600">{value || "—"}</span>,
        },
        {
            key: "country",
            header: "Pays",
            sortable: true,
            render: (value) => <span className="text-slate-600">{value || "—"}</span>,
        },
        {
            key: "phone",
            header: "Téléphone",
            sortable: true,
            render: (value) => (
                <span className="text-slate-600">
                    {value ? value : "—"}
                </span>
            ),
        },
        {
            key: "contacts",
            header: "Contacts",
            render: (_, company) => (
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700">{company._count.contacts}</span>
                </div>
            ),
        },
        {
            key: "status",
            header: "Statut",
            render: (value) => {
                const config = STATUS_CONFIG[value as keyof typeof STATUS_CONFIG];
                const Icon = config.icon;
                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                    </div>
                );
            },
        },
    ];

    // Dynamically build columns for any custom company fields imported from CSV
    const customCompanyColumns: Column<Company>[] = customCompanyFieldKeys.map((fieldKey) => ({
        key: `custom_${fieldKey}`,
        header: formatCustomFieldLabel(fieldKey),
        sortable: false,
        render: (_, company) => {
            const value = company.customData ? company.customData[fieldKey] : undefined;
            if (value === null || value === undefined || value === "") {
                return <span className="text-slate-400">—</span>;
            }
            return <span className="text-slate-600">{String(value)}</span>;
        },
    }));

    // ============================================
    // CONTACT TABLE COLUMNS
    // ============================================

    // Flatten contacts from all companies
    const allContacts: (Contact & { companyName: string })[] = companies.flatMap((company) =>
        company.contacts.map((contact) => ({
            ...contact,
            companyId: company.id,
            companyName: company.name,
        }))
    );

    const contactColumns: Column<Contact & { companyName: string }>[] = [
        {
            key: "firstName",
            header: "Contact",
            sortable: true,
            render: (_, contact) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Users className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <p className="font-medium text-slate-900">
                            {contact.firstName || ""} {contact.lastName || ""}
                        </p>
                        <p className="text-xs text-slate-500">{contact.title || "—"}</p>
                    </div>
                </div>
            ),
        },
        {
            key: "companyName",
            header: "Société",
            sortable: true,
            render: (value) => <span className="text-slate-700 font-medium">{value}</span>,
        },
        {
            key: "email",
            header: "Email",
            render: (value) => {
                if (!value) return <span className="text-slate-400">—</span>;
                if (!isManager) {
                    const [user, domain] = value.split("@");
                    return <span className="text-slate-500 font-mono text-xs">{user[0]}***@{domain}</span>;
                }
                return (
                    <a href={`mailto:${value}`} className="text-indigo-600 hover:underline text-sm">
                        {value}
                    </a>
                );
            },
        },
        {
            key: "phone",
            header: "Téléphone",
            render: (value) => {
                if (!value) return <span className="text-slate-400">—</span>;
                if (!isManager) {
                    return <span className="text-slate-500 font-mono text-xs">{value.substring(0, 3)}*******</span>;
                }
                return (
                    <a href={`tel:${value}`} className="text-slate-600 text-sm">
                        {value}
                    </a>
                );
            },
        },
        {
            key: "linkedin",
            header: "LinkedIn",
            render: (value) => {
                if (!value) return <span className="text-slate-400">—</span>;
                if (!isManager) {
                    return <span className="text-slate-500 font-mono text-xs">Profil masqué</span>;
                }
                return (
                    <a
                        href={value.startsWith("http") ? value : `https://${value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline text-sm"
                    >
                        Profil
                    </a>
                );
            },
        },
        {
            key: "status",
            header: "Statut",
            render: (value) => {
                const config = STATUS_CONFIG[value as keyof typeof STATUS_CONFIG];
                const Icon = config.icon;
                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                    </div>
                );
            },
        },
    ];

    // ============================================
    // LOADING STATE
    // ============================================

    if (isLoading || !list) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse" />
                    <div className="space-y-2">
                        <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
                        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <div className="h-16 bg-slate-200 rounded animate-pulse" />
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    const totalContacts = companies.reduce((acc, c) => acc + c._count.contacts, 0);
    const actionableCount = companies.filter((c) => c.status === "ACTIONABLE").length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Link href={isManager ? "/manager/lists" : "/sdr/lists"}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <List className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-extrabold text-slate-900">{list.name}</h1>
                            <Badge variant="outline">{list.type}</Badge>
                        </div>
                        <p className="text-slate-500 mt-1">
                            {list.mission.client.name} · {list.mission.name}
                            {list.source && ` · ${list.source}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={fetchList} title="Rafraîchir">
                        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                    {isManager && (
                        <>
                            <Button variant="secondary" size="sm" onClick={handleExport} className="gap-2">
                                <Download className="w-4 h-4" />
                                Exporter
                            </Button>
                            <Link href={`/manager/lists/${list.id}/edit`}>
                                <Button variant="secondary" size="sm" className="gap-2">
                                    <Edit className="w-4 h-4" />
                                    Modifier
                                </Button>
                            </Link>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDeleteModal(true)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{companies.length}</p>
                            <p className="text-sm text-slate-500">Sociétés</p>
                        </div>
                    </div>
                </Card>
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <Users className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{totalContacts}</p>
                            <p className="text-sm text-slate-500">Contacts</p>
                        </div>
                    </div>
                </Card>
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{actionableCount}</p>
                            <p className="text-sm text-slate-500">Actionnables</p>
                        </div>
                    </div>
                </Card>
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-cyan-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">
                                {companies.reduce((acc, c) => acc + c.contacts.filter((ct) => ct.email).length, 0)}
                            </p>
                            <p className="text-sm text-slate-500">Avec email</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Data Table */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">
                        {view === "companies" ? "Sociétés" : "Contacts"}
                    </h2>
                    <div className="flex items-center gap-2">
                        {isManager && (
                            <>
                                {view === "companies" ? (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            setIsCreatingCompany(true);
                                            setSelectedCompany(null);
                                            setShowCompanyDrawer(true);
                                        }}
                                        className="gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Ajouter une société
                                    </Button>
                                ) : (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            setIsCreatingContact(true);
                                            setSelectedContact(null);
                                            setShowContactDrawer(true);
                                        }}
                                        className="gap-2"
                                        disabled={companies.length === 0}
                                    >
                                        <Plus className="w-4 h-4" />
                                        Ajouter un contact
                                    </Button>
                                )}
                            </>
                        )}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        <button
                            onClick={() => setView("companies")}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "companies"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            <Building2 className="w-4 h-4" />
                            Sociétés ({companies.length})
                        </button>
                        <button
                            onClick={() => setView("contacts")}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "contacts"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            <Users className="w-4 h-4" />
                            Contacts ({totalContacts})
                        </button>
                        </div>
                    </div>
                </div>

                {view === "companies" ? (
                    companies.length === 0 ? (
                        <div className="text-center py-12">
                            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-700">Aucune société</h3>
                            <p className="text-slate-500 mt-1">
                                Cette liste est vide. Importez des données pour commencer.
                            </p>
                        </div>
                    ) : (
                        <DataTable
                            data={companies}
                            columns={[...companyColumns, ...customCompanyColumns]}
                            keyField="id"
                            searchable
                            searchPlaceholder="Rechercher une société..."
                            searchFields={["name", "industry", "country"]}
                            pagination
                            pageSize={15}
                            onRowClick={handleCompanyClick}
                        />
                    )
                ) : (
                    allContacts.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-700">Aucun contact</h3>
                            <p className="text-slate-500 mt-1">
                                Aucun contact dans cette liste.
                            </p>
                        </div>
                    ) : (
                        <DataTable
                            data={allContacts}
                            columns={contactColumns}
                            keyField="id"
                            searchable
                            searchPlaceholder="Rechercher un contact..."
                            searchFields={["firstName", "lastName", "email", "companyName"]}
                            pagination
                            pageSize={15}
                            onRowClick={handleContactClick}
                        />
                    )
                )}
            </Card>

            {/* Company Drawer */}
            <CompanyDrawer
                isOpen={showCompanyDrawer}
                onClose={() => {
                    setShowCompanyDrawer(false);
                    setIsCreatingCompany(false);
                    setSelectedCompany(null);
                }}
                company={selectedCompany}
                onUpdate={handleCompanyUpdate}
                onCreate={isCreatingCompany ? handleCompanyCreate : undefined}
                onContactClick={handleCompanyContactClick}
                isManager={isManager}
                listId={listId}
                isCreating={isCreatingCompany}
            />

            {/* Contact Drawer */}
            <ContactDrawer
                isOpen={showContactDrawer}
                onClose={() => {
                    setShowContactDrawer(false);
                    setIsCreatingContact(false);
                    setSelectedContact(null);
                }}
                contact={selectedContact}
                onUpdate={handleContactUpdate}
                onCreate={isCreatingContact ? handleContactCreate : undefined}
                isManager={isManager}
                listId={listId}
                companies={companies}
                isCreating={isCreatingContact}
            />

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Supprimer la liste ?"
                message={`Êtes-vous sûr de vouloir supprimer "${list.name}" ? Cette action supprimera également toutes les sociétés et contacts associés.`}
                confirmText="Supprimer"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
