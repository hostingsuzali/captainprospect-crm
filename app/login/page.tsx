import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
            <div className="animate-pulse text-slate-500">Chargement...</div>
        </div>}>
            <LoginForm />
        </Suspense>
    );
}