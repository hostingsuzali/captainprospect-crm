"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search, BookOpen, HelpCircle, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "./Button";

// ============================================
// HELP PANEL COMPONENT
// ============================================

interface HelpSection {
  id: string;
  title: string;
  content: string | React.ReactNode;
  subsections?: HelpSection[];
}

interface HelpPanelProps {
  topic: string;
  sections: HelpSection[];
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
  position?: "left" | "right";
}

export function HelpPanel({
  topic,
  sections,
  isOpen: controlledIsOpen,
  onClose,
  className,
  position = "right",
}: HelpPanelProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onClose ? (() => onClose()) : setInternalIsOpen;

  // Filter sections based on search
  const filteredSections = sections.filter((section) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(query) ||
      (typeof section.content === "string" && section.content.toLowerCase().includes(query))
    );
  });

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Close on escape key
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsOpen();
        }
      };
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, setIsOpen]);

  // Close on outside click
  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
          setIsOpen();
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={() => setIsOpen()}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50",
          "flex flex-col",
          position === "right" ? "right-0" : "left-0",
          "animate-slide-in-right",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Aide & Documentation</h2>
          </div>
          <button
            onClick={() => setIsOpen()}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher dans l'aide..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredSections.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Aucun résultat trouvé</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSections.map((section) => (
                <div key={section.id} className="border border-slate-200 rounded-lg">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-slate-400" />
                      <h3 className="font-medium text-slate-900">{section.title}</h3>
                    </div>
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 text-slate-400 transition-transform",
                        expandedSections.has(section.id) && "transform rotate-90"
                      )}
                    />
                  </button>
                  {expandedSections.has(section.id) && (
                    <div className="px-4 pb-4 text-sm text-slate-600">
                      {typeof section.content === "string" ? (
                        <p className="whitespace-pre-wrap">{section.content}</p>
                      ) : (
                        section.content
                      )}
                      {section.subsections && section.subsections.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {section.subsections.map((subsection) => (
                            <div key={subsection.id} className="pl-4 border-l-2 border-slate-200">
                              <h4 className="font-medium text-slate-900 mb-1">
                                {subsection.title}
                              </h4>
                              <p className="text-slate-600 text-xs">
                                {typeof subsection.content === "string"
                                  ? subsection.content
                                  : "Voir détails"}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsOpen()}
            className="w-full"
          >
            Fermer
          </Button>
        </div>
      </div>
    </>
  );
}

// ============================================
// HELP PANEL TRIGGER
// ============================================

interface HelpPanelTriggerProps {
  topic: string;
  sections: HelpSection[];
  className?: string;
}

export function HelpPanelTrigger({ topic, sections, className }: HelpPanelTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex items-center justify-center w-8 h-8 rounded-lg",
          "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
          "transition-colors focus:outline-none",
          className
        )}
        aria-label="Aide"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
      <HelpPanel
        topic={topic}
        sections={sections}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

export default HelpPanel;
