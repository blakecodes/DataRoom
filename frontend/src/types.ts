export type FileSource = "drive" | "upload";
export type DriveStatus = "connected" | "disconnected" | "expired";
export type FileKind = "pdf" | "xlsx" | "pptx" | "docx" | "png" | "zip" | "generic";
export type DemoState = "default" | "empty" | "loading" | "disconnected" | "expired";
export type ConflictResolution = "overwrite" | "copy";

export interface FileRecord {
    id: string;
    name: string;
    kind: FileKind;
    typeLabel: string;
    source: FileSource;
    sizeLabel: string;
    sizeBytes?: number;
    dateAdded: string;
    description: string;
    status?: string;
    folderId?: string | null;
    mimeType?: string | null;
    previewUri?: string;
    previewable?: boolean;
    sourceOwner?: string;
    sourceModifiedAt?: string;
    sourceWebLink?: string;
}

export interface DriveCandidate {
    id: string;
    name: string;
    kind: FileKind;
    sizeLabel: string;
    modifiedAt: string;
    alreadyImported?: boolean;
    changedSinceImport?: boolean;
}

export interface UploadItem {
    id: string;
    name: string;
    kind: FileKind;
    progress?: number;
    status: "uploading" | "uploaded" | "failed";
    detail: string;
}

export interface ImportItem {
    id: string;
    name: string;
    kind: FileKind;
    status: "done" | "importing" | "failed";
    detail?: string;
}
