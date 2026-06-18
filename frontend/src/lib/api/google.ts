import { request } from "@/lib/api/client";
import type { PickerToken } from "@/lib/api/types";

export async function getGoogleConsentUrl(): Promise<string> {
    const res = await request<{ consentUrl: string }>("/auth/google/login");
    return res.consentUrl;
}

export async function getPickerToken(): Promise<PickerToken> {
    return request<PickerToken>("/auth/google/picker-token", { method: "POST" });
}

export async function disconnectGoogle(): Promise<void> {
    await request("/auth/google/disconnect", { method: "POST" });
}
