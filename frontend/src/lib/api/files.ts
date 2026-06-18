import { request, requestBlob } from "@/lib/api/client";
import type { FileRecord } from "@/types";
import type { ImportJob } from "@/lib/api/types";

export interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface FilesPage {
    files: FileRecord[];
    pagination: Pagination;
    totalSizeBytes: number;
}

export interface ListFilesParams {
    search?: string;
    page?: number;
    pageSize?: number;
}

export async function listFiles(params: ListFilesParams = {}): Promise<FilesPage> {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request<FilesPage>(`/files${query}`);
}

export async function uploadFile(file: File): Promise<FileRecord> {
    const form = new FormData();
    form.append("file", file);
    return request<FileRecord>("/files", { method: "POST", raw: form });
}

export async function deleteFile(id: string): Promise<void> {
    await request(`/files/${id}`, { method: "DELETE" });
}

export async function importFromDrive(input: {
    driveFileIds: string[];
    onConflict: "overwrite" | "copy";
}): Promise<{ jobId: string; status: string; totalCount: number }> {
    return request("/files/import", { method: "POST", body: input });
}

export async function getImportJob(jobId: string): Promise<ImportJob> {
    return request<ImportJob>(`/imports/${jobId}`);
}

export async function fetchFileBlobUrl(id: string): Promise<string> {
    const blob = await requestBlob(`/files/${id}/content`);
    return URL.createObjectURL(blob);
}
