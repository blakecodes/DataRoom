import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMe, login as apiLogin, logout as apiLogout, signup as apiSignup } from "@/lib/api/auth";
import { setAccessToken, setAuthFailureHandler } from "@/lib/api/client";
import type { ApiUser, DriveStatusValue } from "@/lib/api/types";

interface AuthContextValue {
    user: ApiUser | null;
    driveStatus: DriveStatusValue;
    driveAccountEmail: string | null;
    initializing: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, displayName?: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<ApiUser | null>(null);
    const [driveStatus, setDriveStatus] = useState<DriveStatusValue>("disconnected");
    const [driveAccountEmail, setDriveAccountEmail] = useState<string | null>(null);
    const [initializing, setInitializing] = useState(true);

    const refreshMe = useCallback(async () => {
        const me = await getMe();
        setUser(me.user);
        setDriveStatus(me.driveStatus);
        setDriveAccountEmail(me.driveAccountEmail);
    }, []);

    const clearSession = useCallback(() => {
        setAccessToken(null);
        setUser(null);
        setDriveStatus("disconnected");
        setDriveAccountEmail(null);
    }, []);

    // On mount: try to restore a session via the refresh cookie, then load profile.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api"}/auth/refresh`, {
                    method: "POST",
                    credentials: "include",
                });
                if (res.ok) {
                    const data = await res.json();
                    setAccessToken(data.accessToken);
                    if (!cancelled) await refreshMe();
                }
            } catch {
                // no valid session; stay logged out
            } finally {
                if (!cancelled) setInitializing(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [refreshMe]);

    // When any API call fails auth irrecoverably, drop the session.
    useEffect(() => {
        setAuthFailureHandler(() => clearSession());
        return () => setAuthFailureHandler(null);
    }, [clearSession]);

    const login = useCallback(
        async (email: string, password: string) => {
            const res = await apiLogin({ email, password });
            setUser(res.user);
            await refreshMe();
        },
        [refreshMe],
    );

    const signup = useCallback(
        async (email: string, password: string, displayName?: string) => {
            const res = await apiSignup({ email, password, displayName });
            setUser(res.user);
            await refreshMe();
        },
        [refreshMe],
    );

    const logout = useCallback(async () => {
        await apiLogout().catch(() => undefined);
        clearSession();
    }, [clearSession]);

    const value = useMemo(
        () => ({ user, driveStatus, driveAccountEmail, initializing, login, signup, logout, refreshMe }),
        [user, driveStatus, driveAccountEmail, initializing, login, signup, logout, refreshMe],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}

export function initials(nameOrEmail: string): string {
    const base = nameOrEmail.trim();
    if (!base) return "?";
    const parts = base.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return base.slice(0, 2).toUpperCase();
}
