"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Zap, Shield } from "lucide-react";
import Image from "next/image";

/* ─── tiny util ─── */
const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(" ");

/* ─────────────────────────────────────────────────────────────
   Animated canvas background: floating orbs + grid lines
───────────────────────────────────────────────────────────── */
function AnimatedBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animId: number;
        let W = 0, H = 0;

        // Particles
        const PARTICLES = 55;
        type P = { x: number; y: number; vx: number; vy: number; r: number; alpha: number; pulse: number };
        const pts: P[] = [];

        const init = () => {
            W = canvas.width = canvas.offsetWidth;
            H = canvas.height = canvas.offsetHeight;
            pts.length = 0;
            for (let i = 0; i < PARTICLES; i++) {
                pts.push({
                    x: Math.random() * W, y: Math.random() * H,
                    vx: (Math.random() - 0.5) * 0.35,
                    vy: (Math.random() - 0.5) * 0.35,
                    r: Math.random() * 2.2 + 0.8,
                    alpha: Math.random() * 0.5 + 0.15,
                    pulse: Math.random() * Math.PI * 2,
                });
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, W, H);

            // Subtle grid
            ctx.strokeStyle = "rgba(99,102,241,0.04)";
            ctx.lineWidth = 1;
            const gap = 52;
            for (let x = 0; x < W; x += gap) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
            for (let y = 0; y < H; y += gap) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

            // Connection lines
            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 110) {
                        ctx.strokeStyle = `rgba(99,102,241,${0.12 * (1 - dist / 110)})`;
                        ctx.lineWidth = 0.7;
                        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
                    }
                }
            }

            // Dots
            pts.forEach(p => {
                p.pulse += 0.018;
                const dynamic = p.alpha + Math.sin(p.pulse) * 0.12;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(139,92,246,${Math.max(0, dynamic)})`;
                ctx.fill();

                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
                if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
            });

            animId = requestAnimationFrame(draw);
        };

        init();
        draw();
        const ro = new ResizeObserver(init);
        ro.observe(canvas);
        return () => { cancelAnimationFrame(animId); ro.disconnect(); };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}



/* ─────────────────────────────────────────────────────────────
   Custom Input
───────────────────────────────────────────────────────────── */
interface InputProps {
    id: string;
    type: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    leadingIcon: React.ReactNode;
    trailingNode?: React.ReactNode;
    required?: boolean;
    autoComplete?: string;
    hasError?: boolean;
}

function StyledInput({ id, type, label, placeholder, value, onChange, leadingIcon, trailingNode, required, autoComplete, hasError }: InputProps) {
    const [focused, setFocused] = useState(false);
    const filled = value.length > 0;

    return (
        <div className="relative">
            {/* Label */}
            <label
                htmlFor={id}
                className={cn(
                    "absolute left-10 font-medium pointer-events-none transition-all duration-200 z-10",
                    (focused || filled)
                        ? "top-2 text-[10px] text-indigo-500 tracking-wide uppercase"
                        : "top-1/2 -translate-y-1/2 text-[13px] text-slate-400"
                )}
            >
                {label}
            </label>

            {/* Leading icon */}
            <div className={cn(
                "absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200",
                focused ? "text-indigo-500" : "text-slate-400"
            )}>
                {leadingIcon}
            </div>

            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={focused ? placeholder : ""}
                required={required}
                autoComplete={autoComplete}
                className={cn(
                    "w-full pt-6 pb-2.5 pl-10 pr-11 rounded-xl border bg-white/70 backdrop-blur-sm",
                    "text-slate-800 text-sm placeholder:text-slate-300 outline-none",
                    "transition-all duration-200",
                    focused
                        ? "border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.12)] bg-white/90"
                        : hasError
                            ? "border-red-300 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]"
                            : "border-slate-200/80 hover:border-slate-300"
                )}
            />

            {trailingNode && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">{trailingNode}</div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   Main LoginForm
───────────────────────────────────────────────────────────── */
export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setTimeout(() => setMounted(true), 80); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const result = await signIn("credentials", { email, password, redirect: false });

            if (result?.error) {
                setError("Email ou mot de passe incorrect");
                setIsLoading(false);
                return;
            }

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
                router.push(redirectPaths[session.user.role] || "/");
            } else {
                router.push(callbackUrl);
            }
        } catch {
            setError("Une erreur est survenue");
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* ── Global keyframes injected once ── */}
            <style>{`
                @keyframes featureFadeIn {
                    from { opacity: 0; transform: translateX(-18px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes cardRise {
                    from { opacity: 0; transform: translateY(28px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes logoReveal {
                    from { opacity: 0; transform: translateY(-14px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20%       { transform: translateX(-6px); }
                    40%       { transform: translateX(6px); }
                    60%       { transform: translateX(-4px); }
                    80%       { transform: translateX(4px); }
                }
                @keyframes gradientShift {
                    0%   { background-position: 0% 50%; }
                    50%  { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes orbFloat {
                    0%, 100% { transform: translateY(0px) scale(1); }
                    50%      { transform: translateY(-22px) scale(1.04); }
                }
                @keyframes errorSlide {
                    from { opacity:0; transform: translateY(-8px); }
                    to   { opacity:1; transform: translateY(0); }
                }
                .btn-glow:hover {
                    box-shadow: 0 0 28px rgba(99,102,241,0.55), 0 4px 16px rgba(99,102,241,0.3);
                }
                .btn-glow:active { transform: scale(0.98); }
            `}</style>

            <div className="min-h-screen flex overflow-hidden">

                {/* ════════════════════════════════════════
                    LEFT PANEL — brand / elegant minimal content
                ════════════════════════════════════════ */}
                <div className="hidden lg:flex lg:w-[52%] xl:w-[56%] relative flex-col p-12 overflow-hidden"
                    style={{
                        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4c1d95 60%, #1e1b4b 100%)",
                        backgroundSize: "300% 300%",
                        animation: "gradientShift 12s ease infinite",
                    }}
                >
                    {/* Canvas particles */}
                    <AnimatedBackground />

                    {/* Glowing orbs */}
                    <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
                        style={{ background: "radial-gradient(circle, #818cf8, transparent 70%)", animation: "orbFloat 7s ease-in-out infinite" }} />
                    <div className="absolute -bottom-32 -right-12 w-[420px] h-[420px] rounded-full opacity-15"
                        style={{ background: "radial-gradient(circle, #a78bfa, transparent 70%)", animation: "orbFloat 9s ease-in-out infinite reverse" }} />
                    <div className="absolute top-1/2 right-0 w-[260px] h-[260px] rounded-full opacity-10"
                        style={{ background: "radial-gradient(circle, #06b6d4, transparent 70%)" }} />

                    {/* Content Top */}
                    <div className="relative z-10 flex-none">
                        {/* Logo */}
                        <div className="opacity-0 animate-[logoReveal_0.7s_ease_0.1s_forwards]">
                            <Image
                                src="/63a4904c16e186b9c414f3ba_captain_prospect_logo.webp"
                                alt="Captain Prospect"
                                width={160}
                                height={48}
                                className="h-10 w-auto object-contain brightness-0 invert"
                                priority
                            />
                        </div>
                    </div>

                    {/* Content Center */}
                    <div className="relative z-10 flex-1 flex flex-col justify-center">
                        <div className="opacity-0 animate-[featureFadeIn_0.6s_ease_0.3s_forwards]">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 mb-6">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs font-medium text-white/70 tracking-wide">Espace Sécurisé</span>
                            </div>
                            <h1 className="text-4xl xl:text-5xl font-light text-white leading-tight tracking-tight">
                                L'excellence de la <br />
                                <span className="text-transparent bg-clip-text font-bold"
                                    style={{ backgroundImage: "linear-gradient(90deg, #a5b4fc, #67e8f9)" }}>
                                    prospection
                                </span>{" "}
                                B2B.
                            </h1>
                            <p className="mt-5 text-base text-white/50 max-w-sm font-light leading-relaxed">
                                Connectez-vous pour accéder à votre espace de travail.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ════════════════════════════════════════
                    RIGHT PANEL — login form
                ════════════════════════════════════════ */}
                <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative overflow-hidden"
                    style={{ background: "linear-gradient(160deg, #f8faff 0%, #eef2ff 40%, #f0f9ff 100%)" }}
                >
                    {/* Soft background shapes */}
                    <div className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full opacity-25 pointer-events-none"
                        style={{ background: "radial-gradient(circle, #c7d2fe, transparent 70%)", transform: "translate(30%, -30%)" }} />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-20 pointer-events-none"
                        style={{ background: "radial-gradient(circle, #bfdbfe, transparent 70%)", transform: "translate(-30%, 30%)" }} />
                    <div className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(99,102,241,0.06) 1px, transparent 0)",
                            backgroundSize: "28px 28px",
                        }} />

                    {/* Mobile logo */}
                    <div className="lg:hidden mb-8 opacity-0 animate-[logoReveal_0.6s_ease_0.1s_forwards]">
                        <Image
                            src="/63a4904c16e186b9c414f3ba_captain_prospect_logo.webp"
                            alt="Captain Prospect"
                            width={160}
                            height={48}
                            className="h-10 w-auto object-contain"
                            priority
                        />
                    </div>

                    {/* Card */}
                    <div
                        className={cn(
                            "relative z-10 w-full max-w-[420px]",
                            "opacity-0",
                            mounted && "animate-[cardRise_0.65s_cubic-bezier(0.22,1,0.36,1)_0.15s_forwards]"
                        )}
                    >
                        {/* Card shell */}
                        <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/70 shadow-[0_8px_60px_rgba(99,102,241,0.12),0_2px_16px_rgba(0,0,0,0.06)] p-8 sm:p-10">

                            {/* Header */}
                            <div className="mb-8">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 mb-4">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                    <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest">Connexion sécurisée</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800 leading-tight">
                                    Bon retour ! 👋
                                </h2>
                                <p className="text-[13px] text-slate-400 mt-1.5 leading-relaxed">
                                    Connectez-vous pour accéder à votre espace de travail
                                </p>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                                <StyledInput
                                    id="email"
                                    type="email"
                                    label="Adresse email"
                                    placeholder="votre@email.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    leadingIcon={<Mail className="w-4 h-4" />}
                                    required
                                    autoComplete="email"
                                    hasError={!!error}
                                />

                                <StyledInput
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    label="Mot de passe"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    leadingIcon={<Lock className="w-4 h-4" />}
                                    trailingNode={
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            tabIndex={-1}
                                            aria-label={showPassword ? "Masquer" : "Afficher"}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-150 focus:outline-none"
                                        >
                                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                    }
                                    required
                                    autoComplete="current-password"
                                    hasError={!!error}
                                />

                                {/* Forgot password */}
                                <div className="flex justify-end -mt-1">
                                    <button type="button" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors duration-150">
                                        Mot de passe oublié ?
                                    </button>
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-500 text-sm"
                                        style={{ animation: "errorSlide 0.3s ease, shake 0.4s ease 0.05s" }}>
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Submit */}
                                <div className="pt-2">
                                    <button
                                        id="login-submit"
                                        type="submit"
                                        disabled={isLoading}
                                        className={cn(
                                            "w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl",
                                            "text-white font-semibold text-[15px] tracking-wide",
                                            "transition-all duration-200 btn-glow",
                                            "disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                                        )}
                                        style={{
                                            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #7c3aed 100%)",
                                        }}
                                    >
                                        {isLoading ? (
                                            <>
                                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                <span>Connexion en cours…</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Se connecter</span>
                                                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>

                            {/* Divider */}
                            <div className="flex items-center gap-3 my-6">
                                <div className="flex-1 h-px bg-slate-100" />
                                <span className="text-[11px] text-slate-300 font-medium">Accès réservé</span>
                                <div className="flex-1 h-px bg-slate-100" />
                            </div>

                            {/* Security badges */}
                            <div className="flex items-center justify-center gap-4">
                                {[
                                    { icon: Shield, label: "SSL / TLS" },
                                    { icon: Lock, label: "Chiffré" },
                                    { icon: Zap, label: "2FA prêt" },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex flex-col items-center gap-1">
                                        <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                                            <Icon className="w-3.5 h-3.5 text-slate-400" />
                                        </div>
                                        <span className="text-[9px] font-medium text-slate-300 uppercase tracking-widest">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer copyright */}
                        <p className="text-center text-[11px] text-slate-400 mt-5 tracking-wide">
                            Captain Prospect &copy; {new Date().getFullYear()} · Tous droits réservés
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}