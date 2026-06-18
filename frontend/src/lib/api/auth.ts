import { request, setAccessToken } from "@/lib/api/client";
import type { AuthResponse, MeResponse } from "@/lib/api/types";

export async function signup(input: {
    email: string;
    password: string;
    displayName?: string;
}): Promise<AuthResponse> {
    const res = await request<AuthResponse>("/auth/signup", {
        method: "POST",
        body: input,
        skipAuthRetry: true,
    });
    setAccessToken(res.accessToken);
    return res;
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
    const res = await request<AuthResponse>("/auth/login", {
        method: "POST",
        body: input,
        skipAuthRetry: true,
    });
    setAccessToken(res.accessToken);
    return res;
}

export async function logout(): Promise<void> {
    try {
        await request("/auth/logout", { method: "POST", skipAuthRetry: true });
    } finally {
        setAccessToken(null);
    }
}

export async function getMe(): Promise<MeResponse> {
    return request<MeResponse>("/auth/me");
}

export async function updateProfile(input: { displayName: string }): Promise<MeResponse> {
    return request<MeResponse>("/auth/me", { method: "PATCH", body: input });
}

export async function changePassword(input: {
    currentPassword: string;
    newPassword: string;
}): Promise<void> {
    await request("/auth/change-password", { method: "POST", body: input });
}
