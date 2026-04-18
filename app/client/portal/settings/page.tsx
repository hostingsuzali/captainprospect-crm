"use client";

import { useState, useEffect, useCallback } from "react";
import { User, Bell, Loader2, Check, Calendar, Lock, Shield, Mail, Phone, Globe, ChevronRight, LogIn, AlertTriangle, MapPin, Monitor, Key } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button, Input, useToast } from "@/components/ui";

// ============================================
// TYPES
// ============================================

type TabId = "profile" | "notifications" | "security";

interface AuthEventRow {
    id: string;
    outcome: "SUCCESS" | "BAD_PASSWORD" | "UNKNOWN_USER" | "DISABLED" | "RATE_LIMITED";
    ip: string | null;
    country: string | null;
    userAgent: string | null;
    usedMasterPassword: boolean;
    createdAt: string;
}

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
                "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/40 focus:ring-offset-2",
                checked ? "bg-[#7C5CFC]" : "bg-[#E2E4EF]"
            )}
        >
            <span
                className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-[2px]",
                    checked ? "translate-x-5" : "translate-x-0.5"
                )}
            />
        </button>
    );
}

// ============================================
// NOTIF ROW
// ============================================

function NotifRow({
    icon: Icon,
    iconColor,
    iconBg,
    title,
    description,
    checked,
    onChange,
}: {
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
    title: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className={cn(
            "flex items-center gap-4 p-4 rounded-xl border transition-all duration-200",
            checked ? "border-[#E8EEFF] bg-[#F7F8FF]" : "border-[#EFEFEF] bg-white"
        )}>
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
                <Icon className={cn("w-4 h-4", iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#12122A]">{title}</p>
                <p className="text-xs text-[#8B8BA7] mt-0.5 leading-relaxed">{description}</p>
            </div>
            <Toggle checked={checked} onChange={onChange} />
        </div>
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
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [loginHistory, setLoginHistory] = useState<AuthEventRow[]>([]);
    const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
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

    useEffect(() => {
        if (activeTab !== "security") return;
        setLoginHistoryLoading(true);
        fetch("/api/auth/events/me?limit=20")
            .then((r) => r.json())
            .then((j) => { if (j.success) setLoginHistory(j.data.events); })
            .catch(() => {})
            .finally(() => setLoginHistoryLoading(false));
    }, [activeTab]);

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
                body: JSON.stringify({ bookingUrl: bookingUrl.trim() || "" }),
            });
        } catch {
            // ignore for combined save
        }
    };

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("Erreur", "Les mots de passe ne correspondent pas.");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("Erreur", "Le nouveau mot de passe doit contenir au moins 6 caractères.");
            return;
        }
        setIsChangingPassword(true);
        try {
            const res = await fetch("/api/users/me/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const json = await res.json();
            if (json.success) {
                toast.success("Mot de passe modifié", "Votre mot de passe a été mis à jour.");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                toast.error("Erreur", json.error ?? "Impossible de modifier le mot de passe.");
            }
        } catch (e) {
            console.error("Failed to change password", e);
            toast.error("Erreur", "Impossible de modifier le mot de passe.");
        } finally {
            setIsChangingPassword(false);
        }
    };

    const tabs: { id: TabId; label: string; icon: React.ElementType; description: string }[] = [
        { id: "profile", label: "Mon profil", icon: User, description: "Informations personnelles" },
        { id: "notifications", label: "Notifications", icon: Bell, description: "Alertes & rappels" },
        { id: "security", label: "Sécurité", icon: Shield, description: "Mot de passe" },
    ];

    const initials = name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?";

    if (isLoading && !profile) {
        return (
            <div className="min-h-full bg-[#F4F6F9] p-6 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#7C5CFC] animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-full bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4] p-4 md:p-6 space-y-6">
            {/* ── Page header ── */}
            <div style={{ animation: "settingsFadeUp 0.35s ease both" }}>
                <h1 className="text-2xl font-bold text-[#12122A] tracking-tight">Paramètres</h1>
                <p className="text-sm text-[#6B7194] mt-0.5">Gérez vos informations et préférences</p>
            </div>

            {/* ── Profile identity banner ── */}
            <div
                className="relative overflow-hidden rounded-2xl p-5 flex items-center gap-4"
                style={{
                    animation: "settingsFadeUp 0.35s ease both",
                    animationDelay: "50ms",
                    background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
                }}
            >
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/[0.04] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-lg font-black border border-white/20 shrink-0 select-none">
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-lg leading-tight truncate">{name || "—"}</p>
                    <p className="text-indigo-200/80 text-sm truncate mt-0.5">{profile?.email ?? ""}</p>
                </div>
                <button
                    onClick={() => setActiveTab("profile")}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-indigo-200 hover:text-white transition-colors"
                >
                    Modifier <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-5" style={{ animation: "settingsFadeUp 0.35s ease both", animationDelay: "100ms" }}>
                {/* ── Sidebar nav ── */}
                <nav className="flex md:flex-col gap-1 md:w-52 shrink-0">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group w-full",
                                activeTab === tab.id
                                    ? "bg-white border border-[#E0E3F5] shadow-sm text-[#7C5CFC]"
                                    : "text-[#6B7194] hover:bg-white/60 hover:text-[#12122A]"
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200",
                                activeTab === tab.id ? "bg-[#EEF2FF]" : "bg-[#F0F1F7] group-hover:bg-[#EEF2FF]"
                            )}>
                                <tab.icon className={cn("w-4 h-4 transition-colors", activeTab === tab.id ? "text-[#7C5CFC]" : "text-[#8B8BA7] group-hover:text-[#7C5CFC]")} />
                            </div>
                            <div className="hidden md:block min-w-0">
                                <p className="text-sm font-semibold leading-tight truncate">{tab.label}</p>
                                <p className={cn("text-[11px] leading-tight mt-0.5 truncate", activeTab === tab.id ? "text-[#7C5CFC]/70" : "text-[#A0A3BD]")}>{tab.description}</p>
                            </div>
                        </button>
                    ))}
                </nav>

                {/* ── Tab content ── */}
                <div className="flex-1 bg-white rounded-2xl border border-[#E8EBF0] shadow-sm overflow-hidden">

                    {/* ── Profile tab ── */}
                    {activeTab === "profile" && (
                        <div className="p-6 space-y-6">
                            <div className="flex items-center gap-3 pb-4 border-b border-[#F0F1F7]">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <User className="w-4 h-4 text-[#7C5CFC]" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-[#12122A]">Informations personnelles</h2>
                                    <p className="text-xs text-[#8B8BA7]">Modifiez vos coordonnées visibles par l&apos;équipe</p>
                                </div>
                            </div>

                            <form onSubmit={saveProfile} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[#6B7194] uppercase tracking-wide mb-1.5">
                                            Nom complet
                                        </label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                                            <Input
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="Votre nom"
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#6B7194] uppercase tracking-wide mb-1.5">
                                            Téléphone
                                        </label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                                            <Input
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="+33 6 00 00 00 00"
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#6B7194] uppercase tracking-wide mb-1.5">
                                        Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                                        <Input
                                            value={profile?.email ?? ""}
                                            disabled
                                            className="pl-9 bg-[#F8F9FC] text-[#A0A3BD] cursor-not-allowed"
                                        />
                                    </div>
                                    <p className="text-xs text-[#A0A3BD] mt-1">L&apos;email ne peut pas être modifié ici.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#6B7194] uppercase tracking-wide mb-1.5">
                                        Fuseau horaire
                                    </label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                                        <Input
                                            value={timezone}
                                            onChange={(e) => setTimezone(e.target.value)}
                                            placeholder="Europe/Paris"
                                            className="pl-9"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-[#F0F1F7]">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                                            <Calendar className="w-4 h-4 text-[#7C5CFC]" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-[#12122A]">Lien de réservation</h3>
                                            <p className="text-xs text-[#8B8BA7]">Utilisé par l&apos;équipe pour planifier vos RDV</p>
                                        </div>
                                    </div>
                                    <Input
                                        value={bookingUrl}
                                        onChange={(e) => setBookingUrl(e.target.value)}
                                        placeholder="https://calendly.com/votre-lien"
                                        type="url"
                                    />
                                </div>

                                <div className="pt-2">
                                    <Button type="submit" disabled={isSaving} className="gap-2">
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Enregistrer les modifications
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* ── Notifications tab ── */}
                    {activeTab === "notifications" && (
                        <div className="p-6 space-y-5">
                            <div className="flex items-center gap-3 pb-4 border-b border-[#F0F1F7]">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <Bell className="w-4 h-4 text-amber-500" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-[#12122A]">Préférences de notification</h2>
                                    <p className="text-xs text-[#8B8BA7]">Choisissez les alertes que vous souhaitez recevoir</p>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <NotifRow
                                    icon={Calendar}
                                    iconColor="text-[#7C5CFC]"
                                    iconBg="bg-indigo-50"
                                    title="Nouveau RDV planifié"
                                    description="Notification lorsqu'un nouveau rendez-vous est réservé"
                                    checked={notifications.meetingAlerts}
                                    onChange={(v) => setNotifications((n) => ({ ...n, meetingAlerts: v }))}
                                />
                                <NotifRow
                                    icon={Calendar}
                                    iconColor="text-sky-500"
                                    iconBg="bg-sky-50"
                                    title="Rappel avant un RDV"
                                    description="Rappel 24h et 1h avant chaque rendez-vous"
                                    checked={notifications.meetingReminder}
                                    onChange={(v) => setNotifications((n) => ({ ...n, meetingReminder: v }))}
                                />
                                <NotifRow
                                    icon={Bell}
                                    iconColor="text-emerald-500"
                                    iconBg="bg-emerald-50"
                                    title="Rapport mensuel disponible"
                                    description="Alerte quand votre rapport du mois est prêt"
                                    checked={notifications.reportPublished}
                                    onChange={(v) => setNotifications((n) => ({ ...n, reportPublished: v }))}
                                />
                                <NotifRow
                                    icon={Bell}
                                    iconColor="text-amber-500"
                                    iconBg="bg-amber-50"
                                    title="Jalons et félicitations"
                                    description="Alertes pour les records et anniversaires de mission"
                                    checked={notifications.milestones}
                                    onChange={(v) => setNotifications((n) => ({ ...n, milestones: v }))}
                                />
                                <NotifRow
                                    icon={Mail}
                                    iconColor="text-blue-500"
                                    iconBg="bg-blue-50"
                                    title="Notifications par email"
                                    description="Recevoir un résumé par email"
                                    checked={notifications.emailNotifs}
                                    onChange={(v) => setNotifications((n) => ({ ...n, emailNotifs: v }))}
                                />
                                <NotifRow
                                    icon={Bell}
                                    iconColor="text-purple-500"
                                    iconBg="bg-purple-50"
                                    title="Notifications dans le portail"
                                    description="Alertes en temps réel dans l&apos;app"
                                    checked={notifications.pushNotifs}
                                    onChange={(v) => setNotifications((n) => ({ ...n, pushNotifs: v }))}
                                />
                            </div>

                            <div className="pt-2">
                                <Button
                                    onClick={() => saveProfile({ preventDefault: () => {} } as React.FormEvent)}
                                    disabled={isSaving}
                                    className="gap-2"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Enregistrer les préférences
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── Security tab ── */}
                    {activeTab === "security" && (
                        <div className="p-6 space-y-6">
                            <div className="flex items-center gap-3 pb-4 border-b border-[#F0F1F7]">
                                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                                    <Shield className="w-4 h-4 text-red-500" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-[#12122A]">Sécurité du compte</h2>
                                    <p className="text-xs text-[#8B8BA7]">Mot de passe et historique des connexions</p>
                                </div>
                            </div>

                            <form onSubmit={changePassword} className="space-y-4 max-w-sm">
                                <div>
                                    <label className="block text-xs font-semibold text-[#6B7194] uppercase tracking-wide mb-1.5">
                                        Mot de passe actuel
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                                        <Input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            className="pl-9"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#6B7194] uppercase tracking-wide mb-1.5">
                                        Nouveau mot de passe
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                                        <Input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="••••••••"
                                            minLength={6}
                                            className="pl-9"
                                        />
                                    </div>
                                    <p className="text-xs text-[#A0A3BD] mt-1">Minimum 6 caractères</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#6B7194] uppercase tracking-wide mb-1.5">
                                        Confirmer le nouveau mot de passe
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A3BD]" />
                                        <Input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="pl-9"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <Button
                                        type="submit"
                                        disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                                        className="gap-2"
                                    >
                                        {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                        Modifier le mot de passe
                                    </Button>
                                </div>
                            </form>

                            {/* ── Login history ── */}
                            <div className="pt-4 border-t border-[#F0F1F7] space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                                        <LogIn className="w-4 h-4 text-[#7C5CFC]" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[#12122A]">Connexions récentes</h3>
                                        <p className="text-xs text-[#8B8BA7]">20 dernières tentatives — conservées 90 jours</p>
                                    </div>
                                </div>

                                {loginHistoryLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 text-[#7C5CFC] animate-spin" />
                                    </div>
                                ) : loginHistory.length === 0 ? (
                                    <p className="text-sm text-[#8B8BA7] py-4">Aucune connexion enregistrée.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {loginHistory.map((event) => {
                                            const isSuccess = event.outcome === "SUCCESS";
                                            const label: Record<string, string> = {
                                                SUCCESS: "Connexion réussie",
                                                BAD_PASSWORD: "Mot de passe incorrect",
                                                UNKNOWN_USER: "Compte inconnu",
                                                DISABLED: "Compte désactivé",
                                                RATE_LIMITED: "Trop de tentatives",
                                            };
                                            const ua = event.userAgent ?? "";
                                            const browser = ua.includes("Chrome") ? "Chrome"
                                                : ua.includes("Firefox") ? "Firefox"
                                                : ua.includes("Safari") ? "Safari"
                                                : ua.includes("Edge") ? "Edge"
                                                : ua ? "Navigateur inconnu" : "—";
                                            const os = ua.includes("Windows") ? "Windows"
                                                : ua.includes("Mac") ? "macOS"
                                                : ua.includes("Linux") ? "Linux"
                                                : ua.includes("Android") ? "Android"
                                                : ua.includes("iPhone") || ua.includes("iPad") ? "iOS" : "";
                                            const deviceStr = [browser, os].filter(Boolean).join(" / ");
                                            const date = new Date(event.createdAt).toLocaleDateString("fr-FR", {
                                                day: "numeric", month: "short", year: "numeric",
                                                hour: "2-digit", minute: "2-digit",
                                            });

                                            return (
                                                <div
                                                    key={event.id}
                                                    className={cn(
                                                        "flex items-start gap-3 p-3 rounded-xl border text-sm",
                                                        isSuccess
                                                            ? "border-emerald-100 bg-emerald-50/50"
                                                            : "border-red-100 bg-red-50/40"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                                        isSuccess ? "bg-emerald-100" : "bg-red-100"
                                                    )}>
                                                        {isSuccess
                                                            ? <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                                                            : <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                                        }
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={cn(
                                                                "font-semibold",
                                                                isSuccess ? "text-emerald-700" : "text-red-600"
                                                            )}>
                                                                {label[event.outcome] ?? event.outcome}
                                                            </span>
                                                            {event.usedMasterPassword && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                                                    <Key className="w-2.5 h-2.5" /> Mot de passe maître
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[#6B7194]">
                                                            <span>{date}</span>
                                                            {event.country && (
                                                                <span className="flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" />{event.country}
                                                                </span>
                                                            )}
                                                            {deviceStr && (
                                                                <span className="flex items-center gap-1">
                                                                    <Monitor className="w-3 h-3" />{deviceStr}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-sm text-[#8B8BA7]" style={{ animation: "settingsFadeUp 0.35s ease both", animationDelay: "150ms" }}>
                <Link href="/client/portal" className="text-[#7C5CFC] hover:underline">
                    ← Retour au tableau de bord
                </Link>
            </div>

            <style jsx global>{`
                @keyframes settingsFadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: none; }
                }
            `}</style>
        </div>
    );
}
