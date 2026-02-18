"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui";
import {
    Building2,
    Users,
    Target,
    FileText,
    Calendar,
    Sparkles,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    Check,
    Loader2,
    Plus,
    X,
    Wand2,
    Brain,
    Lightbulb,
    ArrowRight,
    Zap,
    TrendingUp,
    AlertTriangle,
    RefreshCw,
} from "lucide-react";
import { Button, Badge, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";

// ============================================
// WIZARD STEPS
// ============================================

const STEPS = [
    { id: "client", label: "Fiche Client", icon: Building2, description: "Informations de base" },
    { id: "ai", label: "Analyse IA", icon: Brain, description: "Suggestions intelligentes" },
    { id: "suggestions", label: "Suggestions IA", icon: Lightbulb, description: "Revoyez et ajustez les recommandations" },
    { id: "planning", label: "Planning", icon: Calendar, description: "Date de lancement" },
];

interface FormData {
    // Client info
    name: string;
    email: string;
    phone: string;
    industry: string;
    website: string;
    // Targets/ICP
    icp: string;
    targetIndustries: string[];
    targetCompanySize: string;
    targetJobTitles: string[];
    targetGeographies: string[];
    // Listing
    listingSources: string[];
    listingCriteria: string;
    estimatedContacts: string;
    // Scripts
    introScript: string;
    discoveryScript: string;
    objectionScript: string;
    closingScript: string;
    // Planning
    targetLaunchDate: string;
    notes: string;
    // Mission creation
    createMission: boolean;
    missionName: string;
    missionObjective: string;
    missionChannel: "CALL" | "EMAIL" | "LINKEDIN";
}

interface AIAnalysis {
    summary: string;
    confidence: number;
    recommendations: {
        icp: {
            description: string;
            industries: string[];
            companySize: string;
            jobTitles: string[];
            geographies: string[];
            reasoning: string;
        };
        listing: {
            sources: string[];
            estimatedContacts: string;
            criteria: string;
            signals: string[];
        };
        strategy: {
            primaryChannel: "CALL" | "EMAIL" | "LINKEDIN";
            channelReasoning: string;
            sequence: string[];
            cadence: string;
            expectedConversion: string;
        };
        quickWins: string[];
        risks: string[];
    };
    nextSteps: Array<{
        order: number;
        action: string;
        details: string;
        priority: "high" | "medium" | "low";
        estimatedTime: string;
    }>;
}

const INITIAL_FORM_DATA: FormData = {
    name: "",
    email: "",
    phone: "",
    industry: "",
    website: "",
    icp: "",
    targetIndustries: [],
    targetCompanySize: "",
    targetJobTitles: [],
    targetGeographies: [],
    listingSources: [],
    listingCriteria: "",
    estimatedContacts: "",
    introScript: "",
    discoveryScript: "",
    objectionScript: "",
    closingScript: "",
    targetLaunchDate: "",
    notes: "",
    createMission: false,
    missionName: "",
    missionObjective: "",
    missionChannel: "CALL",
};

const INDUSTRY_OPTIONS = [
    "SaaS / Tech",
    "E-commerce",
    "Finance / Banque",
    "Santé",
    "Immobilier",
    "Industrie",
    "Services B2B",
    "Retail",
    "Éducation",
    "Autre",
];

const COMPANY_SIZE_OPTIONS = [
    "1-10 employés",
    "11-50 employés",
    "51-200 employés",
    "201-500 employés",
    "501-1000 employés",
    "1000+ employés",
];

const LISTING_SOURCE_OPTIONS = [
    "Apollo.io",
    "LinkedIn Sales Navigator",
    "Clay",
    "Pharow",
    "Base interne",
    "Autre",
];

interface ClientOnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (clientId: string) => void;
}

export function ClientOnboardingModal({ isOpen, onClose, onSuccess }: ClientOnboardingModalProps) {
    const { success, error: showError } = useToast();
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newTag, setNewTag] = useState("");

    // AI Analysis state
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    // AI Script generation state
    const [isGeneratingScripts, setIsGeneratingScripts] = useState(false);
    const [scriptSuggestions, setScriptSuggestions] = useState<{
        intro: string[];
        discovery: string[];
        objection: string[];
        closing: string[];
    } | null>(null);

    // Per-section regenerate loading
    const [regeneratingSection, setRegeneratingSection] = useState<"icp" | "listing" | "scripts" | null>(null);
    // Collapsed sections (power users: start collapsed with summary)
    const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, boolean>>({
        cibles: false,
        listing: false,
        scripts: false,
    });

    // ============================================
    // FORM HANDLERS
    // ============================================

    const updateField = (field: keyof FormData, value: string | string[] | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const addTag = (field: "targetIndustries" | "targetJobTitles" | "targetGeographies" | "listingSources", value: string) => {
        if (value.trim() && !formData[field].includes(value.trim())) {
            updateField(field, [...formData[field], value.trim()]);
        }
    };

    const removeTag = (field: "targetIndustries" | "targetJobTitles" | "targetGeographies" | "listingSources", value: string) => {
        updateField(field, formData[field].filter(t => t !== value));
    };

    // ============================================
    // AI ANALYSIS
    // ============================================

    const runAIAnalysis = async () => {
        if (!formData.name.trim()) {
            showError("Erreur", "Le nom du client est requis pour l'analyse");
            return;
        }

        setIsAnalyzing(true);
        setAiError(null);

        try {
            const res = await fetch("/api/ai/mistral/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    industry: formData.industry,
                    website: formData.website,
                    email: formData.email,
                    icp: formData.icp,
                    targetIndustries: formData.targetIndustries,
                    targetCompanySize: formData.targetCompanySize,
                    targetJobTitles: formData.targetJobTitles,
                    targetGeographies: formData.targetGeographies,
                    analysisType: "full",
                }),
            });

            const data = await res.json();

            if (data.success && data.data?.analysis) {
                setAiAnalysis(data.data.analysis);
            } else {
                setAiError(data.error || "Erreur lors de l'analyse");
            }
        } catch (err) {
            console.error("AI analysis error:", err);
            setAiError("Erreur de connexion à l'IA");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const applyAISuggestions = () => {
        if (!aiAnalysis?.recommendations) return;

        const { icp, listing, strategy } = aiAnalysis.recommendations;

        // Apply ICP suggestions
        if (icp) {
            if (icp.description && !formData.icp) {
                updateField("icp", icp.description);
            }
            if (icp.industries?.length && !formData.targetIndustries.length) {
                updateField("targetIndustries", icp.industries);
            }
            if (icp.companySize && !formData.targetCompanySize) {
                updateField("targetCompanySize", icp.companySize);
            }
            if (icp.jobTitles?.length && !formData.targetJobTitles.length) {
                updateField("targetJobTitles", icp.jobTitles);
            }
            if (icp.geographies?.length && !formData.targetGeographies.length) {
                updateField("targetGeographies", icp.geographies);
            }
        }

        // Apply listing suggestions
        if (listing) {
            if (listing.sources?.length && !formData.listingSources.length) {
                updateField("listingSources", listing.sources);
            }
            if (listing.estimatedContacts && !formData.estimatedContacts) {
                updateField("estimatedContacts", listing.estimatedContacts);
            }
            if (listing.criteria && !formData.listingCriteria) {
                updateField("listingCriteria", listing.criteria);
            }
        }

        // Apply channel suggestion
        if (strategy?.primaryChannel && !formData.createMission) {
            updateField("missionChannel", strategy.primaryChannel);
        }

        success("Suggestions appliquées", "Les recommandations ont été ajoutées aux champs vides");
    };

    // ============================================
    // PER-SECTION REGENERATE (Suggestions IA step)
    // ============================================

    const runSectionRegenerate = async (section: "icp" | "listing" | "scripts") => {
        if (!formData.name.trim()) {
            showError("Erreur", "Le nom du client est requis");
            return;
        }
        setRegeneratingSection(section);

        try {
            if (section === "scripts") {
                const icpText = formData.icp ||
                    `Cibles: ${formData.targetJobTitles.join(", ") || "Décideurs"}. ` +
                    `Industries: ${formData.targetIndustries.join(", ") || formData.industry || "B2B"}. ` +
                    `Taille: ${formData.targetCompanySize || "PME/ETI"}.`;
                const pitchText = aiAnalysis?.recommendations?.strategy?.channelReasoning ||
                    `${formData.name} propose des solutions pour les entreprises du secteur ${formData.industry || "B2B"}.`;
                const res = await fetch("/api/ai/mistral/script", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        channel: formData.missionChannel || "CALL",
                        clientName: formData.name,
                        icp: icpText,
                        pitch: pitchText,
                        section: "all",
                        suggestionsCount: 2,
                    }),
                });
                const data = await res.json();
                if (data.success && data.data?.suggestions) {
                    const { suggestions } = data.data;
                    if (suggestions.intro?.[0]) updateField("introScript", suggestions.intro[0]);
                    if (suggestions.discovery?.[0]) updateField("discoveryScript", suggestions.discovery[0]);
                    if (suggestions.objection?.[0]) updateField("objectionScript", suggestions.objection[0]);
                    if (suggestions.closing?.[0]) updateField("closingScript", suggestions.closing[0]);
                    setScriptSuggestions(data.data.suggestions);
                    success("Scripts régénérés", "Les scripts ont été mis à jour");
                } else {
                    showError("Erreur", data.error || "Impossible de régénérer les scripts");
                }
            } else {
                const res = await fetch("/api/ai/mistral/onboarding", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formData.name,
                        industry: formData.industry,
                        website: formData.website,
                        email: formData.email,
                        icp: formData.icp,
                        targetIndustries: formData.targetIndustries,
                        targetCompanySize: formData.targetCompanySize,
                        targetJobTitles: formData.targetJobTitles,
                        targetGeographies: formData.targetGeographies,
                        analysisType: section,
                    }),
                });
                const data = await res.json();
                if (data.success && data.data?.analysis) {
                    const analysis = data.data.analysis as AIAnalysis;
                    setAiAnalysis(prev => {
                        const base = prev ?? { summary: "", confidence: 0, recommendations: {}, nextSteps: [] };
                        const rec = { ...base.recommendations, ...analysis.recommendations };
                        return { ...base, recommendations: rec };
                    });
                    const rec = analysis.recommendations;
                    if (section === "icp" && rec?.icp) {
                        if (rec.icp.description) updateField("icp", rec.icp.description);
                        if (rec.icp.industries?.length) updateField("targetIndustries", rec.icp.industries);
                        if (rec.icp.companySize) updateField("targetCompanySize", rec.icp.companySize);
                        if (rec.icp.jobTitles?.length) updateField("targetJobTitles", rec.icp.jobTitles);
                        if (rec.icp.geographies?.length) updateField("targetGeographies", rec.icp.geographies);
                        success("Cibles & ICP régénérés", "Les recommandations ont été mises à jour");
                    }
                    if (section === "listing" && rec?.listing) {
                        if (rec.listing.sources?.length) updateField("listingSources", rec.listing.sources);
                        if (rec.listing.estimatedContacts) updateField("estimatedContacts", rec.listing.estimatedContacts);
                        if (rec.listing.criteria) updateField("listingCriteria", rec.listing.criteria);
                        success("Base de données régénérée", "Les sources et le volume ont été mis à jour");
                    }
                } else {
                    showError("Erreur", data.error || "Impossible de régénérer cette section");
                }
            }
        } catch (err) {
            console.error("Section regenerate error:", err);
            showError("Erreur", "Erreur de connexion à l'IA");
        } finally {
            setRegeneratingSection(null);
        }
    };

    // ============================================
    // AI SCRIPT GENERATION
    // ============================================

    const generateScripts = async () => {
        // Need at least client name and some ICP info
        if (!formData.name.trim()) {
            showError("Erreur", "Le nom du client est requis");
            return;
        }

        // Build ICP from collected data
        const icpText = formData.icp ||
            `Cibles: ${formData.targetJobTitles.join(", ") || "Décideurs"}. ` +
            `Industries: ${formData.targetIndustries.join(", ") || formData.industry || "B2B"}. ` +
            `Taille: ${formData.targetCompanySize || "PME/ETI"}.`;

        // Build pitch from AI analysis or default
        const pitchText = aiAnalysis?.recommendations?.strategy?.channelReasoning ||
            `${formData.name} propose des solutions pour les entreprises du secteur ${formData.industry || "B2B"}.`;

        setIsGeneratingScripts(true);

        try {
            const res = await fetch("/api/ai/mistral/script", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channel: formData.missionChannel || "CALL",
                    clientName: formData.name,
                    icp: icpText,
                    pitch: pitchText,
                    section: "all",
                    suggestionsCount: 2,
                }),
            });

            const data = await res.json();

            if (data.success && data.data?.suggestions) {
                setScriptSuggestions(data.data.suggestions);

                // Auto-apply first suggestion to empty fields
                const { suggestions } = data.data;
                if (suggestions.intro?.[0] && !formData.introScript) {
                    updateField("introScript", suggestions.intro[0]);
                }
                if (suggestions.discovery?.[0] && !formData.discoveryScript) {
                    updateField("discoveryScript", suggestions.discovery[0]);
                }
                if (suggestions.objection?.[0] && !formData.objectionScript) {
                    updateField("objectionScript", suggestions.objection[0]);
                }
                if (suggestions.closing?.[0] && !formData.closingScript) {
                    updateField("closingScript", suggestions.closing[0]);
                }

                success("Scripts générés", "Les scripts ont été pré-remplis par l'IA");
            } else {
                showError("Erreur", data.error || "Impossible de générer les scripts");
            }
        } catch (err) {
            console.error("Script generation error:", err);
            showError("Erreur", "Erreur de connexion à l'IA");
        } finally {
            setIsGeneratingScripts(false);
        }
    };

    const applyScriptSuggestion = (field: "introScript" | "discoveryScript" | "objectionScript" | "closingScript", suggestion: string) => {
        updateField(field, suggestion);
    };

    // Auto-run analysis when moving to AI step
    useEffect(() => {
        if (currentStep === 1 && !aiAnalysis && !isAnalyzing && formData.name.trim()) {
            runAIAnalysis();
        }
    }, [currentStep]);

    // ============================================
    // NAVIGATION
    // ============================================

    const canProceed = () => {
        switch (currentStep) {
            case 0: // Client info
                return formData.name.trim().length > 0;
            case 1: // AI Analysis
                return true;
            case 2: // Suggestions IA
                return true;
            case 3: // Planning
                return true;
            default:
                return true;
        }
    };

    const handleNext = () => {
        if (canProceed() && currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleClose = () => {
        setCurrentStep(0);
        setFormData(INITIAL_FORM_DATA);
        setAiAnalysis(null);
        setAiError(null);
        onClose();
    };

    // ============================================
    // SUBMIT
    // ============================================

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            showError("Erreur", "Le nom du client est requis");
            return;
        }

        setIsSubmitting(true);
        try {
            const onboardingData = {
                icp: formData.icp,
                targetIndustries: formData.targetIndustries,
                targetCompanySize: formData.targetCompanySize,
                targetJobTitles: formData.targetJobTitles,
                targetGeographies: formData.targetGeographies,
                listingSources: formData.listingSources,
                listingCriteria: formData.listingCriteria,
                estimatedContacts: formData.estimatedContacts,
                // Store AI analysis for reference
                aiAnalysis: aiAnalysis ? {
                    summary: aiAnalysis.summary,
                    confidence: aiAnalysis.confidence,
                    quickWins: aiAnalysis.recommendations?.quickWins,
                    risks: aiAnalysis.recommendations?.risks,
                } : null,
            };

            const scripts = {
                intro: formData.introScript,
                discovery: formData.discoveryScript,
                objection: formData.objectionScript,
                closing: formData.closingScript,
            };

            const clientRes = await fetch("/api/clients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email || null,
                    phone: formData.phone || null,
                    industry: formData.industry || null,
                    onboardingData,
                    targetLaunchDate: formData.targetLaunchDate || null,
                    scripts,
                    notes: formData.notes || null,
                    createMission: formData.createMission,
                    missionName: formData.missionName || null,
                    missionObjective: formData.missionObjective || null,
                    missionChannel: formData.missionChannel,
                }),
            });

            const clientJson = await clientRes.json();

            if (!clientJson.success) {
                showError("Erreur", clientJson.error || "Impossible de créer le client");
                setIsSubmitting(false);
                return;
            }

            success("Client créé", `${formData.name} a été créé avec succès`);
            handleClose();
            onSuccess(clientJson.data.id);
        } catch (err) {
            console.error("Failed to create client:", err);
            showError("Erreur", "Une erreur est survenue");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============================================
    // RENDER AI STEP
    // ============================================

    const renderAIStep = () => {
        if (isAnalyzing) {
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                        <Brain className="w-8 h-8 text-indigo-600 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Analyse en cours...</h3>
                    <p className="text-sm text-slate-500 text-center max-w-md">
                        L'IA analyse les informations de {formData.name} pour générer des recommandations personnalisées.
                    </p>
                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mt-6" />
                </div>
            );
        }

        if (aiError) {
            return (
                <div className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <div>
                                <h4 className="font-medium text-red-900">Erreur d'analyse</h4>
                                <p className="text-sm text-red-700">{aiError}</p>
                            </div>
                        </div>
                    </div>
                    <Button variant="secondary" onClick={runAIAnalysis} className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Réessayer l'analyse
                    </Button>
                    <p className="text-sm text-slate-500">
                        Vous pouvez continuer sans l'analyse IA en cliquant sur "Suivant".
                    </p>
                </div>
            );
        }

        if (!aiAnalysis) {
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                        <Wand2 className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Analyse IA</h3>
                    <p className="text-sm text-slate-500 text-center max-w-md mb-6">
                        Obtenez des recommandations personnalisées basées sur les informations du client.
                    </p>
                    <Button variant="primary" onClick={runAIAnalysis} className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Lancer l'analyse
                    </Button>
                </div>
            );
        }

        // Show AI results
        const { recommendations, nextSteps, summary, confidence } = aiAnalysis;

        return (
            <div className="space-y-5">
                {/* Summary */}
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Brain className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-indigo-900">Analyse IA</h4>
                                <span className="text-xs font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                                    {confidence || 85}% confiance
                                </span>
                            </div>
                            <p className="text-sm text-indigo-800">{summary}</p>
                        </div>
                    </div>
                </div>

                {/* Apply button */}
                <Button variant="primary" onClick={applyAISuggestions} className="w-full gap-2">
                    <Zap className="w-4 h-4" />
                    Appliquer toutes les suggestions
                </Button>

                {/* Recommendations */}
                <div className="grid grid-cols-2 gap-4">
                    {/* ICP */}
                    <div className="p-4 bg-white border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Target className="w-4 h-4 text-violet-600" />
                            <h5 className="font-semibold text-slate-900 text-sm">ICP Suggéré</h5>
                        </div>
                        <p className="text-xs text-slate-600 mb-2">{recommendations.icp?.description}</p>
                        <div className="flex flex-wrap gap-1">
                            {recommendations.icp?.jobTitles?.slice(0, 3).map((title, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 bg-violet-50 text-violet-700 rounded">
                                    {title}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Strategy */}
                    <div className="p-4 bg-white border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            <h5 className="font-semibold text-slate-900 text-sm">Canal Recommandé</h5>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-emerald-700">
                                {recommendations.strategy?.primaryChannel === "CALL" ? "📞 Appel" :
                                    recommendations.strategy?.primaryChannel === "EMAIL" ? "✉️ Email" : "💼 LinkedIn"}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">{recommendations.strategy?.channelReasoning}</p>
                    </div>
                </div>

                {/* Quick Wins */}
                {recommendations.quickWins?.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="w-4 h-4 text-amber-600" />
                            <h5 className="font-semibold text-amber-900 text-sm">Quick Wins</h5>
                        </div>
                        <ul className="space-y-1">
                            {recommendations.quickWins.map((win, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                                    <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    {win}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Next Steps */}
                {nextSteps?.length > 0 && (
                    <div>
                        <h5 className="font-semibold text-slate-900 text-sm mb-3">Prochaines étapes suggérées</h5>
                        <div className="space-y-2">
                            {nextSteps.slice(0, 4).map((step, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                    <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0",
                                        step.priority === "high" ? "bg-red-500" :
                                            step.priority === "medium" ? "bg-amber-500" : "bg-slate-400"
                                    )}>
                                        {step.order}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-900">{step.action}</p>
                                        <p className="text-xs text-slate-500">{step.details}</p>
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            ⏱ {step.estimatedTime}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Refresh */}
                <button
                    onClick={runAIAnalysis}
                    className="w-full text-sm text-slate-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Relancer l'analyse
                </button>
            </div>
        );
    };

    // ============================================
    // RENDER STEP CONTENT
    // ============================================

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: // Client info
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Nom de l'entreprise *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => updateField("name", e.target.value)}
                                    placeholder="Ex: Acme Corp"
                                    className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Secteur d'activité
                                </label>
                                <select
                                    value={formData.industry}
                                    onChange={(e) => updateField("industry", e.target.value)}
                                    className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                >
                                    <option value="">Sélectionner...</option>
                                    {INDUSTRY_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Site web
                                </label>
                                <input
                                    type="text"
                                    value={formData.website}
                                    onChange={(e) => updateField("website", e.target.value)}
                                    placeholder="www.acme.com"
                                    className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Email de contact
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => updateField("email", e.target.value)}
                                    placeholder="contact@acme.com"
                                    className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Téléphone
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => updateField("phone", e.target.value)}
                                    placeholder="+33 1 23 45 67 89"
                                    className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                />
                            </div>
                        </div>

                        {/* AI Preview hint */}
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-600" />
                                <span className="text-sm text-indigo-700">
                                    <strong>Étape suivante :</strong> L'IA analysera ces informations pour vous suggérer l'ICP, les sources de données et la stratégie optimale.
                                </span>
                            </div>
                        </div>
                    </div>
                );

            case 1: // AI Analysis
                return renderAIStep();

            case 2: // Suggestions IA — Revoyez et ajustez. IA badges + Regenerer par section + champs éditables
                return (
                    <div className="space-y-5">
                        <p className="text-sm text-slate-600 mb-4">
                            Suggestions IA — Revoyez et ajustez les recommandations. Cliquez sur un champ pour modifier.
                        </p>

                        {/* Cibles & ICP */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <button
                                type="button"
                                onClick={() => setSectionsCollapsed(prev => ({ ...prev, cibles: !prev.cibles }))}
                                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                            >
                                <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                        <span className="font-semibold text-slate-900">Cibles & ICP</span>
                                        <span className="text-[10px] font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">IA</span>
                                    </div>
                                    {sectionsCollapsed.cibles && (formData.icp || formData.targetIndustries.length > 0 || formData.targetCompanySize) && (
                                        <p className="text-xs text-slate-500 truncate max-w-full pl-6">
                                            {formData.icp?.slice(0, 80)}{formData.icp && formData.icp.length > 80 ? "…" : ""}
                                            {!formData.icp && (formData.targetIndustries.join(", ") || formData.targetCompanySize || "")}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); runSectionRegenerate("icp"); }}
                                        disabled={regeneratingSection !== null}
                                        className="gap-1 h-8 text-xs"
                                    >
                                        {regeneratingSection === "icp" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                        Régénérer
                                    </Button>
                                    {sectionsCollapsed.cibles ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
                                </div>
                            </button>
                            {!sectionsCollapsed.cibles && (
                                <div className="p-4 space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Profil Client Idéal</label>
                                        <textarea
                                            value={formData.icp}
                                            onChange={(e) => updateField("icp", e.target.value)}
                                            placeholder="Entreprises SaaS B2B, 50-200 employés, en phase de croissance..."
                                            rows={2}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Secteurs</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {formData.targetIndustries.map(tag => (
                                                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs">
                                                    {tag}
                                                    <button type="button" onClick={() => removeTag("targetIndustries", tag)} className="hover:text-red-600"><X className="w-3 h-3" /></button>
                                                </span>
                                            ))}
                                            <select
                                                onChange={(e) => { if (e.target.value) { addTag("targetIndustries", e.target.value); e.target.value = ""; } }}
                                                className="text-xs border-0 bg-transparent text-slate-500 cursor-pointer focus:ring-0"
                                            >
                                                <option value="">+ Secteur</option>
                                                {INDUSTRY_OPTIONS.filter(i => !formData.targetIndustries.includes(i)).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Taille</label>
                                        <select
                                            value={formData.targetCompanySize}
                                            onChange={(e) => updateField("targetCompanySize", e.target.value)}
                                            className="w-full h-9 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Sélectionner...</option>
                                            {COMPANY_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Base de données */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <button
                                type="button"
                                onClick={() => setSectionsCollapsed(prev => ({ ...prev, listing: !prev.listing }))}
                                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                            >
                                <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                        <span className="font-semibold text-slate-900">Base de données</span>
                                        <span className="text-[10px] font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">IA</span>
                                    </div>
                                    {sectionsCollapsed.listing && (formData.listingSources.length > 0 || formData.estimatedContacts) && (
                                        <p className="text-xs text-slate-500 truncate max-w-full pl-6">
                                            {formData.listingSources.slice(0, 3).join(", ")}{formData.estimatedContacts ? ` · ${formData.estimatedContacts} contacts` : ""}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); runSectionRegenerate("listing"); }}
                                        disabled={regeneratingSection !== null}
                                        className="gap-1 h-8 text-xs"
                                    >
                                        {regeneratingSection === "listing" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                        Régénérer
                                    </Button>
                                    {sectionsCollapsed.listing ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
                                </div>
                            </button>
                            {!sectionsCollapsed.listing && (
                                <div className="p-4 space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Sources recommandées</label>
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            {formData.listingSources.map(tag => (
                                                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs">
                                                    {tag}
                                                    <button type="button" onClick={() => removeTag("listingSources", tag)} className="hover:text-red-600"><X className="w-3 h-3" /></button>
                                                </span>
                                            ))}
                                            <select
                                                onChange={(e) => { if (e.target.value) { addTag("listingSources", e.target.value); e.target.value = ""; } }}
                                                className="text-xs px-2 py-1 rounded-md border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer"
                                            >
                                                <option value="">+ Ajouter</option>
                                                {LISTING_SOURCE_OPTIONS.filter(s => !formData.listingSources.includes(s)).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Volume estimé</label>
                                        <input
                                            type="text"
                                            value={formData.estimatedContacts}
                                            onChange={(e) => updateField("estimatedContacts", e.target.value)}
                                            placeholder="800-1200 contacts"
                                            className="w-full h-9 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Scripts */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <button
                                type="button"
                                onClick={() => setSectionsCollapsed(prev => ({ ...prev, scripts: !prev.scripts }))}
                                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                            >
                                <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                        <span className="font-semibold text-slate-900">Scripts</span>
                                        <span className="text-[10px] font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">IA</span>
                                    </div>
                                    {sectionsCollapsed.scripts && formData.introScript && (
                                        <p className="text-xs text-slate-500 truncate max-w-full pl-6">
                                            {formData.introScript.slice(0, 60)}…
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); runSectionRegenerate("scripts"); }}
                                        disabled={regeneratingSection !== null}
                                        className="gap-1 h-8 text-xs"
                                    >
                                        {regeneratingSection === "scripts" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                        Régénérer
                                    </Button>
                                    {sectionsCollapsed.scripts ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
                                </div>
                            </button>
                            {!sectionsCollapsed.scripts && (
                                <div className="p-4 space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Script d&apos;introduction</label>
                                        <textarea
                                            value={formData.introScript}
                                            onChange={(e) => updateField("introScript", e.target.value)}
                                            placeholder="Bonjour, je suis [Prénom] de [Entreprise]. Je vous contacte car..."
                                            rows={2}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Questions de découverte</label>
                                        <textarea
                                            value={formData.discoveryScript}
                                            onChange={(e) => updateField("discoveryScript", e.target.value)}
                                            placeholder="1. Comment gérez-vous actuellement...?\n2. Quels sont vos principaux défis...?"
                                            rows={3}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 3: // Planning
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Date de lancement souhaitée
                            </label>
                            <input
                                type="date"
                                value={formData.targetLaunchDate}
                                onChange={(e) => updateField("targetLaunchDate", e.target.value)}
                                className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Notes additionnelles
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => updateField("notes", e.target.value)}
                                placeholder="Informations complémentaires pour l'équipe..."
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                            />
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <input
                                    type="checkbox"
                                    id="createMission"
                                    checked={formData.createMission}
                                    onChange={(e) => updateField("createMission", e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="createMission" className="text-sm font-medium text-slate-700">
                                    Créer une mission initiale
                                </label>
                            </div>

                            {formData.createMission && (
                                <div className="space-y-3 pt-3 border-t border-slate-200">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Nom de la mission
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.missionName}
                                            onChange={(e) => updateField("missionName", e.target.value)}
                                            placeholder={`Mission ${formData.name || "Client"}`}
                                            className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Canal principal
                                        </label>
                                        <select
                                            value={formData.missionChannel}
                                            onChange={(e) => updateField("missionChannel", e.target.value as "CALL" | "EMAIL" | "LINKEDIN")}
                                            className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                        >
                                            <option value="CALL">Appel</option>
                                            <option value="EMAIL">Email</option>
                                            <option value="LINKEDIN">LinkedIn</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Objectif
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.missionObjective}
                                            onChange={(e) => updateField("missionObjective", e.target.value)}
                                            placeholder="Ex: Générer des RDV qualifiés"
                                            className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title=""
            className="!max-w-3xl"
        >
            <div className="flex flex-col h-full max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-200">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Onboarding Client</h2>
                        <p className="text-sm text-slate-500">Créez un nouveau client avec assistance IA</p>
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-6 px-2 overflow-x-auto">
                    {STEPS.map((step, index) => (
                        <div
                            key={step.id}
                            className={cn(
                                "flex items-center",
                                index < STEPS.length - 1 && "flex-1"
                            )}
                        >
                            <button
                                onClick={() => setCurrentStep(index)}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors",
                                    index === currentStep && "bg-indigo-50",
                                    index < currentStep && "text-indigo-600"
                                )}
                            >
                                <div className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                                    index === currentStep && "bg-indigo-500 text-white",
                                    index < currentStep && "bg-indigo-500 text-white",
                                    index > currentStep && "bg-slate-200 text-slate-500"
                                )}>
                                    {index < currentStep ? <Check className="w-3 h-3" /> : index + 1}
                                </div>
                                <span className={cn(
                                    "text-[11px] font-medium hidden lg:block",
                                    index === currentStep ? "text-indigo-600" : "text-slate-500"
                                )}>
                                    {step.label}
                                </span>
                            </button>
                            {index < STEPS.length - 1 && (
                                <div className={cn(
                                    "flex-1 h-0.5 mx-1",
                                    index < currentStep ? "bg-indigo-500" : "bg-slate-200"
                                )} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step Content */}
                <div className="flex-1 overflow-y-auto pr-2">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                            {(() => {
                                const StepIcon = STEPS[currentStep].icon;
                                return <StepIcon className="w-4 h-4 text-indigo-600" />;
                            })()}
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-slate-900">{STEPS[currentStep].label}</h3>
                            <p className="text-xs text-slate-500">{STEPS[currentStep].description}</p>
                        </div>
                    </div>

                    {renderStepContent()}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200">
                    <Button
                        variant="secondary"
                        onClick={handleBack}
                        disabled={currentStep === 0}
                        className="gap-2"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Retour
                    </Button>

                    {currentStep === STEPS.length - 1 ? (
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !canProceed()}
                            isLoading={isSubmitting}
                            className="gap-2"
                        >
                            Créer le client
                            <Check className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={handleNext}
                            disabled={!canProceed()}
                            className="gap-2"
                        >
                            {currentStep === 2 ? "Confirmer" : "Suivant"}
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
