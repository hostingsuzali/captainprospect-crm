"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, Target, Building2, FileText, Users, MessageCircle, Megaphone, Search, Loader2, Send, ArrowLeft } from "lucide-react";
import { Modal, Input, Button } from "@/components/ui";
import type { CommsChannelType, CreateThreadRequest } from "@/lib/comms/types";

interface NewThreadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (request: CreateThreadRequest) => Promise<void>;
    userRole: string;
    // Pre-selected context (optional)
    defaultChannelType?: CommsChannelType;
    defaultAnchorId?: string;
    defaultAnchorName?: string;
}

interface SelectableItem {
    id: string;
    name: string;
    subtitle?: string;
}

const CHANNEL_OPTIONS: {
    type: CommsChannelType;
    label: string;
    icon: typeof Target;
    description: string;
    roles: string[];
}[] = [
        {
            type: "DIRECT",
            label: "Message direct à un SDR",
            icon: MessageCircle,
            description: "Contacter un SDR de vos missions",
            roles: ["MANAGER", "SDR", "BUSINESS_DEVELOPER", "DEVELOPER", "CLIENT"],
        },
        {
            type: "MISSION",
            label: "Discussion mission",
            icon: Target,
            description: "Tous les assignés à la mission verront ce message",
            roles: ["MANAGER", "SDR", "BUSINESS_DEVELOPER", "CLIENT"],
        },
        {
            type: "CLIENT",
            label: "Discussion client",
            icon: Building2,
            description: "Discussion liée à un client",
            roles: ["MANAGER", "BUSINESS_DEVELOPER"],
        },
        {
            type: "GROUP",
            label: "Groupe",
            icon: Users,
            description: "Discussion de groupe",
            roles: ["MANAGER", "BUSINESS_DEVELOPER"],
        },
        {
            type: "BROADCAST",
            label: "Annonce",
            icon: Megaphone,
            description: "Annonce à toute l'équipe",
            roles: ["MANAGER"],
        },
    ];

export function NewThreadModal({
    isOpen,
    onClose,
    onSubmit,
    userRole,
    defaultChannelType,
    defaultAnchorId,
    defaultAnchorName,
}: NewThreadModalProps) {
    const [step, setStep] = useState<"type" | "recipient" | "compose">("type");
    const [channelType, setChannelType] = useState<CommsChannelType | null>(
        defaultChannelType || null
    );
    const [anchorId, setAnchorId] = useState<string | null>(defaultAnchorId || null);
    const [anchorName, setAnchorName] = useState<string>(defaultAnchorName || "");
    const [message, setMessage] = useState("");
    const [isBroadcast, setIsBroadcast] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // For DIRECT type
    const [selectedUser, setSelectedUser] = useState<SelectableItem | null>(null);

    // Searchable items for anchor selection
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SelectableItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setStep("type");
            setChannelType(defaultChannelType || null);
            setAnchorId(defaultAnchorId || null);
            setAnchorName(defaultAnchorName || "");
            setMessage("");
            setIsBroadcast(false);
            setSelectedUser(null);
            setSearchQuery("");
            setSearchResults([]);
        }
    }, [isOpen, defaultChannelType, defaultAnchorId, defaultAnchorName]);

    // Skip to compose if defaults provided
    useEffect(() => {
        if (defaultChannelType && defaultAnchorId) {
            setStep("compose");
        }
    }, [defaultChannelType, defaultAnchorId]);

    // CLIENT: load missions or contactable SDRs when entering recipient step (no search)
    useEffect(() => {
        if (!isOpen || userRole !== "CLIENT" || step !== "recipient" || !channelType) {
            return;
        }
        if (channelType !== "MISSION" && channelType !== "DIRECT") {
            setSearchResults([]);
            return;
        }

        let cancelled = false;
        setIsSearching(true);
        (async () => {
            try {
                if (channelType === "MISSION") {
                    const res = await fetch("/api/missions?isActive=true");
                    if (!res.ok || cancelled) return;
                    const json = await res.json();
                    const list = Array.isArray(json.data) ? json.data : [];
                    const items: SelectableItem[] = list.map((m: { id: string; name: string }) => ({
                        id: m.id,
                        name: m.name,
                        subtitle: undefined,
                    }));
                    if (!cancelled) setSearchResults(items);
                } else {
                    const res = await fetch("/api/client/contactable-sdrs");
                    if (!res.ok || cancelled) return;
                    const json = await res.json();
                    const list = json.sdrs || [];
                    const items: SelectableItem[] = list.map((s: { id: string; name: string }) => ({
                        id: s.id,
                        name: s.name,
                        subtitle: "SDR",
                    }));
                    if (!cancelled) setSearchResults(items);
                }
            } catch (e) {
                if (!cancelled) setSearchResults([]);
            } finally {
                if (!cancelled) setIsSearching(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, userRole, step, channelType]);

    // Search for anchors when query changes (non-CLIENT or CLIENT with search filter)
    useEffect(() => {
        if (userRole === "CLIENT" && (channelType === "MISSION" || channelType === "DIRECT")) {
            return;
        }
        if (!searchQuery || !channelType) {
            setSearchResults([]);
            return;
        }

        const searchAnchors = async () => {
            setIsSearching(true);
            try {
                let endpoint = "";
                switch (channelType) {
                    case "MISSION":
                        endpoint = `/api/missions?search=${encodeURIComponent(searchQuery)}`;
                        break;
                    case "CLIENT":
                        endpoint = `/api/clients?search=${encodeURIComponent(searchQuery)}`;
                        break;
                    case "CAMPAIGN":
                        endpoint = `/api/campaigns?search=${encodeURIComponent(searchQuery)}`;
                        break;
                    case "GROUP":
                        endpoint = `/api/comms/groups?search=${encodeURIComponent(searchQuery)}`;
                        break;
                    case "DIRECT":
                        endpoint = `/api/users?search=${encodeURIComponent(searchQuery)}`;
                        break;
                    default:
                        return;
                }

                const res = await fetch(endpoint);
                if (res.ok) {
                    const response = await res.json();

                    // Handle different response formats
                    let items: any[] = [];

                    if (response.success === true) {
                        const responseData = response.data;

                        if (Array.isArray(responseData)) {
                            items = responseData;
                        } else if (responseData?.users) {
                            items = responseData.users || [];
                        } else if (responseData?.campaigns) {
                            items = responseData.campaigns || [];
                        } else if (responseData?.missions) {
                            items = responseData.missions || [];
                        } else if (responseData?.clients) {
                            items = responseData.clients || [];
                        } else if (responseData?.groups) {
                            items = responseData.groups || [];
                        }
                    } else if (response.missions) {
                        items = response.missions || [];
                    } else if (response.campaigns) {
                        items = response.campaigns || [];
                    } else if (response.users) {
                        items = response.users || [];
                    } else if (response.clients) {
                        items = response.clients || [];
                    } else if (response.groups) {
                        items = response.groups || [];
                    } else if (Array.isArray(response)) {
                        items = response;
                    }

                    // Normalize results
                    const normalizedItems: SelectableItem[] = items.map(
                        (item: { id: string; name: string; email?: string; clientName?: string; client?: { name: string } }) => ({
                            id: item.id,
                            name: item.name,
                            subtitle: item.email || item.clientName || item.client?.name,
                        })
                    );
                    setSearchResults(normalizedItems.slice(0, 10));
                } else {
                    setSearchResults([]);
                }
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const debounce = setTimeout(searchAnchors, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery, channelType, userRole]);

    const handleSelectType = (type: CommsChannelType) => {
        setChannelType(type);
        if (type === "BROADCAST") {
            setIsBroadcast(true);
            setStep("compose");
        } else {
            setStep("recipient");
        }
    };

    const handleSelectRecipient = (item: SelectableItem) => {
        if (channelType === "DIRECT") {
            setSelectedUser(item);
        }
        setAnchorId(item.id);
        setAnchorName(item.name);
        setStep("compose");
    };

    const handleSubmit = async () => {
        if (!channelType || !message.trim()) return;

        // For non-direct types, we need an anchor
        if (channelType !== "DIRECT" && channelType !== "BROADCAST" && !anchorId) return;

        setIsSubmitting(true);
        try {
            const request: CreateThreadRequest = {
                channelType,
                // For DIRECT messages, use recipient name as subject
                subject: channelType === "DIRECT" && selectedUser
                    ? `Message avec ${selectedUser.name}`
                    : channelType === "BROADCAST"
                        ? "Annonce"
                        : `Discussion - ${anchorName}`,
                initialMessage: message.trim(),
                isBroadcast,
            };

            if (channelType === "DIRECT" && selectedUser) {
                request.participantIds = [selectedUser.id];
            } else if (anchorId) {
                request.anchorId = anchorId;
            }

            await onSubmit(request);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const availableChannelOptions = CHANNEL_OPTIONS.filter((opt) =>
        opt.roles.includes(userRole)
    );

    const getRecipientPlaceholder = () => {
        switch (channelType) {
            case "DIRECT": return "Rechercher un collègue...";
            case "MISSION": return "Rechercher une mission...";
            case "CLIENT": return "Rechercher un client...";
            case "GROUP": return "Rechercher un groupe...";
            default: return "Rechercher...";
        }
    };

    const getRecipientLabel = () => {
        switch (channelType) {
            case "DIRECT": return "Envoyer à";
            case "MISSION": return "Mission";
            case "CLIENT": return "Client";
            case "GROUP": return "Groupe";
            default: return "Destinataire";
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <div className="p-6 bg-white text-slate-900">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        {step !== "type" && (
                            <button
                                onClick={() => setStep(step === "compose" ? "recipient" : "type")}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        <h2 className="text-lg font-semibold text-slate-900">
                            {step === "type" && "Nouveau message"}
                            {step === "recipient" && getRecipientLabel()}
                            {step === "compose" && (selectedUser?.name || anchorName || "Nouveau message")}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Step 1: Select type */}
                {step === "type" && (
                    <div className="grid gap-2">
                        {availableChannelOptions.map((opt) => (
                            <button
                                key={opt.type}
                                onClick={() => handleSelectType(opt.type)}
                                className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left group"
                            >
                                <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                                    "bg-slate-100 group-hover:bg-indigo-100"
                                )}>
                                    <opt.icon className="w-6 h-6 text-slate-600 group-hover:text-indigo-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-900">{opt.label}</p>
                                    <p className="text-sm text-slate-500">{opt.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Step 2: Select recipient */}
                {step === "recipient" && (
                    <div>
                        {/* Search input (hidden for CLIENT: they see only their missions / SDRs) */}
                        {userRole !== "CLIENT" && (
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 z-10" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={getRecipientPlaceholder()}
                                    className="pl-10 h-11 bg-white border-slate-200 text-slate-900 placeholder:text-slate-500"
                                    autoFocus
                                />
                            </div>
                        )}

                        {/* Results */}
                        <div className="max-h-72 overflow-y-auto">
                            {isSearching && (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                                </div>
                            )}
                            {!isSearching && searchResults.length === 0 && searchQuery && userRole !== "CLIENT" && (
                                <p className="text-sm text-slate-500 text-center py-8">
                                    Aucun résultat pour "{searchQuery}"
                                </p>
                            )}
                            {!isSearching && searchResults.length === 0 && (userRole === "CLIENT" || !searchQuery) && (
                                <div className="text-center py-8">
                                    {userRole === "CLIENT" ? (
                                        <>
                                            <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-sm text-slate-500">
                                                {channelType === "MISSION"
                                                    ? "Aucune mission en cours."
                                                    : "Aucun SDR assigné à vos missions."}
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-sm text-slate-500">
                                                Commencez à taper pour rechercher
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                            {!isSearching && searchResults.length > 0 && (
                                <div className="space-y-1">
                                    {searchResults.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSelectRecipient(item)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600 group-hover:from-indigo-100 group-hover:to-indigo-200 group-hover:text-indigo-600 transition-colors">
                                                {item.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900 truncate">
                                                    {item.name}
                                                </p>
                                                {item.subtitle && (
                                                    <p className="text-xs text-slate-500 truncate">
                                                        {item.subtitle}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 3: Compose - Simplified for direct messages */}
                {step === "compose" && (
                    <div className="space-y-4">
                        {/* Recipient indicator */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-sm font-semibold text-indigo-600">
                                {(selectedUser?.name || anchorName || "?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">
                                    {channelType === "DIRECT" ? "Message à" : channelType === "BROADCAST" ? "Annonce à" : "Discussion"}
                                </p>
                                <p className="text-sm font-medium text-slate-900">
                                    {selectedUser?.name || anchorName || (channelType === "BROADCAST" ? "Toute l'équipe" : "...")}
                                </p>
                            </div>
                        </div>

                        {/* Message */}
                        <div>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Écrivez votre message..."
                                rows={5}
                                autoFocus
                                className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                            />
                        </div>

                        {/* Note for mission threads */}
                        {channelType === "MISSION" && (
                            <p className="text-xs text-slate-500 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
                                💡 Tous les SDR et managers assignés à cette mission verront cette discussion.
                            </p>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="secondary" onClick={onClose}>
                                Annuler
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={!message.trim() || isSubmitting}
                                className="gap-2"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Envoyer
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default NewThreadModal;
