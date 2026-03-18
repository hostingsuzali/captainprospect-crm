"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Select, FileUpload, useToast, Modal, Input, Badge, Tooltip } from "@/components/ui";
import {
    ArrowLeft,
    ArrowRight,
    Upload,
    Check,
    Loader2,
    FileText,
    AlertCircle,
    CheckCircle2,
    Table,
    Building2,
    User,
    XCircle,
    Sparkles,
    Search,
    RotateCcw,
    Save,
    ChevronDown,
    ChevronRight,
    Info,
    TrendingUp,
    Database,
    Mail,
    Phone,
    Globe,
    MapPin,
    Briefcase,
    Users,
    Calendar,
    History,
} from "lucide-react";
import Link from "next/link";
import { ACTION_RESULT_LABELS } from "@/lib/types";

// ============================================
// TYPES
// ============================================

interface Mission {
    id: string;
    name: string;
}

interface ListOption {
    id: string;
    name: string;
    missionId: string;
}

interface ColumnMapping {
    csvColumn: string;
    targetField: string;
    confidence?: number;
    autoDetected?: boolean;
}

interface ColumnStats {
    column: string;
    totalRows: number;
    filledRows: number;
    uniqueValues: number;
    dataType: 'text' | 'email' | 'phone' | 'url' | 'number' | 'date';
    sampleValues: string[];
}

interface StatusMapping {
    csvValue: string;
    actionResult: string;
    count: number;
}

interface ChannelMapping {
    csvValue: string;
    channel: 'CALL' | 'EMAIL' | 'LINKEDIN';
    count: number;
}

interface ActionColumnMapping {
    statusColumn: string;
    dateColumn: string;
    noteColumn: string;
    channelColumn: string;
}

interface PreviewRow {
    [key: string]: string;
}

// ============================================
// FIELD OPTIONS
// ============================================

const COMPANY_FIELDS = [
    { value: "", label: "Ignorer" },
    { value: "company.name", label: "Nom de société *" },
    { value: "company.industry", label: "Industrie" },
    { value: "company.country", label: "Pays" },
    { value: "company.website", label: "Site web" },
    { value: "company.phone", label: "Téléphone société" },
    { value: "company.additionalPhones", label: "Téléphones société (suppl.)" },
    { value: "company.size", label: "Taille" },
    { value: "__custom_company__", label: "➕ Champ personnalisé société..." },
];

const CONTACT_FIELDS = [
    { value: "contact.firstName", label: "Prénom" },
    { value: "contact.lastName", label: "Nom" },
    { value: "contact.email", label: "Email" },
    { value: "contact.phone", label: "Téléphone" },
     { value: "contact.additionalPhones", label: "Téléphones (suppl.)" },
    { value: "contact.title", label: "Fonction" },
    { value: "contact.linkedin", label: "LinkedIn" },
    { value: "__custom_contact__", label: "➕ Champ personnalisé contact..." },
];

const ALL_FIELDS = [...COMPANY_FIELDS, ...CONTACT_FIELDS];

// Count lines in file by streaming (avoids loading full file; used for progress %)
async function countFileLines(file: File): Promise<number> {
    const stream = file.stream();
    const reader = stream.getReader();
    const dec = new TextDecoder();
    let count = 0;
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() ?? "";
        count += parts.length;
    }
    if (buffer.trim()) count++;
    return Math.max(0, count - 1);
}

// ============================================
// CSV IMPORT PAGE
// ============================================

export default function ImportListPage() {
    const router = useRouter();
    const { success, error: showError } = useToast();

    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    // Step 1: File & Mission
    const [file, setFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<"new" | "existing">("new");
    const [missionId, setMissionId] = useState("");
    const [listName, setListName] = useState("");
    const [listId, setListId] = useState("");
    const [lists, setLists] = useState<ListOption[]>([]);
    const [whenAlreadyWorkedOn, setWhenAlreadyWorkedOn] = useState<"skip" | "add_anyway">("skip");

    // Step 2: Import Type Selection
    const [importType, setImportType] = useState<"companies-only" | "companies-contacts">("companies-contacts");

    // Step 3: Column mapping
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [mappings, setMappings] = useState<ColumnMapping[]>([]);
    const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
    const [totalRows, setTotalRows] = useState(0);
    const [columnStats, setColumnStats] = useState<ColumnStats[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['company', 'contact']));
    const [showQualityReport, setShowQualityReport] = useState(false);
    
    // Action history import
    const [importActions, setImportActions] = useState(false);
    const [actionColumnMapping, setActionColumnMapping] = useState<ActionColumnMapping>({
        statusColumn: "",
        dateColumn: "",
        noteColumn: "",
        channelColumn: "",
    });
    const [statusMappings, setStatusMappings] = useState<StatusMapping[]>([]);
    const [detectedStatuses, setDetectedStatuses] = useState<string[]>([]);
    const [detectedChannels, setDetectedChannels] = useState<string[]>([]);
    const [channelMappings, setChannelMappings] = useState<ChannelMapping[]>([]);
    /** Per-column unique values and counts from ALL rows (used for status/channel mapping) */
    const [fullColumnUniqueValues, setFullColumnUniqueValues] = useState<Record<string, { values: string[]; counts: Record<string, number> }>>({});

    // Step 4: Validation
    const [validationResult, setValidationResult] = useState<{
        valid: number;
        errors: string[];
        warnings: string[];
    } | null>(null);

    // Step 5: Import result
    const [importResult, setImportResult] = useState<{
        companies: number;
        contacts: number;
        actions?: number;
        errors: number;
    } | null>(null);

    const [importProgress, setImportProgress] = useState<number | null>(null);

    // Custom field modal state
    const [customFieldPrompt, setCustomFieldPrompt] = useState<{
        index: number;
        type: "company" | "contact";
    } | null>(null);
    const [customFieldValue, setCustomFieldValue] = useState("");

    // ============================================
    // FETCH MISSIONS
    // ============================================

    useEffect(() => {
        const fetchMissions = async () => {
            setIsLoading(true);
            try {
                const res = await fetch("/api/missions?isActive=true");
                const json = await res.json();
                if (json.success) {
                    setMissions(json.data);
                }
            } catch (err) {
                console.error("Failed to fetch missions:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMissions();
    }, []);

    // Fetch lists when mission changes (for "add to existing list")
    useEffect(() => {
        if (importMode !== "existing" || !missionId) {
            setLists([]);
            setListId("");
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/lists?missionId=${missionId}&limit=200`);
                const json = await res.json();
                if (cancelled || !json.success) return;
                const items = (json.data ?? []) as { id: string; name: string; missionId: string }[];
                setLists(items);
                setListId((prev) => (items.some((l) => l.id === prev) ? prev : items[0]?.id ?? ""));
            } catch {
                if (!cancelled) setLists([]);
            }
        })();
        return () => { cancelled = true; };
    }, [importMode, missionId]);

    // Detect unique status values when status column is selected (uses ALL rows, not just preview)
    useEffect(() => {
        const col = actionColumnMapping.statusColumn;
        if (!col) {
            setDetectedStatuses([]);
            setStatusMappings([]);
            return;
        }
        const data = fullColumnUniqueValues[col];
        if (data && data.values.length > 0) {
            setDetectedStatuses(data.values);
            setStatusMappings(data.values.map(csvValue => ({
                csvValue,
                actionResult: "",
                count: data.counts[csvValue] || 0
            })));
        } else {
            setDetectedStatuses([]);
            setStatusMappings([]);
        }
    }, [actionColumnMapping.statusColumn, fullColumnUniqueValues]);

    // Detect unique channel values when channel column is selected (uses ALL rows, not just preview)
    useEffect(() => {
        const col = actionColumnMapping.channelColumn;
        if (!col) {
            setDetectedChannels([]);
            setChannelMappings([]);
            return;
        }
        const data = fullColumnUniqueValues[col];
        if (data && data.values.length > 0) {
            setDetectedChannels(data.values);
            setChannelMappings(data.values.map(csvValue => ({
                csvValue,
                channel: 'CALL',
                count: data.counts[csvValue] || 0
            })));
        } else {
            setDetectedChannels([]);
            setChannelMappings([]);
        }
    }, [actionColumnMapping.channelColumn, fullColumnUniqueValues]);

    // ============================================
    // ADVANCED CSV PARSING
    // ============================================

    const parseCSVLine = (line: string, delimiter: string = ','): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                // End of field
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        // Add last field
        result.push(current.trim());
        return result;
    };

    const detectDelimiter = (firstLine: string): string => {
        const delimiters = [',', ';', '\t', '|'];
        let maxCount = 0;
        let detectedDelimiter = ',';

        for (const delim of delimiters) {
            const count = (firstLine.match(new RegExp(`\\${delim}`, 'g')) || []).length;
            if (count > maxCount) {
                maxCount = count;
                detectedDelimiter = delim;
            }
        }

        return detectedDelimiter;
    };

    const parseCSV = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/).filter(line => line.trim());

            if (lines.length < 2) {
                showError("Erreur", "Le fichier CSV doit contenir au moins une ligne d'en-tête et une ligne de données");
                return;
            }

            // Detect delimiter
            const delimiter = detectDelimiter(lines[0]);

            // Parse headers with advanced parsing
            const headers = parseCSVLine(lines[0], delimiter).map(h => h.replace(/^"|"$/g, ''));
            setCsvHeaders(headers);

            // Initialize mappings with auto-detect (FIXED: More specific patterns first)
            const autoMappings = headers.map(header => {
                const lowerHeader = header.toLowerCase();
                let targetField = "";

                // Auto-detect common fields - CHECK SPECIFIC PATTERNS FIRST
                // Company phone (before generic company check)
                if ((lowerHeader.includes("phone") || lowerHeader.includes("téléphone") || lowerHeader.includes("tel")) &&
                    (lowerHeader.includes("company") || lowerHeader.includes("société") || lowerHeader.includes("entreprise"))) {
                    targetField = "company.phone";
                }
                // Company size
                else if (lowerHeader.includes("size") || lowerHeader.includes("taille") ||
                    lowerHeader.includes("employees") || lowerHeader.includes("employés")) {
                    targetField = "company.size";
                }
                // Generic company name (after specific company fields)
                else if (lowerHeader.includes("company") || lowerHeader.includes("société") || lowerHeader.includes("entreprise") || lowerHeader.includes("organization")) {
                    targetField = "company.name";
                }
                else if (lowerHeader.includes("industry") || lowerHeader.includes("secteur") || lowerHeader.includes("industrie")) {
                    targetField = "company.industry";
                }
                else if (lowerHeader.includes("country") || lowerHeader.includes("pays")) {
                    targetField = "company.country";
                }
                else if (lowerHeader.includes("website") || lowerHeader.includes("site") || lowerHeader.includes("url")) {
                    targetField = "company.website";
                }
                // Contact fields
                else if (lowerHeader.includes("firstname") || lowerHeader.includes("prénom") || lowerHeader === "first name" || lowerHeader === "prenom") {
                    targetField = "contact.firstName";
                }
                else if (lowerHeader.includes("lastname") || lowerHeader === "nom" || lowerHeader === "last name" || lowerHeader.includes("surname")) {
                    targetField = "contact.lastName";
                }
                else if (lowerHeader.includes("email") || lowerHeader.includes("mail") || lowerHeader.includes("e-mail")) {
                    targetField = "contact.email";
                }
                else if (lowerHeader.includes("phone") || lowerHeader.includes("téléphone") || lowerHeader.includes("tel") || lowerHeader.includes("mobile")) {
                    targetField = "contact.phone";
                }
                else if (lowerHeader.includes("title") || lowerHeader.includes("fonction") || lowerHeader.includes("poste") || lowerHeader.includes("job")) {
                    targetField = "contact.title";
                }
                else if (lowerHeader.includes("linkedin")) {
                    targetField = "contact.linkedin";
                }

                return { csvColumn: header, targetField };
            });

            setMappings(autoMappings);

            // Parse preview data (first 5 rows) with advanced parsing
            const dataRows = lines.slice(1, 6).map(line => {
                const values = parseCSVLine(line, delimiter).map(v => v.replace(/^"|"$/g, ''));
                const row: PreviewRow = {};
                headers.forEach((header, i) => {
                    row[header] = values[i] || "";
                });
                return row;
            });

            setPreviewData(dataRows);

            // Scan ALL rows to build unique values + counts per column (for status/channel mapping)
            const colUnique: Record<string, { values: string[]; counts: Record<string, number> }> = {};
            headers.forEach(h => { colUnique[h] = { values: [], counts: {} }; });
            for (let r = 1; r < lines.length; r++) {
                const values = parseCSVLine(lines[r], delimiter).map(v => v.replace(/^"|"$/g, '').trim());
                headers.forEach((header, i) => {
                    const val = values[i] || "";
                    if (!val) return;
                    const existing = colUnique[header].counts[val];
                    if (existing === undefined) {
                        colUnique[header].values.push(val);
                        colUnique[header].counts[val] = 1;
                    } else {
                        colUnique[header].counts[val]++;
                    }
                });
            }
            headers.forEach(h => { colUnique[h].values.sort(); });
            setFullColumnUniqueValues(colUnique);

            // Set total row count for validation
            setTotalRows(lines.length - 1);

            // Auto-generate list name from file
            if (!listName) {
                const name = file.name.replace(/\.csv$/i, '').replace(/[_-]/g, ' ');
                setListName(name);
            }
        };
        reader.readAsText(file);
    }, [listName, showError]);

    // ============================================
    // HANDLE FILE SELECTION
    // ============================================

    const handleFileSelected = (files: File[]) => {
        if (files.length > 0) {
            setFile(files[0]);
            parseCSV(files[0]);
        }
    };

    // ============================================
    // VALIDATE DATA
    // ============================================

    const validateData = () => {
        const hasCompanyName = mappings.some(m => m.targetField === "company.name");
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!hasCompanyName) {
            errors.push("Le champ 'Nom de société' est obligatoire");
        }

        // Check for duplicate mappings
        const usedFields = new Map<string, string>();
        for (const mapping of mappings) {
            if (mapping.targetField && mapping.targetField !== "" &&
                !mapping.targetField.startsWith("__custom")) {
                const existing = usedFields.get(mapping.targetField);
                if (existing) {
                    errors.push(`Le champ "${mapping.targetField}" est mappé à la fois par "${existing}" et "${mapping.csvColumn}"`);
                } else {
                    usedFields.set(mapping.targetField, mapping.csvColumn);
                }
            }
        }

        if (importType === "companies-contacts") {
            const hasContact = mappings.some(m => m.targetField.startsWith("contact."));
            if (!hasContact) {
                warnings.push("Aucun champ contact mappé - seules les sociétés seront importées");
            }

            const hasEmail = mappings.some(m => m.targetField === "contact.email");
            if (hasContact && !hasEmail) {
                warnings.push("Pas d'email mappé - les contacts ne pourront pas être enrichis");
            }
        }

        // Check for company phone if companies-only
        if (importType === "companies-only") {
            const hasCompanyPhone = mappings.some(m => m.targetField === "company.phone");
            if (!hasCompanyPhone) {
                warnings.push("Aucun téléphone société mappé - les SDR ne pourront pas appeler directement les sociétés");
            }
        }

        // Validation for action history import: require full mapping of detected statuses
        if (importActions) {
            if (!actionColumnMapping.statusColumn) {
                errors.push("Vous avez activé l'historique d'actions mais aucune colonne de statut n'est sélectionnée");
            } else if (statusMappings.length > 0 && statusMappings.some(m => !m.actionResult)) {
                errors.push("Tous les statuts trouvés dans la colonne d'historique doivent être mappés à un résultat CRM");
            }
        }

        setValidationResult({
            valid: errors.length === 0 ? totalRows : 0, // FIXED: Use totalRows instead of previewData.length
            errors,
            warnings,
        });

        if (errors.length === 0) {
            setStep(4);
        }
    };

    // ============================================
    // IMPORT DATA
    // ============================================

    const handleImport = async () => {
        if (!file) return;

        setIsImporting(true);
        setImportProgress(0);

        try {
            const totalRows = await countFileLines(file);
            const formData = new FormData();
            formData.append("file", file);
            if (importMode === "existing" && listId) {
                formData.append("listId", listId);
                formData.append("whenAlreadyWorkedOn", whenAlreadyWorkedOn);
            } else {
                formData.append("missionId", missionId);
                formData.append("listName", listName);
            }
            formData.append("mappings", JSON.stringify(mappings));
            formData.append("importType", importType);
            formData.append("importActions", String(importActions));
            formData.append("actionColumnMapping", JSON.stringify(actionColumnMapping));
            formData.append("statusMappings", JSON.stringify(statusMappings));
            formData.append("channelMappings", JSON.stringify(channelMappings));
            if (totalRows > 0) formData.append("totalRows", String(totalRows));

            const res = await fetch("/api/lists/import", {
                method: "POST",
                body: formData,
            });

            if (!res.ok || !res.body) {
                const json = await res.json().catch(() => ({}));
                showError("Erreur", (json as { error?: string }).error || "L'import a échoué");
                return;
            }

            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buffer = "";
            let doneData: { companiesCreated: number; contactsCreated: number; actionsCreated?: number; errors: number } | null = null;
            let errorMsg: string | null = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += dec.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const msg = JSON.parse(trimmed) as {
                            type: string;
                            percent?: number;
                            data?: { companiesCreated: number; contactsCreated: number; actionsCreated?: number; errors: number };
                            error?: string;
                        };
                        if (msg.type === "progress" && msg.percent != null) setImportProgress(msg.percent);
                        if (msg.type === "done" && msg.data) doneData = msg.data;
                        if (msg.type === "error" && msg.error) errorMsg = msg.error;
                    } catch {
                        // ignore malformed lines
                    }
                }
            }

            if (errorMsg) {
                showError("Erreur", errorMsg);
            } else if (doneData) {
                setImportProgress(100);
                setImportResult({
                    companies: doneData.companiesCreated,
                    contacts: doneData.contactsCreated,
                    actions: doneData.actionsCreated,
                    errors: doneData.errors,
                });
                setStep(5);
                success("Import réussi", `${doneData.companiesCreated} sociétés et ${doneData.contactsCreated} contacts importés`);
            } else {
                showError("Erreur", "Réponse invalide");
            }
        } catch (err) {
            console.error("Import failed:", err);
            showError("Erreur", "L'import a échoué");
        } finally {
            setIsImporting(false);
            setImportProgress(null);
        }
    };

    // ============================================
    // STEP INDICATORS
    // ============================================

    const steps = [
        { num: 1, label: "Fichier", icon: Upload },
        { num: 2, label: "Type", icon: Building2 },
        { num: 3, label: "Mapping", icon: ArrowRight },
        { num: 4, label: "Validation", icon: CheckCircle2 },
        { num: 5, label: "Import", icon: Database },
    ];

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/manager/lists">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Importer CSV</h1>
                    <p className="text-slate-500 mt-1">
                        Importez des sociétés et contacts depuis un fichier CSV
                    </p>
                </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-between">
                {steps.map((s, i) => (
                    <div key={s.num} className="flex items-center">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${step >= s.num
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-slate-100 text-slate-500"
                            }`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > s.num
                                ? "bg-indigo-500 text-white"
                                : step === s.num
                                    ? "bg-indigo-500 text-white"
                                    : "bg-slate-300 text-slate-600"
                                }`}>
                                {step > s.num ? <Check className="w-3 h-3" /> : s.num}
                            </span>
                            <span className="text-sm font-medium">{s.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`w-12 h-0.5 mx-2 ${step > s.num ? "bg-indigo-500" : "bg-slate-200"
                                }`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Step 1: File & Mission Selection */}
            {step === 1 && (
                <Card>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Destination
                            </label>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setImportMode("new")}
                                    className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${importMode === "new"
                                        ? "border-indigo-500 bg-indigo-50"
                                        : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                >
                                    <span className="font-semibold text-slate-900">Nouvelle liste</span>
                                    <p className="text-sm text-slate-500 mt-1">Créer une nouvelle liste dans la mission</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setImportMode("existing")}
                                    className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${importMode === "existing"
                                        ? "border-indigo-500 bg-indigo-50"
                                        : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                >
                                    <span className="font-semibold text-slate-900">Ajouter à une liste existante</span>
                                    <p className="text-sm text-slate-500 mt-1">Mapper les colonnes et fusionner avec la liste</p>
                                </button>
                            </div>
                        </div>

                        <Select
                            label="Mission *"
                            placeholder="Sélectionner une mission..."
                            options={missions.map(m => ({ value: m.id, label: m.name }))}
                            value={missionId}
                            onChange={(v) => { setMissionId(v); setListId(""); }}
                            searchable
                        />

                        {importMode === "new" ? (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Nom de la liste *
                                </label>
                                <input
                                    type="text"
                                    value={listName}
                                    onChange={(e) => setListName(e.target.value)}
                                    placeholder="Ex: Liste CSV Mars 2025"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                        ) : (
                            <>
                                <Select
                                    label="Liste existante *"
                                    placeholder={missionId ? "Choisir une liste..." : "Sélectionnez d'abord une mission"}
                                    options={lists.map(l => ({ value: l.id, label: l.name }))}
                                    value={listId}
                                    onChange={setListId}
                                    searchable
                                    disabled={!missionId || lists.length === 0}
                                />
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Si la société existe déjà et a déjà été travaillée
                                    </label>
                                    <select
                                        value={whenAlreadyWorkedOn}
                                        onChange={(e) => setWhenAlreadyWorkedOn(e.target.value as "skip" | "add_anyway")}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="skip">Ignorer la ligne (ne pas ajouter)</option>
                                        <option value="add_anyway">Ajouter quand même (nouveaux contacts possibles)</option>
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">
                                        « Déjà travaillée » = la société a au moins une action enregistrée.
                                    </p>
                                </div>
                            </>
                        )}

                        <FileUpload
                            label="Fichier CSV *"
                            accept=".csv"
                            maxSize={10}
                            onFilesSelected={handleFileSelected}
                        />

                        <div className="flex justify-end">
                            <Button
                                variant="primary"
                                onClick={() => setStep(2)}
                                disabled={
                                    !file ||
                                    !missionId ||
                                    (importMode === "new" ? !listName?.trim() : !listId)
                                }
                                className="gap-2"
                            >
                                Suivant
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Step 2: Import Type Selection */}
            {step === 2 && (
                <Card>
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 mb-2">Type d'import</h2>
                            <p className="text-sm text-slate-500">
                                Choisissez ce que vous souhaitez importer depuis votre fichier CSV
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => setImportType("companies-only")}
                                className={`p-6 rounded-xl border-2 transition-all text-left ${importType === "companies-only"
                                    ? "border-indigo-500 bg-indigo-50"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${importType === "companies-only"
                                        ? "bg-indigo-100 text-indigo-600"
                                        : "bg-slate-100 text-slate-400"
                                        }`}>
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-900 mb-1">Sociétés uniquement</h3>
                                        <p className="text-sm text-slate-600">
                                            Importez uniquement les sociétés. Les SDR pourront appeler directement les sociétés qui ont un numéro de téléphone.
                                        </p>
                                    </div>
                                    {importType === "companies-only" && (
                                        <Check className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                                    )}
                                </div>
                            </button>

                            <button
                                onClick={() => setImportType("companies-contacts")}
                                className={`p-6 rounded-xl border-2 transition-all text-left ${importType === "companies-contacts"
                                    ? "border-indigo-500 bg-indigo-50"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${importType === "companies-contacts"
                                        ? "bg-indigo-100 text-indigo-600"
                                        : "bg-slate-100 text-slate-400"
                                        }`}>
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-900 mb-1">Sociétés + Contacts</h3>
                                        <p className="text-sm text-slate-600">
                                            Importez les sociétés avec leurs contacts associés. Permet un ciblage plus précis.
                                        </p>
                                    </div>
                                    {importType === "companies-contacts" && (
                                        <Check className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                                    )}
                                </div>
                            </button>
                        </div>

                        <div className="flex justify-between">
                            <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Retour
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => setStep(3)}
                                className="gap-2"
                            >
                                Suivant
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Step 3: Column Mapping */}
            {step === 3 && (
                <Card>
                    <div className="space-y-6">
                        {/* Header with Stats */}
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    Mapper les colonnes
                                    <Badge variant="primary" className="text-xs">
                                        {mappings.filter(m => m.targetField && m.targetField !== "").length}/{csvHeaders.length} mappées
                                    </Badge>
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    Associez chaque colonne CSV à un champ de données
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Tooltip content="Détection automatique basée sur les noms de colonnes">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-lg">
                                        <Sparkles className="w-4 h-4 text-indigo-500" />
                                        <span className="text-sm font-medium text-indigo-700">Auto-détecté</span>
                                    </div>
                                </Tooltip>
                            </div>
                        </div>

                        {/* Bulk Actions Toolbar */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher une colonne..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setMappings(mappings.map(m => ({ ...m, targetField: "" })));
                                    }}
                                    className="gap-2"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Réinitialiser
                                </Button>
                            </div>

                            {/* Action history toggle */}
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <History className="w-4 h-4 text-slate-500" />
                                        <p className="text-sm font-medium text-slate-900">Prospects déjà travaillés ?</p>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Activez cette option pour importer l&apos;historique des statuts (appels, emails, LinkedIn) depuis votre CSV.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setImportActions(!importActions)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${importActions ? "bg-indigo-600" : "bg-slate-300"}`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${importActions ? "translate-x-5" : ""}`}
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {mappings
                                .filter(m => !searchQuery || m.csvColumn.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map((mapping, i) => {
                                const availableFields = importType === "companies-only" ? [...COMPANY_FIELDS] : [...ALL_FIELDS];
                                const currentTarget = mapping.targetField;
                                const isCustomCompany = currentTarget.startsWith("company.") && !COMPANY_FIELDS.some(f => f.value === currentTarget);
                                const isCustomContact = currentTarget.startsWith("contact.") && !CONTACT_FIELDS.some(f => f.value === currentTarget);

                                if (isCustomCompany) {
                                    availableFields.push({ value: currentTarget, label: `Société (Perso): ${currentTarget.replace('company.', '')}` });
                                }
                                if (isCustomContact) {
                                    availableFields.push({ value: currentTarget, label: `Contact (Perso): ${currentTarget.replace('contact.', '')}` });
                                }

                                const getFieldIcon = () => {
                                    if (currentTarget.startsWith("company.")) return <Building2 className="w-4 h-4 text-blue-500" />;
                                    if (currentTarget.startsWith("contact.")) return <User className="w-4 h-4 text-purple-500" />;
                                    return null;
                                };

                                return (
                                    <div key={mapping.csvColumn} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-semibold text-slate-900">{mapping.csvColumn}</p>
                                                {currentTarget && getFieldIcon()}
                                            </div>
                                            <p className="text-xs text-slate-500 truncate">
                                                Exemple: {previewData[0]?.[mapping.csvColumn] || "—"}
                                            </p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                        <Select
                                            options={availableFields}
                                            value={mapping.targetField}
                                            onChange={(value) => {
                                                const newMappings = [...mappings];
                                                const actualIndex = mappings.findIndex(m => m.csvColumn === mapping.csvColumn);
                                                if (value === "__custom_company__") {
                                                    setCustomFieldPrompt({ index: actualIndex, type: 'company' });
                                                    setCustomFieldValue("");
                                                } else if (value === "__custom_contact__") {
                                                    setCustomFieldPrompt({ index: actualIndex, type: 'contact' });
                                                    setCustomFieldValue("");
                                                } else {
                                                    newMappings[actualIndex].targetField = value;
                                                    setMappings(newMappings);
                                                }
                                            }}
                                            className="w-56 flex-shrink-0"
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Action history configuration */}
                        {importActions && (
                            <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                        Historique des actions
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Configurez les colonnes pour reconstruire l&apos;historique des statuts et des notes de vos prospects.
                                    </p>
                                </div>

                                {/* Column selectors */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-slate-700">Colonne statut</p>
                                        <Select
                                            options={[
                                                { value: "", label: "Ignorer" },
                                                ...csvHeaders.map(h => ({ value: h, label: h })),
                                            ]}
                                            value={actionColumnMapping.statusColumn}
                                            onChange={(value) =>
                                                setActionColumnMapping(prev => ({ ...prev, statusColumn: value }))
                                            }
                                        />
                                        <p className="text-xs text-slate-500">
                                            Valeurs comme &quot;Tentative&quot;, &quot;Meeting booké&quot;, etc.
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-slate-700">Colonne date</p>
                                        <Select
                                            options={[
                                                { value: "", label: "Ignorer" },
                                                ...csvHeaders.map(h => ({ value: h, label: h })),
                                            ]}
                                            value={actionColumnMapping.dateColumn}
                                            onChange={(value) =>
                                                setActionColumnMapping(prev => ({ ...prev, dateColumn: value }))
                                            }
                                        />
                                        <p className="text-xs text-slate-500">
                                            Date à laquelle l&apos;action a eu lieu (optionnel).
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-slate-700">Colonne note</p>
                                        <Select
                                            options={[
                                                { value: "", label: "Ignorer" },
                                                ...csvHeaders.map(h => ({ value: h, label: h })),
                                            ]}
                                            value={actionColumnMapping.noteColumn}
                                            onChange={(value) =>
                                                setActionColumnMapping(prev => ({ ...prev, noteColumn: value }))
                                            }
                                        />
                                        <p className="text-xs text-slate-500">
                                            Notes d&apos;appel ou commentaires (optionnel).
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-slate-700">Colonne canal</p>
                                        <Select
                                            options={[
                                                { value: "", label: "Ignorer" },
                                                ...csvHeaders.map(h => ({ value: h, label: h })),
                                            ]}
                                            value={actionColumnMapping.channelColumn}
                                            onChange={(value) =>
                                                setActionColumnMapping(prev => ({ ...prev, channelColumn: value }))
                                            }
                                        />
                                        <p className="text-xs text-slate-500">
                                            Canal utilisé (téléphone, email, LinkedIn). Par défaut: Appel.
                                        </p>
                                    </div>
                                </div>

                                {/* Status mappings */}
                                {detectedStatuses.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-medium text-slate-700">
                                                Mapping des statuts CSV vers les résultats CRM
                                            </p>
                                            {statusMappings.some(m => !m.actionResult) && (
                                                <span className="text-[11px] text-amber-600">
                                                    Certains statuts ne sont pas encore mappés
                                                </span>
                                            )}
                                        </div>
                                        <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Statut CSV</th>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Occurrences</th>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Résultat CRM</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {statusMappings.map((m, idx) => (
                                                        <tr key={m.csvValue} className="border-t border-slate-100">
                                                            <td className="px-3 py-1.5 text-slate-900">{m.csvValue}</td>
                                                            <td className="px-3 py-1.5 text-slate-500">{m.count}</td>
                                                            <td className="px-3 py-1.5">
                                                                <Select
                                                                    options={Object.entries(ACTION_RESULT_LABELS).map(([value, label]) => ({
                                                                        value,
                                                                        label,
                                                                    }))}
                                                                    value={m.actionResult}
                                                                    onChange={(value) => {
                                                                        const next = [...statusMappings];
                                                                        next[idx] = { ...next[idx], actionResult: value };
                                                                        setStatusMappings(next);
                                                                    }}
                                                                    className="w-52"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Channel mappings (optional) */}
                                {actionColumnMapping.channelColumn && detectedChannels.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-slate-700">
                                            Mapping des valeurs de canal vers les canaux CRM
                                        </p>
                                        <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Canal CSV</th>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Occurrences</th>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Canal CRM</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {channelMappings.map((m, idx) => (
                                                        <tr key={m.csvValue} className="border-t border-slate-100">
                                                            <td className="px-3 py-1.5 text-slate-900">{m.csvValue}</td>
                                                            <td className="px-3 py-1.5 text-slate-500">{m.count}</td>
                                                            <td className="px-3 py-1.5">
                                                                <Select
                                                                    options={[
                                                                        { value: 'CALL', label: 'Appel' },
                                                                        { value: 'EMAIL', label: 'Email' },
                                                                        { value: 'LINKEDIN', label: 'LinkedIn' },
                                                                    ]}
                                                                    value={m.channel}
                                                                    onChange={(value) => {
                                                                        const next = [...channelMappings];
                                                                        next[idx] = { ...next[idx], channel: value as 'CALL' | 'EMAIL' | 'LINKEDIN' };
                                                                        setChannelMappings(next);
                                                                    }}
                                                                    className="w-40"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Preview */}
                        <div>
                            <h3 className="text-sm font-medium text-slate-700 mb-2">Aperçu des données</h3>
                            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50">
                                            {csvHeaders.slice(0, 5).map(h => (
                                                <th key={h} className="text-left py-2 px-3 text-slate-700 font-medium">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.slice(0, 3).map((row, i) => (
                                            <tr key={i} className="border-b border-slate-100 last:border-0">
                                                {csvHeaders.slice(0, 5).map(h => (
                                                    <td key={h} className="py-2 px-3 text-slate-600 truncate max-w-[200px]">
                                                        {row[h] || "—"}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <Button variant="ghost" onClick={() => setStep(2)} className="gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Retour
                            </Button>
                            <Button variant="primary" onClick={validateData} className="gap-2">
                                Valider
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Step 4: Validation */}
            {step === 4 && validationResult && (
                <Card>
                    <div className="space-y-6">
                        <div className="text-center py-8">
                            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-slate-900">Prêt pour l&apos;import</h2>
                            <p className="text-slate-500 mt-1">
                                {validationResult.valid} lignes valides détectées
                            </p>
                        </div>

                        {validationResult.warnings.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-amber-700">Avertissements</p>
                                        <ul className="text-sm text-amber-600 mt-1 space-y-1">
                                            {validationResult.warnings.map((w, i) => (
                                                <li key={i}>• {w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-50 rounded-xl p-4">
                            <h3 className="font-medium text-slate-900 mb-2">Résumé de l&apos;import</h3>
                            <ul className="text-sm text-slate-600 space-y-1">
                                <li>• {importMode === "existing" ? "Liste existante: " : "Liste: "}<span className="text-slate-900 font-medium">{importMode === "existing" ? lists.find(l => l.id === listId)?.name ?? listId : listName}</span></li>
                                <li>• Mission: <span className="text-slate-900 font-medium">{missions.find(m => m.id === missionId)?.name}</span></li>
                                <li>• Type: <span className="text-slate-900 font-medium">
                                    {importType === "companies-only" ? "Sociétés uniquement" : "Sociétés + Contacts"}
                                </span></li>
                                <li>• Fichier: <span className="text-slate-900 font-medium">{file?.name}</span></li>
                                <li>• Lignes: <span className="text-slate-900 font-medium">{validationResult.valid}</span></li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-3">
                            {isImporting && importProgress != null && (
                                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-300"
                                        style={{ width: `${importProgress}%` }}
                                    />
                                </div>
                            )}
                            <div className="flex justify-between">
                                <Button variant="ghost" onClick={() => setStep(3)} className="gap-2" disabled={isImporting}>
                                    <ArrowLeft className="w-4 h-4" />
                                    Retour
                                </Button>
                                <Button
                                    variant="success"
                                    onClick={handleImport}
                                    disabled={isImporting}
                                    className="gap-2"
                                >
                                    {isImporting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {importProgress != null ? `Import… ${importProgress}%` : "Import en cours…"}
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Lancer l&apos;import
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Step 5: Result */}
            {step === 5 && importResult && (
                <Card>
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900">Import terminé !</h2>
                        <p className="text-slate-500 mt-1">
                            {importResult.companies} sociétés et {importResult.contacts} contacts importés
                        </p>

                        <div className="flex justify-center gap-4 mt-8">
                            <Link href="/manager/lists">
                                <Button variant="secondary" className="gap-2">
                                    <Table className="w-4 h-4" />
                                    Voir les listes
                                </Button>
                            </Link>
                            <Button
                                variant="primary"
                                onClick={() => {
                                    setStep(1);
                                    setFile(null);
                                    setMissionId("");
                                    setListName("");
                                    setCsvHeaders([]);
                                    setMappings([]);
                                    setPreviewData([]);
                                    setValidationResult(null);
                                    setImportResult(null);
                                }}
                                className="gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Nouvel import
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
            {/* Custom Field Modal */}
            <Modal
                isOpen={customFieldPrompt !== null}
                onClose={() => setCustomFieldPrompt(null)}
                title={customFieldPrompt?.type === 'company' ? "Champ personnalisé société" : "Champ personnalisé contact"}
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        Saisissez le nom du champ personnalisé à utiliser. Ne mettez pas d'espaces.
                    </p>
                    <Input
                        label="Nom du champ"
                        placeholder={customFieldPrompt?.type === 'company' ? "ex: revenue, techStack" : "ex: department, seniority"}
                        value={customFieldValue}
                        onChange={(e) => setCustomFieldValue(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setCustomFieldPrompt(null)}>
                            Annuler
                        </Button>
                        <Button
                            variant="primary"
                            disabled={!customFieldValue.trim()}
                            onClick={() => {
                                if (customFieldPrompt && customFieldValue.trim()) {
                                    const newMappings = [...mappings];
                                    const prefix = customFieldPrompt.type === 'company' ? 'company' : 'contact';
                                    const sanitized = customFieldValue.trim().replace(/\s+/g, '_');
                                    newMappings[customFieldPrompt.index].targetField = `${prefix}.${sanitized}`;
                                    setMappings(newMappings);
                                    setCustomFieldPrompt(null);
                                }
                            }}
                        >
                            Valider
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
