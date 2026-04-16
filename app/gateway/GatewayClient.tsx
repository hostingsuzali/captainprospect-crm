"use client";

import { useEffect, useRef } from "react";
import type { UserRole } from "@prisma/client";

interface RoleMeta {
    portal:  string;
    tagline: string;
}

const ROLE_META: Record<UserRole, RoleMeta> = {
    SDR: {
        portal:  "Espace SDR",
        tagline: "Votre pipeline de prospection est prêt.",
    },
    BOOKER: {
        portal:  "Espace SDR",
        tagline: "Vos séquences d'appels sont prêtes.",
    },
    MANAGER: {
        portal:  "Tableau de bord Manager",
        tagline: "Vos équipes et analytiques vous attendent.",
    },
    CLIENT: {
        portal:  "Portail Client",
        tagline: "Vos rapports et données sont disponibles.",
    },
    DEVELOPER: {
        portal:  "Console Développeur",
        tagline: "Votre environnement de développement est prêt.",
    },
    BUSINESS_DEVELOPER: {
        portal:  "Espace Business Dev",
        tagline: "Votre portefeuille client est à jour.",
    },
    COMMERCIAL: {
        portal:  "Espace Commercial",
        tagline: "Vos opportunités commerciales vous attendent.",
    },
};

/** Shared status line sequence (post-login handoff). */
const GATEWAY_STATUSES: readonly [string, string, string] = [
    "Initialisation de la connexion sécurisée\u2026",
    "Préparation de votre espace de travail\u2026",
    "Accès accordé. Redirection en cours\u2026",
];

interface Props {
    role:          UserRole;
    firstName:     string;
    destination:   string;
}

const LOADER_DELAY     = 1300; // ms before progress + status sequence (animation beat)
const LOADER_DURATION  = 2400; // ms to fill the bar
const REDIRECT_PAD_MS  = 250;  // ms after fill completes → hard navigation (~3.95s total)
const TICK_COUNT       = 14;

export default function GatewayClient({ role, firstName, destination }: Props) {
    const meta = ROLE_META[role] ?? ROLE_META.SDR;

    const fillRef   = useRef<HTMLDivElement>(null);
    const cometRef  = useRef<HTMLDivElement>(null);
    const pctRef    = useRef<HTMLSpanElement>(null);
    const statusRef = useRef<HTMLSpanElement>(null);
    const trackRef  = useRef<HTMLDivElement>(null);
    const cardRef   = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // ── Build tick marks ────────────────────────────
        const ticksEl = document.getElementById("gw-ticks");
        const ticks: HTMLDivElement[] = [];
        if (ticksEl) {
            for (let i = 0; i < TICK_COUNT; i++) {
                const t = document.createElement("div");
                t.className = "gw-tick";
                ticksEl.appendChild(t);
                ticks.push(t);
            }
        }

        // ── Status text helper ───────────────────────────
        const setStatus = (text: string) => {
            const el = statusRef.current;
            if (!el) return;
            el.style.opacity = "0";
            el.style.transform = "translateY(-7px)";
            setTimeout(() => {
                if (!statusRef.current) return;
                statusRef.current.textContent = text;
                statusRef.current.style.opacity = "1";
                statusRef.current.style.transform = "translateY(0)";
            }, 220);
        };

        // ── Easing ───────────────────────────────────────
        const ease = (x: number) =>
            x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;

        // ── Loader animation ─────────────────────────────
        let startTs: number | null = null;
        let lastLitTick = -1;
        let raf: number | undefined;

        const tick = (now: number) => {
            if (!startTs) startTs = now;
            const raw      = Math.min((now - startTs) / LOADER_DURATION, 1);
            const progress = ease(raw);
            const pct      = Math.round(progress * 100);

            if (fillRef.current)  fillRef.current.style.width = pct + "%";
            if (pctRef.current)   pctRef.current.textContent  = pct + "%";

            if (trackRef.current && cometRef.current) {
                const tw = trackRef.current.offsetWidth;
                cometRef.current.style.left = Math.max(0, (pct / 100) * tw - 40) + "px";
            }

            const litCount = Math.floor(progress * TICK_COUNT);
            if (litCount > lastLitTick) {
                for (let i = lastLitTick + 1; i <= litCount && i < TICK_COUNT; i++) {
                    ticks[i]?.classList.add("gw-tick-lit");
                }
                lastLitTick = litCount;
            }

            if (raw < 1) {
                raf = requestAnimationFrame(tick);
            } else {
                if (fillRef.current)  fillRef.current.style.width = "100%";
                if (pctRef.current)   pctRef.current.textContent  = "100%";
                if (cometRef.current) cometRef.current.style.display = "none";
                ticks.forEach(t => t.classList.add("gw-tick-lit"));
                cardRef.current?.classList.add("gw-done");
            }
        };

        const tLoaderStart = setTimeout(() => { raf = requestAnimationFrame(tick); }, LOADER_DELAY);

        // ── Status messages ──────────────────────────────
        const tS0 = setTimeout(() => setStatus(GATEWAY_STATUSES[0]), LOADER_DELAY);
        const tS1 = setTimeout(() => setStatus(GATEWAY_STATUSES[1]), LOADER_DELAY + 1100);
        const tS2 = setTimeout(() => setStatus(GATEWAY_STATUSES[2]), LOADER_DELAY + 2200);

        // ── Redirect (full navigation, same as no-JS meta-refresh intent) ──
        const tRedirect = setTimeout(() => {
            window.location.replace(destination);
        }, LOADER_DELAY + LOADER_DURATION + REDIRECT_PAD_MS);

        return () => {
            clearTimeout(tLoaderStart);
            clearTimeout(tS0);
            clearTimeout(tS1);
            clearTimeout(tS2);
            clearTimeout(tRedirect);
            if (typeof raf === "number") cancelAnimationFrame(raf);
            if (ticksEl) ticksEl.innerHTML = "";
        };
    }, [destination]);

    const firstNameDisplay = firstName.split(" ")[0] || "vous";

    return (
        <>
            {/* ── Inline styles ─────────────────────────────── */}
            <style>{`
                /* Reset */
                *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

                :root {
                    --gw-bg:       #07071a;
                    --gw-glass:    rgba(255,255,255,0.032);
                    --gw-border:   rgba(255,255,255,0.065);
                    --gw-border-h: rgba(255,255,255,0.11);
                    --gw-indigo:   #6366f1;
                    --gw-violet:   #8b5cf6;
                    --gw-blue:     #3b82f6;
                    --gw-white-hi: rgba(255,255,255,0.92);
                    --gw-white-mid:rgba(255,255,255,0.50);
                    --gw-white-lo: rgba(255,255,255,0.28);
                    --spring:      cubic-bezier(0.34,1.56,0.64,1);
                    --smooth:      cubic-bezier(0.22,1,0.36,1);
                }

                html,body{
                    height:100%;
                    font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
                    background:var(--gw-bg);
                    color:var(--gw-white-hi);
                    overflow:hidden;
                    -webkit-font-smoothing:antialiased;
                }

                /* ── Mesh background ─────────────────────── */
                .gw-mesh{position:fixed;inset:0;z-index:0;pointer-events:none}

                .gw-mesh-a{
                    position:absolute;inset:0;
                    background:
                        radial-gradient(ellipse 70% 55% at 15% 15%,rgba(99,102,241,.22) 0%,transparent 65%),
                        radial-gradient(ellipse 55% 70% at 85% 85%,rgba(59,130,246,.16) 0%,transparent 65%),
                        radial-gradient(ellipse 45% 45% at 55%  5%,rgba(139,92,246,.14) 0%,transparent 55%);
                    animation:gwMeshA 14s ease-in-out infinite alternate;
                }
                .gw-mesh-b{
                    position:absolute;inset:0;
                    background:
                        radial-gradient(ellipse 40% 40% at 90% 30%,rgba(6,182,212,.07) 0%,transparent 55%),
                        radial-gradient(ellipse 35% 50% at 10% 75%,rgba(99,102,241,.10) 0%,transparent 55%);
                    animation:gwMeshB 18s ease-in-out infinite alternate;
                }
                .gw-grid{
                    position:absolute;inset:0;
                    background-image:radial-gradient(circle,rgba(255,255,255,.055) 1px,transparent 1px);
                    background-size:36px 36px;
                    mask-image:radial-gradient(ellipse 90% 90% at 50% 50%,black 30%,transparent 80%);
                    animation:gwGrid 20s linear infinite;
                }

                @keyframes gwMeshA{0%{opacity:.7;transform:scale(1)}100%{opacity:1;transform:scale(1.06)}}
                @keyframes gwMeshB{0%{opacity:.5;transform:scale(1.03)}100%{opacity:.9;transform:scale(1)}}
                @keyframes gwGrid{0%{background-position:0 0}100%{background-position:36px 36px}}

                /* ── Layout ──────────────────────────────── */
                .gw-layout{
                    position:relative;z-index:1;
                    height:100vh;
                    display:grid;
                    grid-template-columns:42% 58%;
                }
                @media(max-width:800px){
                    .gw-layout{grid-template-columns:1fr;grid-template-rows:160px 1fr}
                }

                /* ── Left art panel ──────────────────────── */
                .gw-art{
                    position:relative;
                    overflow:hidden;
                    display:flex;flex-direction:column;
                    justify-content:flex-end;
                    padding:44px 48px;
                    transform:translateX(-100%);
                    animation:gwSlideLeft .9s var(--spring) .05s forwards;
                }
                @keyframes gwSlideLeft{to{transform:translateX(0)}}

                .gw-art::after{
                    content:'';position:absolute;inset:0;
                    border-right:1px solid var(--gw-border);
                    background:linear-gradient(145deg,rgba(99,102,241,.055) 0%,rgba(139,92,246,.03) 50%,transparent 100%);
                }

                /* Orbs */
                .gw-orb{position:absolute;border-radius:50%;pointer-events:none}
                .gw-orb-a{
                    width:360px;height:360px;top:-80px;left:-80px;
                    background:radial-gradient(circle at 35% 35%,rgba(99,102,241,.55) 0%,rgba(99,102,241,.15) 45%,transparent 75%);
                    filter:blur(55px);opacity:0;
                    animation:gwOrbIn 1.8s ease .15s forwards,gwFloat1 9s ease-in-out infinite;
                }
                .gw-orb-b{
                    width:260px;height:260px;bottom:10%;right:-40px;
                    background:radial-gradient(circle at 60% 60%,rgba(59,130,246,.5) 0%,transparent 70%);
                    filter:blur(50px);opacity:0;
                    animation:gwOrbIn 1.8s ease .4s forwards,gwFloat2 11s ease-in-out infinite;
                }
                .gw-orb-c{
                    width:180px;height:180px;top:48%;left:42%;
                    background:radial-gradient(circle,rgba(139,92,246,.45) 0%,transparent 70%);
                    filter:blur(40px);opacity:0;
                    animation:gwOrbIn 1.8s ease .65s forwards,gwFloat3 7.5s ease-in-out infinite;
                }
                @keyframes gwOrbIn{to{opacity:1}}
                @keyframes gwFloat1{0%,100%{transform:translate(0,0)}50%{transform:translate(22px,28px)}}
                @keyframes gwFloat2{0%,100%{transform:translate(0,0)}50%{transform:translate(-18px,-22px)}}
                @keyframes gwFloat3{0%,100%{transform:translate(0,0)}33%{transform:translate(12px,-18px)}66%{transform:translate(-12px,12px)}}

                /* Rings + scan */
                .gw-rings{
                    position:absolute;width:340px;height:340px;
                    top:50%;left:50%;transform:translate(-50%,-50%);
                    opacity:0;animation:gwFadeIn 2s ease .6s forwards;
                }
                .gw-ring{position:absolute;border-radius:50%;border:1px solid}
                .gw-ring-1{inset:  0;border-color:rgba(99,102,241,.18)}
                .gw-ring-2{inset:40px;border-color:rgba(139,92,246,.13)}
                .gw-ring-3{inset:80px;border-color:rgba(59,130,246,.10)}
                .gw-ring-4{inset:120px;border-color:rgba(255,255,255,.05)}
                .gw-scan{
                    position:absolute;width:1px;height:50%;
                    top:0;left:50%;transform-origin:bottom center;
                    background:linear-gradient(to bottom,transparent,rgba(99,102,241,.6));
                    animation:gwScan 4s linear infinite;
                }
                @keyframes gwScan{to{transform:rotate(360deg)}}

                /* Constellation SVG */
                .gw-constell{
                    position:absolute;inset:0;
                    opacity:0;animation:gwFadeIn 2s ease .8s forwards;
                }

                /* Panel copy */
                .gw-panel-copy{
                    position:relative;z-index:2;
                    opacity:0;animation:gwFadeUp .7s var(--smooth) 1.1s forwards;
                }
                .gw-panel-label{
                    font-size:10px;font-weight:600;
                    letter-spacing:.15em;text-transform:uppercase;
                    color:rgba(99,102,241,.65);margin-bottom:10px;
                }
                .gw-panel-tagline{
                    font-size:24px;font-weight:300;
                    letter-spacing:-.025em;color:rgba(255,255,255,.22);
                    line-height:1.45;
                }
                .gw-panel-tagline strong{font-weight:500;color:rgba(255,255,255,.5)}

                @media(max-width:800px){
                    .gw-panel-copy{display:none}
                    .gw-rings{width:160px;height:160px}
                    .gw-orb-b,.gw-orb-c{display:none}
                    .gw-orb-a{width:200px;height:200px}
                }

                /* ── Right content panel ─────────────────── */
                .gw-content{
                    display:flex;align-items:center;justify-content:center;
                    padding:40px;
                }

                /* ── Card ────────────────────────────────── */
                .gw-card{
                    position:relative;
                    width:100%;max-width:468px;
                    background:var(--gw-glass);
                    backdrop-filter:blur(40px) saturate(170%) brightness(1.05);
                    -webkit-backdrop-filter:blur(40px) saturate(170%) brightness(1.05);
                    border:1px solid var(--gw-border);
                    border-radius:28px;
                    padding:52px 48px 48px;
                    box-shadow:
                        0 48px 100px -20px rgba(0,0,0,.55),
                        0  0  0 1px rgba(255,255,255,.035) inset,
                        0  1px 0 rgba(255,255,255,.08) inset;
                    transform:scale(.86) translateY(28px);
                    opacity:0;
                    animation:gwCardIn .9s var(--spring) .25s forwards;
                    transition:border-color .6s ease,box-shadow .6s ease;
                }
                .gw-card.gw-done{
                    border-color:rgba(99,102,241,.35);
                    box-shadow:
                        0 48px 100px -20px rgba(0,0,0,.55),
                        0 0 60px -10px rgba(99,102,241,.28),
                        0 0 0 1px rgba(255,255,255,.035) inset,
                        0 1px 0 rgba(255,255,255,.08) inset;
                }
                @keyframes gwCardIn{to{transform:scale(1) translateY(0);opacity:1}}

                /* Staggered entry — every direct child of the glass card */
                .gw-card > *{
                    opacity:0;
                    transform:translateY(14px) scale(.94);
                    animation:gwStaggerIn .68s var(--spring) forwards;
                }
                .gw-card > *:nth-child(1){animation-delay:.62s}
                .gw-card > *:nth-child(2){animation-delay:.70s}
                .gw-card > *:nth-child(3){animation-delay:.78s}
                .gw-card > *:nth-child(4){animation-delay:.86s}
                .gw-card > *:nth-child(5){animation-delay:.94s}
                .gw-card > *:nth-child(6){animation-delay:1.02s}
                .gw-card > *:nth-child(7){animation-delay:1.10s}
                .gw-card > *:nth-child(8){animation-delay:1.18s}
                @keyframes gwStaggerIn{
                    to{opacity:1;transform:translateY(0) scale(1)}
                }

                /* ── Logo ────────────────────────────────── */
                .gw-logo-wrap{
                    display:flex;justify-content:center;
                    margin-bottom:32px;
                }
                .gw-logo-wrap img{
                    height:54px;width:auto;
                    filter:drop-shadow(0 0 28px rgba(99,102,241,.4)) drop-shadow(0 0 8px rgba(139,92,246,.25));
                }

                /* ── Text ────────────────────────────────── */
                .gw-greeting{
                    text-align:center;
                    font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;
                    color:rgba(99,102,241,.75);margin-bottom:10px;
                }
                .gw-title{
                    text-align:center;
                    font-size:26px;font-weight:600;letter-spacing:-.03em;
                    color:var(--gw-white-hi);line-height:1.2;margin-bottom:10px;
                }
                .gw-subtitle{
                    text-align:center;
                    font-size:13.5px;font-weight:400;color:var(--gw-white-lo);
                    line-height:1.65;margin-bottom:36px;
                }

                /* ── Loader block ────────────────────────── */
                .gw-loader{
                    margin-bottom:28px;
                }

                /* Status row */
                .gw-status-row{
                    display:flex;align-items:center;justify-content:center;gap:8px;
                    margin-bottom:16px;min-height:20px;
                }
                .gw-status-dot{
                    width:6px;height:6px;border-radius:50%;
                    background:var(--gw-indigo);box-shadow:0 0 10px var(--gw-indigo);
                    flex-shrink:0;
                    animation:gwBlink 1.6s ease-in-out infinite;
                }
                .gw-card.gw-done .gw-status-dot{
                    background:#22c55e;box-shadow:0 0 10px #22c55e;animation:none;
                }
                @keyframes gwBlink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.6)}}

                .gw-status-text{
                    font-size:11.5px;font-weight:500;color:var(--gw-white-lo);
                    letter-spacing:.025em;
                    transition:opacity .3s ease,transform .3s ease;
                }

                /* Track */
                .gw-track{
                    position:relative;height:6px;border-radius:100px;
                    background:rgba(255,255,255,.055);overflow:hidden;
                    box-shadow:inset 0 1px 2px rgba(0,0,0,.35);
                }
                .gw-fill{
                    position:absolute;top:0;left:0;bottom:0;width:0%;
                    border-radius:100px;
                    background:linear-gradient(90deg,#6366f1 0%,#8b5cf6 40%,#3b82f6 80%,#06b6d4 100%);
                    background-size:200% 100%;
                    transition:width .18s linear;
                    animation:gwGradShift 3s ease-in-out infinite;
                }
                @keyframes gwGradShift{
                    0%{background-position:0% 50%}
                    50%{background-position:100% 50%}
                    100%{background-position:0% 50%}
                }
                .gw-comet{
                    position:absolute;top:-2px;bottom:-2px;width:40px;
                    border-radius:100px;
                    background:linear-gradient(90deg,transparent,rgba(255,255,255,.85));
                    pointer-events:none;
                }
                .gw-sheen{
                    position:absolute;inset:0;
                    background:linear-gradient(105deg,transparent 25%,rgba(255,255,255,.22) 50%,transparent 75%);
                    background-size:200% 100%;
                    animation:gwSheen 2.2s linear infinite;
                }
                @keyframes gwSheen{0%{background-position:-200% 0}100%{background-position:200% 0}}

                /* Ticks */
                .gw-ticks{display:flex;justify-content:space-between;margin-top:8px;padding:0 1px}
                .gw-tick{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.1);transition:background .4s ease,box-shadow .4s ease}
                .gw-tick-lit{background:rgba(99,102,241,.8);box-shadow:0 0 6px rgba(99,102,241,.7)}

                /* Meta row */
                .gw-track-meta{display:flex;justify-content:space-between;align-items:center;margin-top:13px}
                .gw-pct{
                    font-size:11px;font-weight:700;color:rgba(99,102,241,.8);
                    font-variant-numeric:tabular-nums;letter-spacing:.06em;
                    transition:color .4s ease;
                }
                .gw-card.gw-done .gw-pct{color:rgba(34,197,94,.9)}
                .gw-dest-meta{display:flex;align-items:center;gap:6px}
                .gw-dest-pulse{
                    width:5px;height:5px;border-radius:50%;
                    background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.9);
                    animation:gwDestPulse 2.4s ease-in-out infinite;
                }
                @keyframes gwDestPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.65)}}
                .gw-dest-label{font-size:10.5px;font-weight:500;color:rgba(255,255,255,.2);letter-spacing:.02em}

                /* ── Destination badge ───────────────────── */
                .gw-badge{
                    display:flex;align-items:center;justify-content:center;gap:9px;
                    padding:11px 22px;
                    background:rgba(255,255,255,.025);border:1px solid var(--gw-border);
                    border-radius:100px;
                    transition:border-color .3s ease,background .3s ease;
                }
                .gw-badge:hover{border-color:var(--gw-border-h);background:rgba(255,255,255,.04)}
                .gw-badge-lock{color:rgba(255,255,255,.35);flex-shrink:0}
                .gw-badge-label{font-size:11.5px;font-weight:400;color:rgba(255,255,255,.3);letter-spacing:.02em}
                .gw-badge-url{font-size:11.5px;font-weight:500;color:rgba(255,255,255,.6);font-family:'SF Mono','Fira Code',monospace}
                .gw-badge-arrow{color:rgba(99,102,241,.5);margin-left:2px}

                /* ── Top-right connection badge ──────────── */
                .gw-conn{
                    position:fixed;top:28px;right:32px;z-index:10;
                    display:flex;align-items:center;gap:7px;
                    padding:7px 14px;
                    background:var(--gw-glass);backdrop-filter:blur(20px);
                    border:1px solid var(--gw-border);border-radius:100px;
                    opacity:0;animation:gwFadeDown .6s var(--smooth) 1.4s forwards;
                }
                .gw-conn-dot{
                    width:6px;height:6px;border-radius:50%;
                    background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.8);
                    animation:gwConnPulse 2s ease-in-out infinite;
                }
                @keyframes gwConnPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.82)}}
                .gw-conn-text{font-size:10.5px;font-weight:500;color:rgba(255,255,255,.35);letter-spacing:.04em}

                /* ── Footer ──────────────────────────────── */
                .gw-footer{
                    position:fixed;bottom:28px;left:0;right:0;
                    text-align:center;pointer-events:none;
                    opacity:0;animation:gwFadeUp .6s var(--smooth) 1.6s forwards;
                }
                .gw-footer-text{font-size:10.5px;font-weight:400;color:rgba(255,255,255,.12);letter-spacing:.05em}

                /* ── Shared keyframes ────────────────────── */
                @keyframes gwFadeIn {from{opacity:0}to{opacity:1}}
                @keyframes gwFadeUp {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
                @keyframes gwFadeDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
            `}</style>

            {/* ── Animated mesh background ──────────────── */}
            <div className="gw-mesh" aria-hidden="true">
                <div className="gw-mesh-a" />
                <div className="gw-mesh-b" />
                <div className="gw-grid"   />
            </div>

            {/* ── Connection indicator ───────────────────── */}
            <div className="gw-conn" aria-hidden="true">
                <div className="gw-conn-dot" />
                <span className="gw-conn-text">Connexion SSL active</span>
            </div>

            {/* ── Main layout ───────────────────────────── */}
            <div className="gw-layout">

                {/* LEFT: art panel */}
                <div className="gw-art" aria-hidden="true">
                    <div className="gw-orb gw-orb-a" />
                    <div className="gw-orb gw-orb-b" />
                    <div className="gw-orb gw-orb-c" />

                    {/* Concentric rings + scan beam */}
                    <div className="gw-rings">
                        <div className="gw-ring gw-ring-1" />
                        <div className="gw-ring gw-ring-2" />
                        <div className="gw-ring gw-ring-3" />
                        <div className="gw-ring gw-ring-4" />
                        <div className="gw-scan" />
                    </div>

                    {/* Constellation SVG */}
                    <svg className="gw-constell" viewBox="0 0 400 600" fill="none"
                        xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                        <circle cx="72"  cy="140" r="2.5" fill="rgba(99,102,241,.5)"  />
                        <circle cx="180" cy="80"  r="2"   fill="rgba(139,92,246,.45)" />
                        <circle cx="310" cy="155" r="2"   fill="rgba(59,130,246,.45)" />
                        <circle cx="95"  cy="310" r="2"   fill="rgba(99,102,241,.35)" />
                        <circle cx="260" cy="280" r="2.5" fill="rgba(139,92,246,.4)"  />
                        <circle cx="330" cy="430" r="2"   fill="rgba(59,130,246,.35)" />
                        <circle cx="130" cy="490" r="2"   fill="rgba(99,102,241,.35)" />
                        <circle cx="220" cy="520" r="1.5" fill="rgba(255,255,255,.25)" />
                        <line x1="72"  y1="140" x2="180" y2="80"  stroke="rgba(99,102,241,.18)"  strokeWidth=".75" />
                        <line x1="180" y1="80"  x2="310" y2="155" stroke="rgba(139,92,246,.15)" strokeWidth=".75" />
                        <line x1="72"  y1="140" x2="95"  y2="310" stroke="rgba(99,102,241,.12)"  strokeWidth=".75" />
                        <line x1="310" y1="155" x2="260" y2="280" stroke="rgba(59,130,246,.14)"  strokeWidth=".75" />
                        <line x1="95"  y1="310" x2="260" y2="280" stroke="rgba(139,92,246,.12)" strokeWidth=".75" />
                        <line x1="260" y1="280" x2="330" y2="430" stroke="rgba(59,130,246,.11)"  strokeWidth=".75" />
                        <line x1="95"  y1="310" x2="130" y2="490" stroke="rgba(99,102,241,.10)"  strokeWidth=".75" />
                        <line x1="330" y1="430" x2="220" y2="520" stroke="rgba(255,255,255,.07)" strokeWidth=".75" />
                        <line x1="130" y1="490" x2="220" y2="520" stroke="rgba(255,255,255,.07)" strokeWidth=".75" />
                    </svg>

                    <div className="gw-panel-copy">
                        <p className="gw-panel-label">Captain Prospect · Enterprise</p>
                        <p className="gw-panel-tagline">
                            L&apos;intelligence<br />commerciale<br />
                            <strong>réinventée.</strong>
                        </p>
                    </div>
                </div>

                {/* RIGHT: gateway card */}
                <div className="gw-content">
                    <div className="gw-card" ref={cardRef}>

                        {/* Logo */}
                        <div className="gw-logo-wrap">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logocaptainblue-rose.png" alt="Captain Prospect" draggable={false} />
                        </div>

                        {/* Heading */}
                        <p className="gw-greeting">
                            {meta.portal}
                        </p>
                        <h1 className="gw-title">
                            Bienvenue, {firstNameDisplay}&nbsp;👋
                        </h1>
                        <p className="gw-subtitle">
                            {meta.tagline}<br />
                            Votre espace est en cours de chargement.
                        </p>

                        {/* Spectral Beam Loader */}
                        <div className="gw-loader">
                            <div className="gw-status-row">
                                <div className="gw-status-dot" />
                                <span className="gw-status-text" ref={statusRef}>
                                    {GATEWAY_STATUSES[0]}
                                </span>
                            </div>

                            {/* Track */}
                            <div className="gw-track" ref={trackRef} id="gw-track">
                                <div className="gw-fill" ref={fillRef}>
                                    <div className="gw-sheen" />
                                </div>
                                <div className="gw-comet" ref={cometRef} />
                            </div>

                            {/* Ticks */}
                            <div className="gw-ticks" id="gw-ticks" />

                            {/* Meta */}
                            <div className="gw-track-meta">
                                <span className="gw-pct" ref={pctRef}>0%</span>
                                <div className="gw-dest-meta">
                                    <div className="gw-dest-pulse" />
                                    <span className="gw-dest-label">app.captainprospect.fr</span>
                                </div>
                            </div>
                        </div>

                        {/* Destination badge */}
                        <div className="gw-badge">
                            <svg className="gw-badge-lock" width="13" height="14" viewBox="0 0 13 14" fill="none">
                                <rect x="1" y="6" width="11" height="7.5" rx="2" fill="currentColor" opacity=".55" />
                                <path d="M3.5 6V4.5a3 3 0 016 0V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                            </svg>
                            <span className="gw-badge-label">Redirection sécurisée vers</span>
                            <span className="gw-badge-url">app.captainprospect.fr</span>
                            <span className="gw-badge-arrow">›</span>
                        </div>

                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="gw-footer">
                <p className="gw-footer-text">
                    © 2026 Captain Prospect &nbsp;·&nbsp; TLS 1.3 &nbsp;·&nbsp; Hébergé en France
                </p>
            </footer>
        </>
    );
}
