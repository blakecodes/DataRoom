export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY ?? "";

// The Picker "appId" is the GCP project number — the numeric prefix of the client id.
export const GOOGLE_APP_ID = GOOGLE_CLIENT_ID.split("-")[0] ?? "";

export const isPickerConfigured = Boolean(GOOGLE_API_KEY && GOOGLE_CLIENT_ID);
