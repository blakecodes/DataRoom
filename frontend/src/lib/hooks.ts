import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { changePassword, updateProfile } from "@/lib/api/auth";
import { deleteFile, getImportJob, importFromDrive, listFiles, uploadFile } from "@/lib/api/files";
import type { ListFilesParams } from "@/lib/api/files";
import { disconnectGoogle } from "@/lib/api/google";
import type { ImportJob } from "@/lib/api/types";

export function useFiles(params: ListFilesParams = {}) {
    return useQuery({
        queryKey: ["files", params.search ?? "", params.page ?? 1, params.pageSize ?? 0],
        queryFn: () => listFiles(params),
        placeholderData: keepPreviousData,
    });
}

export function useUploadFiles() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (files: File[]) => {
            const results = [];
            for (const file of files) {
                results.push(await uploadFile(file));
            }
            return results;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
    });
}

export function useDeleteFile() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteFile(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
    });
}

export function useImportDrive() {
    return useMutation({
        mutationFn: (input: { driveFileIds: string[]; onConflict: "overwrite" | "copy" }) =>
            importFromDrive(input),
    });
}

const ACTIVE_STATUSES = new Set(["pending", "running"]);

export function useImportJob(jobId: string | null) {
    const qc = useQueryClient();
    return useQuery<ImportJob>({
        queryKey: ["import-job", jobId],
        queryFn: () => getImportJob(jobId as string),
        enabled: Boolean(jobId),
        refetchInterval: (query) => {
            const data = query.state.data;
            if (data && !ACTIVE_STATUSES.has(data.status)) {
                // Job finished — refresh the file list once.
                qc.invalidateQueries({ queryKey: ["files"] });
                return false;
            }
            return 1500;
        },
    });
}

export function useDisconnectGoogle() {
    return useMutation({ mutationFn: () => disconnectGoogle() });
}

export function useUpdateProfile() {
    return useMutation({ mutationFn: (displayName: string) => updateProfile({ displayName }) });
}

export function useChangePassword() {
    return useMutation({
        mutationFn: (input: { currentPassword: string; newPassword: string }) => changePassword(input),
    });
}
