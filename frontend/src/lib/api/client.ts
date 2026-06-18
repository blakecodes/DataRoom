import { API_BASE } from "@/config";

export class ApiError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status: number) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

// Access token lives in memory only (cleared on full reload; restored via refresh cookie).
let accessToken: string | null = null;
let onAuthFailure: (() => void) | null = null;

export function setAccessToken(token: string | null) {
    accessToken = token;
}

export function getAccessToken() {
    return accessToken;
}

export function setAuthFailureHandler(handler: (() => void) | null) {
    onAuthFailure = handler;
}

async function parseError(res: Response): Promise<ApiError> {
    let code = "error";
    let message = res.statusText || "Request failed";
    try {
        const body = await res.json();
        if (body?.error) {
            code = body.error.code ?? code;
            message = body.error.message ?? message;
        }
    } catch {
        // non-JSON error body; keep defaults
    }
    return new ApiError(code, message, res.status);
}

// Single-flight refresh so concurrent 401s don't trigger multiple refreshes.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
    if (!refreshPromise) {
        refreshPromise = (async () => {
            try {
                const res = await fetch(`${API_BASE}/auth/refresh`, {
                    method: "POST",
                    credentials: "include",
                });
                if (!res.ok) return false;
                const data = await res.json();
                accessToken = data.accessToken;
                return true;
            } catch {
                return false;
            } finally {
                refreshPromise = null;
            }
        })();
    }
    return refreshPromise;
}

interface RequestOptions {
    method?: string;
    body?: unknown;
    /** FormData / Blob — sent as-is without JSON serialization. */
    raw?: BodyInit;
    /** Skip the automatic refresh-and-retry (used by auth calls themselves). */
    skipAuthRetry?: boolean;
    headers?: Record<string, string>;
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = { ...(options.headers ?? {}) };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let body: BodyInit | undefined;
    if (options.raw !== undefined) {
        body = options.raw;
    } else if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.body);
    }

    return fetch(`${API_BASE}${path}`, {
        method: options.method ?? "GET",
        credentials: "include",
        headers,
        body,
    });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let res = await rawRequest(path, options);

    if (res.status === 401 && !options.skipAuthRetry) {
        const refreshed = await tryRefresh();
        if (refreshed) {
            res = await rawRequest(path, options);
        } else {
            onAuthFailure?.();
        }
    }

    if (!res.ok) {
        const err = await parseError(res);
        if (err.status === 401) onAuthFailure?.();
        throw err;
    }

    if (res.status === 204) return undefined as T;
    const contentType = res.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
        return (await res.json()) as T;
    }
    return (await res.blob()) as unknown as T;
}

/** Fetch raw bytes (with auth) as a Blob — used for preview/download. */
export async function requestBlob(path: string): Promise<Blob> {
    let res = await rawRequest(path, {});
    if (res.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) res = await rawRequest(path, {});
        else onAuthFailure?.();
    }
    if (!res.ok) throw await parseError(res);
    return res.blob();
}
