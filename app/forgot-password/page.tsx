"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowLeft, ArrowRight, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        if (!email.trim()) {
            setError("Veuillez entrer votre adresse email");
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim() }),
            });

            if (!res.ok) {
                throw new Error("Erreur serveur");
            }

            setSuccess(true);
        } catch {
            setError("Une erreur est survenue. Veuillez réessayer.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <style>{`
                .lp {
                    --cp950: #1e1b4b; --cp700: #4338ca; --cp600: #4f46e5;
                    --cp500: #6366f1; --cp400: #818cf8; --cp200: #c7d2fe;
                    --ink: #1e1b4b; --ink2: rgba(30,27,75,.52); --ink3: rgba(30,27,75,.32);
                    --ink4: rgba(30,27,75,.18); --ink5: rgba(30,27,75,.08);
                    --t: 0.18s cubic-bezier(.4,0,.2,1);
                    --spring: 0.5s cubic-bezier(.22,1,.36,1);

                    font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
                    -webkit-font-smoothing: antialiased;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 24px 16px;
                    position: relative;
                    overflow: hidden;

                    background:
                        radial-gradient(55.87% 55.87% at 35.49% -18.37%, #d1aad7 0%, rgba(255,255,255,0) 100%),
                        radial-gradient(70.81% 48.44% at -24.53% -16.02%, #c88bc4 0%, rgba(255,255,255,0) 100%),
                        radial-gradient(91.61% 92.58% at 104.86% -43.36%, #7b8fdd 0%, rgba(255,255,255,0) 100%),
                        radial-gradient(50.59% 55.55% at -2.99% -8.69%, #86bff2 9.06%, rgba(255,255,255,0) 100%),
                        #f7fafc;
                }

                .lp-card {
                    position: relative; z-index: 1;
                    width: 100%; max-width: 360px;
                    padding: 32px 28px 28px;
                    border-radius: 22px;
                    background: rgba(255,255,255,.82);
                    backdrop-filter: blur(20px) saturate(150%);
                    -webkit-backdrop-filter: blur(20px) saturate(150%);
                    border: 1px solid rgba(255,255,255,.9);
                    box-shadow:
                        rgba(50, 50, 93, 0.25) 0px 50px 100px -20px,
                        rgba(0, 0, 0, 0.3) 0px 30px 60px -30px,
                        inset 0 1px 0 rgba(255,255,255,.95);
                    opacity: 0;
                    transform: translateY(16px) scale(.98);
                    transition: opacity .45s var(--spring, ease), transform .45s var(--spring, ease);
                }
                .lp-card.show {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }

                .lp-inner {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0;
                }

                .lp-card.show .lp-inner > * {
                    animation: lpUp .45s var(--spring, ease) both;
                }
                .lp-card.show .lp-inner > *:nth-child(1) { animation-delay:.04s }
                .lp-card.show .lp-inner > *:nth-child(2) { animation-delay:.09s }
                .lp-card.show .lp-inner > *:nth-child(3) { animation-delay:.14s }
                .lp-card.show .lp-inner > *:nth-child(4) { animation-delay:.19s }
                .lp-card.show .lp-inner > *:nth-child(5) { animation-delay:.24s }
                .lp-card.show .lp-inner > *:nth-child(6) { animation-delay:.29s }

                .lp-logo {
                    margin-bottom: 20px;
                    height: 36px;
                    width: auto;
                    object-fit: contain;
                }

                .lp-head { text-align: center; margin-bottom: 24px; width: 100%; }
                .lp-head h1 {
                    font-weight: 700; font-size: 20px; line-height: 1.25;
                    letter-spacing: -.3px; color: var(--ink); margin: 0;
                }
                .lp-head p {
                    margin: 4px 0 0; font-size: 13px; font-weight: 400;
                    color: var(--ink3);
                }

                .lp-field { width: 100%; margin-bottom: 18px; }
                .lp-label {
                    display: block; font-size: 11px; font-weight: 600;
                    letter-spacing: .05em; text-transform: uppercase;
                    color: var(--ink2); margin-bottom: 6px;
                }

                .lp-wrap {
                    display: flex; align-items: center;
                    height: 46px; border-radius: 12px;
                    border: 1.5px solid var(--ink5);
                    background: rgba(255,255,255,.55);
                    transition: border-color var(--t), box-shadow var(--t), background var(--t);
                }
                .lp-wrap:hover { border-color: var(--ink4); }
                .lp-wrap.f {
                    border-color: var(--cp500);
                    box-shadow: 0 0 0 3px rgba(99,102,241,.10);
                    background: rgba(255,255,255,.8);
                }
                .lp-wrap.err {
                    border-color: #f87171;
                    box-shadow: 0 0 0 3px rgba(248,113,113,.08);
                }

                .lp-ico {
                    display: flex; align-items: center; justify-content: center;
                    width: 42px; height: 100%; flex-shrink: 0;
                    color: var(--ink3); transition: color var(--t);
                }
                .lp-wrap.f .lp-ico { color: var(--cp500); }

                .lp-in {
                    flex: 1; height: 100%; padding: 0 12px 0 0;
                    font-family: inherit; font-size: 13.5px; font-weight: 400;
                    color: var(--ink); background: transparent; border: none; outline: none;
                }
                .lp-in::placeholder { color: var(--ink4); }

                .lp-err {
                    width: 100%; display: flex; align-items: center; gap: 8px;
                    padding: 10px 12px; border-radius: 10px; margin-bottom: 14px;
                    background: #fef2f2; border: 1px solid #fecaca;
                    color: #dc2626; font-size: 12.5px; font-weight: 500;
                    animation: lpShake .4s ease;
                }

                .lp-success {
                    width: 100%; display: flex; align-items: flex-start; gap: 10px;
                    padding: 14px 16px; border-radius: 12px; margin-bottom: 14px;
                    background: #f0fdf4; border: 1px solid #bbf7d0;
                    color: #15803d; font-size: 13px; font-weight: 500;
                    line-height: 1.5;
                }

                .lp-btn {
                    width: 100%; height: 46px; border-radius: 12px; border: none;
                    background: linear-gradient(160deg, var(--cp500) 0%, var(--cp950) 100%);
                    box-shadow: 0 2px 12px rgba(99,102,241,.25);
                    color: #fff; font-family: inherit; font-weight: 600;
                    font-size: 14px; letter-spacing: .01em;
                    cursor: pointer; display: flex; align-items: center;
                    justify-content: center; gap: 7px;
                    transition: filter var(--t), transform var(--t), box-shadow var(--t);
                    margin-bottom: 16px;
                }
                .lp-btn:hover:not(:disabled) {
                    filter: brightness(1.08); transform: translateY(-1px);
                    box-shadow: 0 4px 20px rgba(99,102,241,.30);
                }
                .lp-btn:active:not(:disabled) { filter: brightness(.96); transform: translateY(0); }
                .lp-btn:disabled { opacity: .55; cursor: not-allowed; }

                .lp-back {
                    display: flex; align-items: center; gap: 6px;
                    font-family: inherit; font-size: 13px; font-weight: 500;
                    color: var(--cp500); background: none; border: none;
                    cursor: pointer; padding: 0; transition: color var(--t);
                }
                .lp-back:hover { color: var(--cp700); }

                .lp-footer {
                    position: relative; z-index: 1;
                    font-size: 11px; color: var(--ink4); text-align: center;
                    margin-top: 20px; font-family: inherit;
                }

                @keyframes lpUp {
                    from { opacity: 0; transform: translateY(14px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes lpShake {
                    0%,100% { transform: translateX(0); }
                    20% { transform: translateX(-5px); }
                    40% { transform: translateX(5px); }
                    60% { transform: translateX(-3px); }
                    80% { transform: translateX(3px); }
                }

                @media (max-width: 400px) {
                    .lp-card { padding: 24px 20px 22px; max-width: 100%; }
                    .lp-head h1 { font-size: 18px; }
                }
            `}</style>

            <div className="lp">
                <div className={`lp-card${mounted ? " show" : ""}`}>
                    <div className="lp-inner">

                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/logocaptainblue-rose.png"
                            alt="Captain Prospect"
                            className="lp-logo"
                            draggable={false}
                        />

                        <div className="lp-head">
                            <h1>Mot de passe oublié</h1>
                            <p>Entrez votre email pour recevoir un lien de réinitialisation</p>
                        </div>

                        {success ? (
                            <>
                                <div className="lp-success">
                                    <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                                    <span>
                                        Si un compte existe avec cette adresse, vous recevrez un email avec un lien de réinitialisation. Vérifiez aussi vos spams.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="lp-back"
                                    onClick={() => router.push("/login")}
                                >
                                    <ArrowLeft size={14} />
                                    Retour à la connexion
                                </button>
                            </>
                        ) : (
                            <form onSubmit={handleSubmit} style={{ width: "100%" }} noValidate>
                                <div className="lp-field">
                                    <label className="lp-label" htmlFor="fp-email">Email</label>
                                    <div className={`lp-wrap${emailFocused ? " f" : ""}${error ? " err" : ""}`}>
                                        <div className="lp-ico"><Mail size={15} /></div>
                                        <input
                                            id="fp-email"
                                            className="lp-in"
                                            type="email"
                                            placeholder="votre@email.com"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            onFocus={() => setEmailFocused(true)}
                                            onBlur={() => setEmailFocused(false)}
                                            required
                                            autoComplete="email"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="lp-err">
                                        <AlertCircle size={14} style={{ flexShrink: 0 }} />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <button type="submit" className="lp-btn" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 size={15} className="animate-spin" />
                                            <span>Envoi en cours...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Envoyer le lien</span>
                                            <ArrowRight size={15} />
                                        </>
                                    )}
                                </button>

                                <div style={{ display: "flex", justifyContent: "center" }}>
                                    <button
                                        type="button"
                                        className="lp-back"
                                        onClick={() => router.push("/login")}
                                    >
                                        <ArrowLeft size={14} />
                                        Retour à la connexion
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                <p className="lp-footer">
                    Captain Prospect &copy; {new Date().getFullYear()}
                </p>
            </div>
        </>
    );
}
