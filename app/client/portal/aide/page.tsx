"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

// ============================================
// FAQ SECTIONS (French)
// ============================================

const SECTIONS: { id: string; title: string; content: React.ReactNode }[] = [
    {
        id: "intro",
        title: "Qu'est-ce que le portail client ?",
        content: (
            <p className="text-[#12122A] text-sm leading-relaxed">
                Le portail client vous permet de suivre l&apos;activité de prospection de notre équipe
                pour vos missions : statistiques, contacts qualifiés (opportunités), rendez-vous réservés,
                échanges par messages et fichiers. Vous y accédez après connexion avec vos identifiants.
            </p>
        ),
    },
    {
        id: "accueil",
        title: "Accueil (tableau de bord)",
        content: (
            <div className="text-sm text-[#12122A] space-y-2">
                <p>
                    Sur l&apos;accueil vous retrouvez : les statistiques sur la période choisie (nombre
                    d&apos;actions, RDV, opportunités, taux de conversion), les contacts qualifiés pour vous
                    avec export CSV, la liste de vos missions en cours, un accès rapide à l&apos;activité email
                    et un lien vers vos RDV.
                </p>
                <p>
                    Utilisez le filtre de date en haut à droite pour changer la période affichée.
                </p>
            </div>
        ),
    },
    {
        id: "rdv",
        title: "Mes RDV",
        content: (
            <div className="text-sm text-[#12122A] space-y-2">
                <p>
                    La page « Mes RDV » liste tous les rendez-vous réservés pour vos missions. Vous pouvez
                    filtrer par plage de dates, mission ou campagne, et voir pour chaque RDV le contact,
                    l&apos;entreprise et la mission concernée.
                </p>
                <p>
                    Les RDV sont enregistrés par notre équipe lorsqu&apos;un prospect réserve un créneau
                    (par exemple via un lien Calendly).
                </p>
            </div>
        ),
    },
    {
        id: "messages",
        title: "Messages / Contacter",
        content: (
            <div className="text-sm text-[#12122A] space-y-2">
                <p>
                    L&apos;onglet « Messages » ou « Contacter » vous permet d&apos;échanger en direct avec
                    un manager. Les conversations sont organisées par fil (sujet). Vous recevez des
                    notifications pour les nouveaux messages.
                </p>
                <p>
                    Utilisez cette voie pour toute question ou demande concernant vos campagnes.
                </p>
            </div>
        ),
    },
    {
        id: "email",
        title: "Mon Email",
        content: (
            <p className="text-sm text-[#12122A] leading-relaxed">
                « Mon Email » permet de connecter une boîte Gmail ou Outlook (OAuth) pour consulter et
                gérer les échanges liés à vos missions depuis le portail. Après connexion, vous accédez
                à votre messagerie dans l&apos;onglet dédié.
            </p>
        ),
    },
    {
        id: "fichiers",
        title: "Mes Fichiers",
        content: (
            <p className="text-sm text-[#12122A] leading-relaxed">
                « Mes Fichiers » regroupe les documents déposés pour votre compte (par vous ou l&apos;équipe),
                organisés par dossiers. Vous pouvez parcourir les fichiers, les télécharger et en ajouter.
                Vous êtes notifié lorsqu&apos;un nouveau fichier est déposé.
            </p>
        ),
    },
    {
        id: "parametres",
        title: "Paramètres",
        content: (
            <div className="text-sm text-[#12122A] space-y-2">
                <p>
                    Dans Paramètres vous pouvez modifier vos informations personnelles (nom, téléphone,
                    fuseau horaire), le lien de réservation (Calendly, etc.) utilisé pour planifier vos
                    RDV, et vos préférences de notifications (alertes RDV, email, notifications dans le
                    portail).
                </p>
                <p>
                    <Link
                        href="/client/portal/settings"
                        className="text-[#7C5CFC] font-medium hover:underline inline-flex items-center gap-1"
                    >
                        Accéder aux paramètres
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </p>
            </div>
        ),
    },
    {
        id: "contact",
        title: "Qui contacter en cas de question ?",
        content: (
            <div className="text-sm text-[#12122A] space-y-2">
                <p>
                    Pour toute question sur l&apos;utilisation du portail ou sur vos missions, utilisez
                    la section « Messages » / « Contacter » dans le portail pour joindre un manager.
                </p>
            </div>
        ),
    },
];

// ============================================
// PAGE
// ============================================

export default function ClientPortalAidePage() {
    const [expandedId, setExpandedId] = useState<string | null>(SECTIONS[0].id);

    return (
        <div className="min-h-full bg-[#F4F6F9] p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-bold text-[#12122A] tracking-tight flex items-center gap-2">
                        <HelpCircle className="w-6 h-6 text-[#7C5CFC]" />
                        Aide
                    </h1>
                    <p className="text-[13px] text-[#8B8BA7] mt-0.5">
                        Questions fréquentes et guide du portail client
                    </p>
                </div>
                <Link href="/client/portal">
                    <Button variant="outline" size="sm" className="gap-2">
                        <ArrowRight className="w-4 h-4 rotate-180" />
                        Retour au tableau de bord
                    </Button>
                </Link>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8EBF0] overflow-hidden">
                <div className="divide-y divide-[#E8EBF0]">
                    {SECTIONS.map((section) => {
                        const isExpanded = expandedId === section.id;
                        return (
                            <div key={section.id}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setExpandedId(isExpanded ? null : section.id)
                                    }
                                    className={cn(
                                        "w-full flex items-center justify-between gap-4 px-6 py-4 text-left transition-colors",
                                        isExpanded
                                            ? "bg-[#EEF2FF] text-[#12122A]"
                                            : "hover:bg-[#F4F6F9] text-[#12122A]"
                                    )}
                                >
                                    <span className="font-medium text-[15px]">
                                        {section.title}
                                    </span>
                                    {isExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-[#7C5CFC] flex-shrink-0" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-[#8B8BA7] flex-shrink-0" />
                                    )}
                                </button>
                                {isExpanded && (
                                    <div className="px-6 pb-5 pt-0 bg-white">
                                        <div className="pl-0 border-l-0">{section.content}</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
