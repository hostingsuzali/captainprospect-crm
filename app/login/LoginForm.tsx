"use client";

import MigrationPopup from "./MigrationPopup";

const NEW_APP_URL = "https://app.captainprospect.fr";

export default function LoginForm() {
    return (
        <main
            className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-[#F8F9FC] via-[#F4F6F9] to-[#ECEEF4]"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
            <MigrationPopup />

            <div className="max-w-md text-center space-y-4">
                <p className="text-sm text-[#4B4D7A] leading-relaxed">
                    La connexion sur cette adresse est désactivée. Utilisez la nouvelle application sur{" "}
                    <a
                        href={NEW_APP_URL}
                        className="font-semibold text-[#7C5CFC] hover:underline"
                    >
                        app.captainprospect.fr
                    </a>
                    .
                </p>
                <a
                    href={NEW_APP_URL}
                    className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#7C5CFC] to-[#4338CA] hover:brightness-105 transition"
                >
                    Accéder à app.captainprospect.fr
                </a>
            </div>
        </main>
    );
}
