"use client";

import { Modal, Button } from "@/components/ui";
import { Phone, Mail, Linkedin } from "lucide-react";
import type { ScheduleBlockForCard } from "./ScheduleBlockCard";

const CHANNEL_ICONS: Record<string, typeof Phone> = {
    CALL: Phone,
    EMAIL: Mail,
    LINKEDIN: Linkedin,
};

interface BlockPopoverProps {
    block: ScheduleBlockForCard | null;
    onClose: () => void;
    onConfirm?: (blockId: string) => void;
    onReject?: (blockId: string) => void;
    onEdit?: (blockId: string) => void;
    onCancelBlock?: (blockId: string) => void;
    isConfirming?: boolean;
    isRejecting?: boolean;
}

export function BlockPopover({
    block,
    onClose,
    onConfirm,
    onReject,
    onEdit,
    onCancelBlock,
    isConfirming = false,
    isRejecting = false,
}: BlockPopoverProps) {
    if (!block) return null;

    const isSuggested = block.suggestionStatus === "SUGGESTED";
    const channel = block.mission?.channel || "CALL";
    const Icon = CHANNEL_ICONS[channel] || Phone;

    return (
        <Modal isOpen={true} onClose={onClose} title="Créneau">
            <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-lg space-y-2 text-sm">
                    <p>
                        <span className="font-medium text-slate-500">Mission</span>{" "}
                        {block.mission.name}
                    </p>
                    <p>
                        <span className="font-medium text-slate-500">SDR</span>{" "}
                        {block.sdr.name}
                    </p>
                    <p>
                        <span className="font-medium text-slate-500">Date</span>{" "}
                        {new Date(block.date).toLocaleDateString("fr-FR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                        })}
                    </p>
                    <p>
                        <span className="font-medium text-slate-500">Horaire</span>{" "}
                        {block.startTime} – {block.endTime}
                    </p>
                    <p className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-500" />
                        <span>{channel}</span>
                    </p>
                </div>

                {isSuggested ? (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onConfirm?.(block.id)}
                            disabled={isConfirming}
                            isLoading={isConfirming}
                        >
                            Confirmer
                        </Button>
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={() => onReject?.(block.id)}
                            disabled={isRejecting}
                            isLoading={isRejecting}
                        >
                            Rejeter
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => onEdit?.(block.id)}>
                            Modifier et confirmer
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => onEdit?.(block.id)}>
                            Modifier
                        </Button>
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={() => onCancelBlock?.(block.id)}
                        >
                            Annuler ce créneau
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
