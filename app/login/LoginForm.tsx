"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Card, CardContent } from "@/components/ui";
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";
import Image from "next/image";

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError("Email ou mot de passe incorrect");
                setIsLoading(false);
                return;
            }

            // Fetch session to get role and redirect
            const response = await fetch("/api/auth/session");
            const session = await response.json();

            if (session?.user?.role) {
                const redirectPaths: Record<string, string> = {
                    SDR: "/sdr/action",
                    MANAGER: "/manager/dashboard",
                    CLIENT: "/client/portal",
                    DEVELOPER: "/developer/dashboard",
                    BUSINESS_DEVELOPER: "/bd/dashboard",
                };
                const redirectPath = redirectPaths[session.user.role] || "/";
                router.push(redirectPath);
            } else {
                router.push(callbackUrl);
            }
        } catch {
            setError("Une erreur est survenue");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-cyan-50/40 p-4 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-cyan-200/30 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-indigo-200/25 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-100/20 rounded-full blur-3xl" />
                {/* Subtle grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: "radial-gradient(circle at 1px 1px, rgb(100 116 139) 1px, transparent 0)",
                        backgroundSize: "32px 32px",
                    }}
                />
            </div>

            <div className="w-full max-w-[440px] relative z-10">
                {/* Logo section - above card */}
                <div className="flex justify-center mb-6">
                    <Image
                        src="/63a4904c16e186b9c414f3ba_captain_prospect_logo.webp"
                        alt="Captain Prospect"
                        width={180}
                        height={56}
                        className="h-12 w-auto object-contain"
                        priority
                    />
                </div>

                <Card variant="glass" className="shadow-2xl shadow-slate-200/60 border-white/60 backdrop-blur-xl">
                    <CardContent>
                        {/* Welcome heading */}
                        <div className="text-center mb-8">
                            <h2 className="text-xl font-semibold text-slate-800">
                                Bienvenue
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                Connectez-vous pour accéder à votre espace
                            </p>
                        </div>

                        {/* Login Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <Input
                                id="email"
                                type="email"
                                label="Adresse email"
                                placeholder="votre@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={<Mail className="w-4 h-4 text-slate-400" />}
                                required
                                autoComplete="email"
                            />

                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                label="Mot de passe"
                                placeholder="Entrez votre mot de passe"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                icon={<Lock className="w-4 h-4 text-slate-400" />}
                                endIcon={
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                }
                                required
                                autoComplete="current-password"
                            />

                            {/* Error message */}
                            {error && (
                                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm animate-[shake_0.3s_ease-in-out]">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="pt-1">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    className="w-full group"
                                    isLoading={isLoading}
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        Se connecter
                                        {!isLoading && (
                                            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                                        )}
                                    </span>
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Footer */}
                <p className="text-center text-slate-400 text-xs mt-6 tracking-wide">
                    Captain Prospect &copy; {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
}