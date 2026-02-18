"use client";

import { useState } from "react";
import { Search, List } from "lucide-react";
import { ListingSearchTab } from "@/components/listing/ListingSearchTab";
import type { ListingResult } from "@/components/listing/ListingSearchTab";
import { ListingListsTab } from "@/components/listing/ListingListsTab";
import { ImportToListModal } from "@/components/listing/ImportToListModal";

// ============================================
// LISTING PAGE — Mockup-aligned (Recherche + Mes listes)
// ============================================

export default function ListingPage() {
    const [activeTab, setActiveTab] = useState<"search" | "lists">("search");
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [resultsToImport, setResultsToImport] = useState<ListingResult[]>([]);

    const handleImportRequest = (results: ListingResult[]) => {
        setResultsToImport(results);
        setImportModalOpen(true);
    };

    const handleImportComplete = () => {
        setImportModalOpen(false);
        setResultsToImport([]);
        setActiveTab("lists");
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-[#F4F6F9]">
            {/* Page Header — mockup style */}
            <div className="px-6 pt-5 pb-4 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-[22px] font-bold text-[#12122A] tracking-tight">Listing</h1>
                        <p className="text-[13px] text-[#8B8BA7] mt-0.5">Recherche de leads et gestion des listes</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-white border border-[#E8EBF0] rounded-lg overflow-hidden">
                            <button
                                onClick={() => setActiveTab("search")}
                                className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium transition-colors duration-150 ${
                                    activeTab === "search" ? "bg-[#7C5CFC] text-white" : "text-[#8B8BA7] hover:text-[#12122A]"
                                }`}
                            >
                                <Search className="w-3.5 h-3.5" />
                                <span>Recherche</span>
                            </button>
                            <button
                                onClick={() => setActiveTab("lists")}
                                className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium transition-colors duration-150 ${
                                    activeTab === "lists" ? "bg-[#7C5CFC] text-white" : "text-[#8B8BA7] hover:text-[#12122A]"
                                }`}
                            >
                                <List className="w-3.5 h-3.5" />
                                <span>Mes listes</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab content — full height */}
            <div className="flex-1 flex flex-col min-h-0">
                {activeTab === "search" ? (
                    <ListingSearchTab onImport={handleImportRequest} />
                ) : (
                    <ListingListsTab />
                )}
            </div>

            <ImportToListModal
                isOpen={importModalOpen}
                onClose={() => {
                    setImportModalOpen(false);
                    setResultsToImport([]);
                }}
                results={resultsToImport}
                onImportComplete={handleImportComplete}
            />
        </div>
    );
}
