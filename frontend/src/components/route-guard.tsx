import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/auth-context";

function FullPageSpinner() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-secondary">
            <div className="size-8 animate-spin rounded-full border-[3px] border-secondary border-t-brand-solid" />
        </div>
    );
}

export function RequireAuth({ children }: { children: ReactNode }) {
    const { user, initializing } = useAuth();
    if (initializing) return <FullPageSpinner />;
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
    const { user, initializing } = useAuth();
    if (initializing) return <FullPageSpinner />;
    if (user) return <Navigate to="/app" replace />;
    return <>{children}</>;
}
