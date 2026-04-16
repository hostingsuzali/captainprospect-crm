"use client";

import { useEffect } from "react";
import type { UserRole } from "@prisma/client";

interface Props {
    role:        UserRole;
    firstName:   string;
    destination: string;
}

/** Same timing as before: ~4s then hard navigation. */
const LOADER_DELAY     = 1300;
const LOADER_DURATION  = 2400;
const REDIRECT_PAD_MS  = 250;

export default function GatewayClient({ role: _role, firstName, destination }: Props) {
    useEffect(() => {
        const t = setTimeout(() => {
            window.location.replace(destination);
        }, LOADER_DELAY + LOADER_DURATION + REDIRECT_PAD_MS);
        return () => clearTimeout(t);
    }, [destination]);

    const shortName = firstName.split(" ")[0] || "vous";

    return (
        <>
            <style>{`
                .gw-root, .gw-root * { box-sizing: border-box; }
                .gw-root {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    margin: 0;
                    background: #ffffff;
                    color: #1e1b4b;
                    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
                    -webkit-font-smoothing: antialiased;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                }
                .gw-inner {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                    max-width: 320px;
                    text-align: center;
                }
                .gw-logo {
                    height: 40px;
                    width: auto;
                    object-fit: contain;
                }
                .gw-title {
                    font-size: 15px;
                    font-weight: 600;
                    letter-spacing: -0.02em;
                    color: #1e1b4b;
                }
                .gw-sub {
                    font-size: 13px;
                    font-weight: 400;
                    color: rgba(30, 27, 75, 0.55);
                    line-height: 1.5;
                }
                .gw-bar {
                    width: 100%;
                    max-width: 200px;
                    height: 3px;
                    border-radius: 999px;
                    background: rgba(30, 27, 75, 0.08);
                    overflow: hidden;
                }
                .gw-bar-fill {
                    height: 100%;
                    width: 0%;
                    border-radius: inherit;
                    background: linear-gradient(90deg, #6366f1, #8b5cf6);
                    animation: gwFill ${LOADER_DURATION}ms linear forwards;
                    animation-delay: ${LOADER_DELAY}ms;
                }
                @keyframes gwFill {
                    from { width: 0%; }
                    to { width: 100%; }
                }
            `}</style>

            <div className="gw-root" role="status" aria-live="polite" aria-busy="true">
                <div className="gw-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        className="gw-logo"
                        src="/logocaptainblue-rose.png"
                        alt=""
                        draggable={false}
                    />
                    <p className="gw-title">Bienvenue, {shortName}</p>
                    <p className="gw-sub">Redirection vers votre espace…</p>
                    <div className="gw-bar" aria-hidden="true">
                        <div className="gw-bar-fill" />
                    </div>
                </div>
            </div>
        </>
    );
}
