import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, List, Search, Shield } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppActions, AppShell } from "@/components/layout/app-shell";
import { FileTable } from "@/components/dataroom/file-table";
import { ConflictDialog, DeleteDialog, ImportProgressCard, PreviewDrawer, UploadModal } from "@/components/dataroom/modals";
import { Badge } from "@/components/ui/badge";
import { Button, GoogleMark } from "@/components/ui/button";
import { inputClassName } from "@/components/ui/input";
import { useAuth, initials as toInitials } from "@/lib/auth/auth-context";
import { useDeleteFile, useFiles, useImportDrive, useImportJob } from "@/lib/hooks";
import type { Pagination } from "@/lib/api/files";
import { getGoogleConsentUrl } from "@/lib/api/google";
import { openGooglePicker } from "@/lib/google-picker";
import { isPickerConfigured } from "@/config";
import type { ConflictResolution, FileRecord } from "@/types";

const PAGE_SIZE = 12;

function humanSizeBytes(bytes: number): string {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export function DataRoomPage() {
    const { user, driveStatus } = useAuth();
    const qc = useQueryClient();

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);

    // Debounce the search box so we hit the server at most once per pause.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    // A new query always starts from the first page.
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    const { data, isLoading, isFetching } = useFiles({ search: debouncedSearch, page, pageSize: PAGE_SIZE });
    const files = data?.files ?? [];
    const pagination = data?.pagination;
    const totalFiles = pagination?.total ?? 0;
    const totalSizeBytes = data?.totalSizeBytes ?? 0;

    // If the current page falls past the end (e.g. after deletes), step back.
    useEffect(() => {
        if (pagination && pagination.totalPages > 0 && page > pagination.totalPages) {
            setPage(pagination.totalPages);
        }
    }, [pagination, page]);

    const deleteMutation = useDeleteFile();
    const importMutation = useImportDrive();

    const [view, setView] = useState<"list" | "grid">("list");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<FileRecord | null>(null);
    const [isUploadOpen, setUploadOpen] = useState(false);
    const [showConflict, setShowConflict] = useState(false);
    const [pickedIds, setPickedIds] = useState<string[]>([]);
    const [jobId, setJobId] = useState<string | null>(null);
    const [banner, setBanner] = useState<string | null>(null);

    const { data: importJob } = useImportJob(jobId);

    const userName = user?.displayName || user?.email || "Account";
    const userEmail = user?.email ?? "";

    const connectDrive = async () => {
        try {
            const url = await getGoogleConsentUrl();
            window.location.href = url;
        } catch {
            setBanner("Could not start Google connection. Try again.");
        }
    };

    const startImport = async () => {
        setBanner(null);
        if (!isPickerConfigured) {
            setBanner("Google Picker isn't configured. Set VITE_GOOGLE_API_KEY in the frontend env to enable Drive import.");
            return;
        }
        try {
            const picked = await openGooglePicker();
            if (picked.length === 0) return;
            setPickedIds(picked.map((file) => file.id));
            setShowConflict(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : "";
            setBanner(message || "Could not open the Google Picker. Check your API key and Drive connection.");
        }
    };

    const runImport = (resolution: ConflictResolution) => {
        setShowConflict(false);
        importMutation.mutate(
            { driveFileIds: pickedIds, onConflict: resolution },
            {
                onSuccess: (res) => setJobId(res.jobId),
                onError: () => setBanner("Import failed to start. Reconnect Drive and try again."),
            },
        );
    };

    const confirmDelete = (file: FileRecord) => {
        deleteMutation.mutate(file.id, {
            onSuccess: () => {
                setDeleteTarget(null);
                setPreviewFile((current) => (current?.id === file.id ? null : current));
                setSelectedIds((current) => current.filter((id) => id !== file.id));
            },
        });
    };

    const onUploaded = () => qc.invalidateQueries({ queryKey: ["files"] });

    return (
        <main className="min-h-screen bg-secondary px-4 py-8 md:px-8">
            <AppShell
                activeTab="data-room"
                driveStatus={driveStatus}
                userName={userName}
                userInitials={toInitials(userName)}
                userEmail={userEmail}
                rightActions={<AppActions showImport={driveStatus !== "disconnected"} onUpload={() => setUploadOpen(true)} onImport={startImport} />}
            >
                {banner ? (
                    <div className="border-b border-secondary bg-utility-red-50 px-6 py-3 text-[13px] font-medium text-utility-red-700">{banner}</div>
                ) : null}

                {driveStatus === "expired" ? (
                    <div className="border-b border-secondary bg-utility-red-50 px-6 py-4">
                        <div className="rounded-xl border border-utility-yellow-200 bg-utility-yellow-50 px-4 py-3">
                            <div className="text-sm font-semibold text-utility-yellow-700">Google Drive connection expired</div>
                            <div className="mt-1 text-[13px] leading-5 text-utility-yellow-700">
                                Reconnect to import new files. Documents already in your Data Room are unaffected and remain available.
                            </div>
                            <Button variant="google" className="mt-3 border-utility-yellow-200 bg-utility-yellow-50 text-utility-yellow-700 hover:border-utility-yellow-300 hover:bg-utility-yellow-100" iconLeading={<GoogleMark />} onClick={connectDrive}>
                                Reconnect Google Drive
                            </Button>
                        </div>
                    </div>
                ) : null}

                {driveStatus === "disconnected" ? (
                    <DisconnectedState onUpload={() => setUploadOpen(true)} onConnect={connectDrive} />
                ) : (
                    <>
                        <section className="flex flex-col justify-between gap-5 px-6 py-6 lg:flex-row lg:items-end">
                            <div>
                                <h1 className="text-[28px] font-semibold tracking-[-0.01em] text-primary">Data Room</h1>
                                <div className="mt-1.5 flex items-center gap-2 text-sm text-tertiary">
                                    <Shield size={14} className="text-quaternary" />
                                    {totalFiles} {totalFiles === 1 ? "file" : "files"} - {humanSizeBytes(totalSizeBytes)} - encrypted at rest
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-quaternary" />
                                    <input
                                        id="file-search"
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search files"
                                        aria-label="Search files"
                                        className={`${inputClassName} w-full pl-9 md:w-64`}
                                    />
                                </div>
                                <div className="flex overflow-hidden rounded-lg border border-primary shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setView("list")}
                                        className={`flex cursor-pointer items-center justify-center px-3 py-2.5 transition hover:bg-secondary ${view === "list" ? "bg-secondary text-secondary" : "bg-primary text-quaternary hover:text-tertiary"}`}
                                    >
                                        <List size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setView("grid")}
                                        className={`cursor-pointer border-l border-primary px-3 py-2.5 transition hover:bg-secondary ${view === "grid" ? "bg-secondary text-secondary" : "bg-primary text-quaternary hover:text-tertiary"}`}
                                    >
                                        <LayoutGrid size={18} />
                                    </button>
                                </div>
                            </div>
                        </section>

                        {isLoading ? (
                            <LoadingState />
                        ) : totalFiles === 0 ? (
                            debouncedSearch ? (
                                <NoResults search={debouncedSearch} onClear={() => setSearch("")} />
                            ) : (
                                <EmptyState onImport={startImport} onUpload={() => setUploadOpen(true)} showImport={driveStatus === "connected"} />
                            )
                        ) : (
                            <>
                                <FileTable
                                    files={files}
                                    selectedIds={selectedIds}
                                    view={view}
                                    onToggleSelect={(id) =>
                                        setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
                                    }
                                    onPreview={setPreviewFile}
                                    onDelete={setDeleteTarget}
                                />
                                {pagination && pagination.totalPages > 1 ? (
                                    <PaginationBar pagination={pagination} isFetching={isFetching} onPage={setPage} />
                                ) : null}
                                {selectedIds.length > 0 ? (
                                    <div className="mx-6 mb-6 mt-4 flex items-center gap-3 rounded-[10px] bg-primary-solid px-4 py-3 text-white shadow-lg">
                                        <div className="text-sm font-medium">{selectedIds.length} selected</div>
                                        <div className="flex-1" />
                                        <Button
                                            variant="secondary"
                                            className="border-tertiary bg-transparent text-utility-red-300 hover:border-quaternary hover:bg-secondary"
                                            onClick={() => {
                                                selectedIds.forEach((id) => deleteMutation.mutate(id));
                                                setSelectedIds([]);
                                            }}
                                        >
                                            Delete
                                        </Button>
                                        <Button variant="ghost" className="text-quaternary hover:bg-secondary hover:text-white" onClick={() => setSelectedIds([])}>
                                            Clear
                                        </Button>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </>
                )}
            </AppShell>

            <UploadModal open={isUploadOpen} onClose={() => setUploadOpen(false)} onUploaded={onUploaded} />
            <ImportProgressCard job={importJob ?? null} onClose={() => setJobId(null)} />
            <ConflictDialog open={showConflict} onClose={() => setShowConflict(false)} onContinue={runImport} />
            <PreviewDrawer file={previewFile} onClose={() => setPreviewFile(null)} onDelete={setDeleteTarget} />
            <DeleteDialog file={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} deleting={deleteMutation.isPending} />
        </main>
    );
}

function EmptyState({ onUpload, onImport, showImport }: { onUpload: () => void; onImport: () => void; showImport: boolean }) {
    return (
        <section className="px-6 pb-10">
            <div className="mx-auto flex max-w-[620px] flex-col items-center rounded-[14px] border border-secondary bg-primary px-10 py-16 text-center">
                <div className="mb-5 flex size-14 items-center justify-center rounded-[12px] border border-utility-brand-200 bg-brand-primary">
                    <GoogleMark />
                </div>
                <h2 className="text-[18px] font-semibold text-primary">Your Data Room is empty</h2>
                <p className="mt-1.5 max-w-[340px] text-sm leading-6 text-tertiary">
                    Upload documents from your computer or import them securely from Google Drive to get started.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button variant="secondary" onClick={onUpload}>
                        Upload files
                    </Button>
                    {showImport ? (
                        <Button variant="primary" onClick={onImport}>
                            Import from Drive
                        </Button>
                    ) : null}
                </div>
            </div>
        </section>
    );
}

function NoResults({ search, onClear }: { search: string; onClear: () => void }) {
    return (
        <section className="px-6 pb-10">
            <div className="mx-auto flex max-w-[620px] flex-col items-center rounded-[14px] border border-secondary bg-primary px-10 py-16 text-center">
                <div className="mb-5 flex size-14 items-center justify-center rounded-[12px] border border-secondary bg-secondary">
                    <Search size={22} className="text-quaternary" />
                </div>
                <h2 className="text-[18px] font-semibold text-primary">No files match "{search}"</h2>
                <p className="mt-1.5 max-w-[340px] text-sm leading-6 text-tertiary">
                    Try a different search term, or clear the search to see all of your files.
                </p>
                <Button variant="secondary" className="mt-6" onClick={onClear}>
                    Clear search
                </Button>
            </div>
        </section>
    );
}

function PaginationBar({ pagination, isFetching, onPage }: { pagination: Pagination; isFetching: boolean; onPage: (page: number) => void }) {
    const { page, pageSize, total, totalPages } = pagination;
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    return (
        <div className="mx-6 mb-6 mt-1 flex flex-col items-center justify-between gap-3 border-t border-secondary px-1 py-4 sm:flex-row">
            <div className="text-sm text-tertiary">
                Showing <span className="font-medium text-secondary">{start}-{end}</span> of{" "}
                <span className="font-medium text-secondary">{total}</span>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="secondary"
                    className="px-3"
                    iconLeading={<ChevronLeft size={16} />}
                    disabled={page <= 1 || isFetching}
                    onClick={() => onPage(page - 1)}
                >
                    Previous
                </Button>
                <span className="px-2 text-sm text-tertiary">
                    Page {page} of {totalPages}
                </span>
                <Button
                    variant="secondary"
                    className="px-3"
                    iconTrailing={<ChevronRight size={16} />}
                    disabled={page >= totalPages || isFetching}
                    onClick={() => onPage(page + 1)}
                >
                    Next
                </Button>
            </div>
        </div>
    );
}

function LoadingState() {
    return (
        <section className="px-6 pb-8">
            <div className="overflow-hidden rounded-[14px] border border-secondary bg-primary">
                <div className="grid grid-cols-[48px_1fr_110px_90px_130px] items-center border-b border-secondary bg-secondary px-5 py-3 text-xs font-medium text-tertiary">
                    <div />
                    <div>Name</div>
                    <div>Source</div>
                    <div>Size</div>
                    <div>Date added</div>
                </div>
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="grid grid-cols-[48px_1fr_110px_90px_130px] items-center border-b border-secondary px-5 py-4 last:border-b-0">
                        <div className="size-[18px] rounded-[5px] bg-secondary" />
                        <div className="flex items-center gap-3">
                            <div className="h-[42px] w-[34px] animate-pulse rounded-[5px] bg-secondary" />
                            <div className="w-full max-w-[320px]">
                                <div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
                                <div className="mt-2 h-2 w-1/3 rounded bg-secondary" />
                            </div>
                        </div>
                        <div className="h-5 w-16 rounded-full bg-secondary" />
                        <div className="h-3 w-12 rounded bg-secondary" />
                        <div className="h-3 w-20 rounded bg-secondary" />
                    </div>
                ))}
            </div>
        </section>
    );
}

function DisconnectedState({ onUpload, onConnect }: { onUpload: () => void; onConnect: () => void }) {
    return (
        <>
            <section className="flex items-end justify-between px-6 pt-6">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-primary">Data Room</h1>
                    <p className="mt-1 text-sm text-tertiary">Connect Google Drive to bring your documents in.</p>
                </div>
                <Badge variant="drive">Step 2 of 2 - Connect Drive</Badge>
            </section>

            <section className="px-6 py-9">
                <div className="mx-auto max-w-[560px]">
                    <div className="rounded-[14px] border border-secondary bg-primary_alt px-10 py-10 text-center shadow-sm">
                        <div className="mx-auto mb-5 flex size-[60px] items-center justify-center rounded-[14px] border border-secondary bg-primary">
                            <GoogleMark />
                        </div>
                        <h2 className="text-[20px] font-semibold text-primary">Connect Google Drive to import files</h2>
                        <p className="mx-auto mt-2 max-w-[400px] text-sm leading-6 text-tertiary">
                            Securely import documents from your Drive into the Data Room. We use read-only access and never modify or delete anything in your Drive.
                        </p>
                        <Button variant="google" className="mt-6" iconLeading={<GoogleMark />} onClick={onConnect}>
                            Sign in with Google
                        </Button>
                    </div>

                    <div className="my-5 flex items-center gap-3">
                        <div className="h-px flex-1 bg-secondary" />
                        <div className="text-[13px] text-quaternary">or upload from your computer</div>
                        <div className="h-px flex-1 bg-secondary" />
                    </div>

                    <button
                        type="button"
                        onClick={onUpload}
                        className="flex w-full cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-primary px-6 py-6 text-center transition hover:border-brand-solid hover:bg-secondary"
                    >
                        <div className="text-sm font-medium text-secondary">
                            Drag files here, or <span className="font-semibold text-brand-secondary underline">browse</span>
                        </div>
                        <div className="mt-1 text-xs text-quaternary">PDF, images, Office docs up to 25 MB</div>
                    </button>
                </div>
            </section>
        </>
    );
}
