export interface ApiUser {
    id: string;
    email: string;
    displayName: string | null;
    createdAt: string | null;
}

export interface AuthResponse {
    accessToken: string;
    user: ApiUser;
}

export type DriveStatusValue = "connected" | "disconnected" | "expired";

export interface MeResponse {
    user: ApiUser;
    driveStatus: DriveStatusValue;
    driveAccountEmail: string | null;
}

export interface ImportJobItem {
    sourceFileId: string;
    status: "pending" | "running" | "done" | "failed" | "skipped";
    action: string | null;
    name: string | null;
    error: string | null;
    file?: { id: string; name: string };
}

export interface ImportJob {
    jobId: string;
    status: "pending" | "running" | "done" | "failed" | "partial";
    totalCount: number;
    completedCount: number;
    failedCount: number;
    items: ImportJobItem[];
}

export interface PickerToken {
    accessToken: string;
    clientId: string;
}
