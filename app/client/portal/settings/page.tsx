"use client";

import { useState, useEffect, useCallback } from "react";
import { User, Bell, Loader2, Check, Calendar } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button, Input, useToast } from "@/components/ui";

// ============================================
// TYPES
// ============================================

type TabId = "profile" | "notifications";

interface ProfileData {
    name: string;
    email: string;
    phone: string;
    timezone: string;
    preferences: {
        notifications: Record<string, boolean>;
    };
}

// ============================================
// TOGGLE
// ============================================

function Toggle({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "relative inline-flex h-7 w-12 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] focus:ring-offset-2",
                checked ? "bg-[#7C5CFC]" : "bg-[#E8EBF0]"
            )}
        >
            <span
                className={cn(
                    "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200",
                    checked ? "translate-x-5" : "translate-x-0.5"
                )}
                style={{ marginTop: "2px" }}
            />
        </button>
    );
}

// ============================================
// MAIN PAGE
// ============================================

export default function ClientPortalSettingsPage() {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<TabId>("profile");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [bookingUrl, setBookingUrl] = useState("");

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [timezone, setTimezone] = useState("Europe/Paris");
    const [notifications, setNotifications] = useState({
        meetingAlerts: true,
        emailNotifs: true,
        pushNotifs: true,
        reportPublished: true,
        meetingReminder: true,
        milestones: true,
    });

    const loadProfile = useCallback(async () => {
        try {
            const res = await fetch("/api/users/me/profile");
            const json = await res.json();
            if (json.success && json.data) {
                const d = json.data;
                setProfile(d);
                setName(d.name ?? "");
                setPhone(d.phone ?? "");
                setTimezone(d.timezone ?? "Europe/Paris");
                setNotifications({
                    meetingAlerts: d.preferences?.notifications?.meetingAlerts ?? true,
                    emailNotifs: d.preferences?.notifications?.emailNotifs ?? true,
                    pushNotifs: d.preferences?.notifications?.pushNotifs ?? true,
                    reportPublished: d.preferences?.notifications?.reportPublished ?? true,
                    meetingReminder: d.preferences?.notifications?.meetingReminder ?? true,
                    milestones: d.preferences?.notifications?.milestones ?? true,
                });
            }
        } catch (e) {
            console.error("Failed to load profile", e);
            toast.error("Erreur", "Impossible de charger le profil");
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    const loadClientSettings = useCallback(async () => {
        try {
            const res = await fetch("/api/client/me/settings");
            const json = await res.json();
            if (json.success && json.data?.bookingUrl != null) {
                setBookingUrl(json.data.bookingUrl ?? "");
            }
        } catch (e) {
            console.error("Failed to load client settings", e);
        }
    }, []);

    useEffect(() => {
        loadProfile();
        loadClientSettings();
    }, [loadProfile, loadClientSettings]);

    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch("/api/users/me/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim() || undefined,
                    phone: phone.trim() || null,
                    timezone: timezone.trim() || undefined,
                    preferences: {
                        notifications: {
                            meetingAlerts: notifications.meetingAlerts,
                            emailNotifs: notifications.emailNotifs,
                            pushNotifs: notifications.pushNotifs,
                            reportPublished: notifications.reportPublished,
                            meetingReminder: notifications.meetingReminder,
                            milestones: notifications.milestones,
                        },
                    },
                }),
            });
            const json = await res.json();
            if (json.success) {
                await saveClientSettingsSilent();
                toast.success("Profil mis à jour", "Vos informations ont été enregistrées.");
                loadProfile();
                loadClientSettings();
            } else {
                toast.error("Erreur", json.error ?? "Enregistrement impossible");
            }
        } catch (e) {
            console.error("Failed to save profile", e);
            toast.error("Erreur", "Impossible d'enregistrer");
        } finally {
            setIsSaving(false);
        }
    };

    const saveClientSettingsSilent = async () => {
        try {
            await fetch("/api/client/me/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookingUrl: bookingUrl.trim() || "",
                }),
            });
        } catch {
            // ignore for combined save
        }
    };

    const saveClientSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch("/api/client/me/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookingUrl: bookingUrl.trim() || "",
                }),
            });
            const json = await res.json();
            if (json.success) {
                toast.success("Paramètres enregistrés", "Le lien de réservation a été mis à jour.");
                loadClientSettings();
            } else {
                toast.error("Erreur", json.error ?? "Enregistrement impossible");
            }
        } catch (e) {
            console.error("Failed to save client settings", e);
            toast.error("Erreur", "Impossible d'enregistrer");
        } finally {
            setIsSaving(false);
        }
    };

    const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
        { id: "profile", label: "Mon profil", icon: User },
        { id: "notifications", label: "Notifications", icon: Bell },
    ];

    if (isLoading && !profile) {
        return (
            <div className="min-h-full bg-[#F4F6F9] p-6 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#7C5CFC] animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-full bg-gradient-to-b from-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-6">
            <div className="animate-fade-up">
                <h1 className="text-2xl font-bold text-[#12122A] tracking-tight">
                    Parametres
                </h1>
                <p className="text-sm text-[#6B7194] mt-0.5">
                    Gerez vos informations et preferences
                </p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <nav className="flex md:flex-col gap-1 md:w-48">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                activeTab === tab.id
                                    ? "bg-[#EEF2FF] text-[#7C5CFC]"
                                    : "text-[#8B8BA7] hover:bg-white hover:border border border-transparent border-[#E8EBF0]"
                            )}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <div className="flex-1 bg-white rounded-2xl border border-[#E8EBF0] overflow-hidden">
                    {activeTab === "profile" && (
                        <div className="p-6 space-y-6">
                            <h2 className="text-lg font-semibold text-[#12122A]">
                                Informations personnelles
                            </h2>

                            <form onSubmit={saveProfile} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-[#12122A] mb-1.5">
                                        Nom
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Votre nom"
                                        className="max-w-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[#12122A] mb-1.5">
                                        Email
                                    </label>
                                    <Input
                                        value={profile?.email ?? ""}
                                        disabled
                                        className="max-w-md bg-[#F4F6F9] text-[#8B8BA7]"
                                    />
                                    <p className="text-xs text-[#8B8BA7] mt-1">
                                        L&apos;email ne peut pas être modifié ici.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[#12122A] mb-1.5">
                                        Téléphone
                                    </label>
                                    <Input
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+33 6 00 00 00 00"
                                        className="max-w-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[#12122A] mb-1.5">
                                        Fuseau horaire
                                    </label>
                                    <Input
                                        value={timezone}
                                        onChange={(e) => setTimezone(e.target.value)}
                                        placeholder="Europe/Paris"
                                        className="max-w-md"
                                    />
                                </div>

                                <div className="pt-4 border-t border-[#E8EBF0]">
                                    <h3 className="text-sm font-semibold text-[#12122A] mb-3 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-[#7C5CFC]" />
                                        Lien de réservation (Calendly, etc.)
                                    </h3>
                                    <Input
                                        value={bookingUrl}
                                        onChange={(e) => setBookingUrl(e.target.value)}
                                        placeholder="https://calendly.com/votre-lien"
                                        type="url"
                                        className="max-w-md"
                                    />
                                    <p className="text-xs text-[#8B8BA7] mt-1">
                                        Lien utilisé par l&apos;équipe pour planifier vos RDV.
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <Button
                                        type="submit"
                                        disabled={isSaving}
                                        className="gap-2"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Check className="w-4 h-4" />
                                        )}
                                        Enregistrer
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === "notifications" && (
                        <div className="p-6 space-y-6">
                            <h2 className="text-lg font-semibold text-[#12122A]">
                                Préférences de notification
                            </h2>
                            <p className="text-sm text-[#8B8BA7]">
                                Choisissez les alertes que vous souhaitez recevoir dans le portail.
                            </p>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-xl border border-[#E8EBF0]">
                                    <div>
                                        <p className="text-sm font-medium text-[#12122A]">
                                            Nouveau RDV planifie
                                        </p>
                                        <p className="text-xs text-[#8B8BA7] mt-0.5">
                                            Notification lorsqu&apos;un nouveau rendez-vous est reserve
                                        </p>
                                    </div>
                                    <Toggle
                                        checked={notifications.meetingAlerts}
                                        onChange={(v) =>
                                            setNotifications((n) => ({ ...n, meetingAlerts: v }))
                                        }
                                    />
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-xl border border-[#E8EBF0]">
                                    <div>
                                        <p className="text-sm font-medium text-[#12122A]">
                                            Rapport mensuel disponible
                                        </p>
                                        <p className="text-xs text-[#8B8BA7] mt-0.5">
                                            Alerte quand votre rapport du mois est pret
                                        </p>
                                    </div>
                                    <Toggle
                                        checked={notifications.reportPublished}
                                        onChange={(v) =>
                                            setNotifications((n) => ({ ...n, reportPublished: v }))
                                        }
                                    />
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-xl border border-[#E8EBF0]">
                                    <div>
                                        <p className="text-sm font-medium text-[#12122A]">
                                            Rappel avant un RDV
                                        </p>
                                        <p className="text-xs text-[#8B8BA7] mt-0.5">
                                            Rappel 24h et 1h avant chaque rendez-vous
                                        </p>
                                    </div>
                                    <Toggle
                                        checked={notifications.meetingReminder}
                                        onChange={(v) =>
                                            setNotifications((n) => ({ ...n, meetingReminder: v }))
                                        }
                                    />
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-xl border border-[#E8EBF0]">
                                    <div>
                                        <p className="text-sm font-medium text-[#12122A]">
                                            Jalons et felicitations
                                        </p>
                                        <p className="text-xs text-[#8B8BA7] mt-0.5">
                                            Alertes pour les records et anniversaires de mission
                                        </p>
                                    </div>
                                    <Toggle
                                        checked={notifications.milestones}
                                        onChange={(v) =>
                                            setNotifications((n) => ({ ...n, milestones: v }))
                                        }
                                    />
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-xl border border-[#E8EBF0]">
                                    <div>
                                        <p className="text-sm font-medium text-[#12122A]">
                                            Notifications par email
                                        </p>
                                        <p className="text-xs text-[#8B8BA7] mt-0.5">
                                            Recevoir un resume par email
                                        </p>
                                    </div>
                                    <Toggle
                                        checked={notifications.emailNotifs}
                                        onChange={(v) =>
                                            setNotifications((n) => ({ ...n, emailNotifs: v }))
                                        }
                                    />
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-xl border border-[#E8EBF0]">
                                    <div>
                                        <p className="text-sm font-medium text-[#12122A]">
                                            Notifications dans le portail
                                        </p>
                                        <p className="text-xs text-[#8B8BA7] mt-0.5">
                                            Alertes en temps reel dans l&apos;app
                                        </p>
                                    </div>
                                    <Toggle
                                        checked={notifications.pushNotifs}
                                        onChange={(v) =>
                                            setNotifications((n) => ({ ...n, pushNotifs: v }))
                                        }
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={() => {
                                    saveProfile({ preventDefault: () => {} } as React.FormEvent);
                                }}
                                disabled={isSaving}
                                className="gap-2"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                Enregistrer les préférences
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-sm text-[#8B8BA7]">
                <Link href="/client/portal" className="text-[#7C5CFC] hover:underline">
                    Retour au tableau de bord
                </Link>
            </div>
        </div>
    );
}
