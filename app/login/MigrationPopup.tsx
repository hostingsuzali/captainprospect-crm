"use client";

import { useState, useEffect } from "react";

export default function MigrationPopup() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const dismissed = localStorage.getItem("migration_popup_dismissed");
        if (!dismissed) setVisible(true);
    }, []);

    const handleDismiss = () => {
        localStorage.setItem("migration_popup_dismissed", "true");
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "1rem",
            }}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: 16,
                    border: "0.5px solid rgba(0,0,0,0.1)",
                    width: "100%",
                    maxWidth: 500,
                    overflow: "hidden",
                    fontFamily: "inherit",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "1.5rem 1.75rem 0",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                    }}
                >
                    <div>
                        <h2
                            style={{
                                fontSize: 20,
                                fontWeight: 500,
                                color: "#111",
                                margin: "0 0 4px",
                            }}
                        >
                            Nouvelle adresse
                        </h2>
                        <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
                            CaptainProspect a migré vers sa propre infrastructure
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleDismiss}
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 2,
                            color: "#aaa",
                            marginTop: 2,
                        }}
                        aria-label="Fermer"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Divider */}
                <div style={{ margin: "1.25rem 1.75rem 0", borderTop: "0.5px solid #eee" }} />

                {/* Body */}
                <div style={{ padding: "1.25rem 1.75rem" }}>
                    {/* Brand row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                background: "#1a1a1a",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 500, color: "#111", margin: 0 }}>
                                CaptainProspect CRM
                            </p>
                            <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                                Migration vers infrastructure dédiée
                            </p>
                        </div>
                    </div>

                    {/* URL box */}
                    <div
                        style={{
                            background: "#f5f5f5",
                            borderRadius: 8,
                            padding: "14px 16px",
                            marginBottom: "1rem",
                        }}
                    >
                        <p
                            style={{
                                fontSize: 11,
                                color: "#999",
                                margin: "0 0 4px",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                fontWeight: 500,
                            }}
                        >
                            Nouvelle adresse
                        </p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>
                                app.captainprospect.fr
                            </span>
                            <span
                                style={{
                                    fontSize: 11,
                                    background: "#e8f5e9",
                                    color: "#2e7d32",
                                    padding: "3px 8px",
                                    borderRadius: 20,
                                    fontWeight: 500,
                                }}
                            >
                                Actif
                            </span>
                        </div>
                    </div>

                    {/* Checklist */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.25rem" }}>
                        {[
                            "Base de données migrée",
                            "Tous les services opérationnels",
                            "Connexion sécurisée HTTPS",
                        ].map((item) => (
                            <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#555" }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        borderTop: "0.5px solid #eee",
                        padding: "1rem 1.75rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                    }}
                >
                    <button
                        type="button"
                        onClick={handleDismiss}
                        style={{
                            fontSize: 13,
                            color: "#666",
                            background: "none",
                            border: "0.5px solid #ddd",
                            borderRadius: 8,
                            padding: "8px 16px",
                            cursor: "pointer",
                        }}
                    >
                        Ignorer
                    </button>
                    <a
                        href="https://app.captainprospect.fr"
                        style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#fff",
                            background: "#1a1a1a",
                            border: "none",
                            borderRadius: 8,
                            padding: "8px 20px",
                            cursor: "pointer",
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        Accéder maintenant
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    );
}
