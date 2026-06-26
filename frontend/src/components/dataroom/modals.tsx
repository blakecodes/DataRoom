import { useEffect, useMemo, useRef, useState } from "react";
import DocViewer, { DocViewerRenderers } from "@iamjariwala/react-doc-viewer";
import { AlertCircle, CheckCircle2, Download, FileUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileIcon } from "@/components/ui/file-icon";
import { Drawer, ModalFrame } from "@/components/ui/modal-frame";
import { uploadFile, fetchFileBlobUrl } from "@/lib/api/files";
import type { ImportJob } from "@/lib/api/types";
import { fileTypeFor, kindFromName } from "@/lib/file-kind";
import type { ConflictResolution, FileKind, FileRecord } from "@/types";
import { cx } from "@/utils/cx";

const ACTION_LABEL: Record<string, string> = {
    created: "Imported",
    overwritten: "Overwritten",
    copied: "Saved copy",
    skipped_unchanged: "Already imported",
};

export function ImportProgressCard({ job, onClose }: { job: ImportJob | null; onClose: () => void }) {
    if (!job) {
        return null;
    }

    const finishedItems = job.items.filter((item) => item.status !== "pending" && item.status !== "running").length;
    const done = Math.max(job.completedCount + job.failedCount, finishedItems);
    const active = job.status === "pending" || job.status === "running";
    const pct = job.totalCount ? Math.round((done / job.totalCount) * 100) : 0;
    const title = active ? "Importing files..." : job.failedCount ? "Import finished with errors" : "Import complete";

    return (
        <div className="fixed bottom-6 right-6 z-40 w-full max-w-[480px] overflow-hidden rounded-[14px] border border-secondary bg-primary app-shell-shadow">
            <div className="border-b border-secondary px-6 py-5">
                <div className="text-base font-semibold text-primary">{title}</div>
                <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-brand-solid transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[13px] font-medium text-secondary">
                        {done} of {job.totalCount}
                    </div>
                </div>
            </div>

            <div className="hide-scrollbar max-h-[280px] space-y-1 overflow-y-auto px-3 py-2">
                {job.items.map((item) => {
                    const name = item.name ?? item.sourceFileId;
                    return (
                        <div key={item.sourceFileId} className="flex items-center gap-3 px-3 py-2.5">
                            <FileIcon kind={kindFromName(name)} compact />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-secondary">{name}</div>
                                {item.status === "failed" && item.error ? (
                                    <div className="text-xs text-utility-red-700">Failed - {item.error}</div>
                                ) : item.action ? (
                                    <div className="text-xs text-tertiary">{ACTION_LABEL[item.action] ?? item.action}</div>
                                ) : null}
                            </div>
                            {item.status === "done" ? <Badge variant="success">Done</Badge> : null}
                            {item.status === "skipped" ? <Badge variant="neutral">Skipped</Badge> : null}
                            {(item.status === "running" || item.status === "pending") ? <Badge variant="processing">Importing</Badge> : null}
                            {item.status === "failed" ? <Badge variant="error">Failed</Badge> : null}
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center justify-between border-t border-secondary bg-primary_alt px-6 py-4">
                <p className="text-[13px] font-medium text-secondary">
                    {job.completedCount} imported{job.failedCount ? ` - ${job.failedCount} failed` : ""}
                </p>
                <Button variant="ghost" onClick={onClose} disabled={active}>
                    {active ? "Working..." : "Dismiss"}
                </Button>
            </div>
        </div>
    );
}

interface LocalUpload {
    id: string;
    name: string;
    kind: FileKind;
    status: "uploading" | "uploaded" | "failed";
    detail: string;
}

export function UploadModal({
    open,
    onClose,
    onUploaded,
}: {
    open: boolean;
    onClose: () => void;
    onUploaded: () => void;
}) {
    const [items, setItems] = useState<LocalUpload[]>([]);

    const handleFiles = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList);
        const staged: LocalUpload[] = files.map((file, index) => ({
            id: `${Date.now()}-${index}`,
            name: file.name,
            kind: kindFromName(file.name),
            status: "uploading",
            detail: "Uploading...",
        }));
        setItems((current) => [...staged, ...current]);

        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            const stagedId = staged[i].id;
            try {
                await uploadFile(file);
                setItems((current) =>
                    current.map((item) =>
                        item.id === stagedId ? { ...item, status: "uploaded", detail: "Uploaded" } : item,
                    ),
                );
                onUploaded();
            } catch (err) {
                const message = err instanceof Error ? err.message : "Upload failed";
                setItems((current) =>
                    current.map((item) =>
                        item.id === stagedId ? { ...item, status: "failed", detail: message } : item,
                    ),
                );
            }
        }
    };

    const close = () => {
        setItems([]);
        onClose();
    };

    return (
        <ModalFrame open={open} onClose={close} title="Upload files" widthClassName="max-w-[480px]">
            <div className="px-6 py-5">
                <label
                    htmlFor="upload-files"
                    className="block cursor-pointer rounded-xl border-2 border-dashed border-brand-solid bg-brand-primary px-6 py-8 text-center transition hover:bg-brand-primary_alt"
                >
                    <input
                        id="upload-files"
                        type="file"
                        multiple
                        className="sr-only"
                        onChange={(event) => handleFiles(event.target.files)}
                    />
                    <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-[10px] border border-utility-brand-200 bg-primary">
                        <FileUp size={20} className="text-brand-secondary" />
                    </div>
                    <div className="text-sm font-semibold text-brand-secondary">Drop files to upload</div>
                    <div className="mt-1 text-[13px] text-tertiary">
                        or <span className="font-semibold text-brand-secondary underline">browse</span> - PDF, images, Office docs up to 25 MB
                    </div>
                </label>

                {items.length > 0 ? (
                    <div className="mt-4 space-y-2.5">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className={cx(
                                    "flex items-center gap-3 rounded-[10px] border p-3",
                                    item.status === "uploaded" && "border-utility-green-200 bg-utility-green-50",
                                    item.status === "failed" && "border-utility-red-200 bg-utility-red-50",
                                    item.status === "uploading" && "border-secondary bg-primary",
                                )}
                            >
                                <FileIcon kind={item.kind} compact />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] font-medium text-secondary">{item.name}</div>
                                    <div
                                        className={cx(
                                            "text-xs",
                                            item.status === "failed"
                                                ? "text-utility-red-700"
                                                : item.status === "uploaded"
                                                  ? "text-utility-green-700"
                                                  : "text-tertiary",
                                        )}
                                    >
                                        {item.detail}
                                    </div>
                                </div>
                                {item.status === "uploaded" ? <CheckCircle2 size={18} className="text-utility-green-500" /> : null}
                                {item.status === "uploading" ? (
                                    <div className="size-4 animate-spin rounded-full border-2 border-secondary border-t-brand-solid" />
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : null}

                <div className="mt-5 flex justify-end">
                    <Button variant="secondary" onClick={close}>
                        Done
                    </Button>
                </div>
            </div>
        </ModalFrame>
    );
}

export function ConflictDialog({
    open,
    onClose,
    onContinue,
}: {
    open: boolean;
    onClose: () => void;
    onContinue: (resolution: ConflictResolution) => void;
}) {
    const [resolution, setResolution] = useState<ConflictResolution>("overwrite");

    return (
        <ModalFrame open={open} onClose={onClose} widthClassName="max-w-[460px]">
            <div className="px-6 py-6">
                <div className="flex size-12 items-center justify-center rounded-full border-[8px] border-utility-red-100 bg-utility-red-50">
                    <AlertCircle size={22} className="text-error-primary" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-primary">How should we handle changed files?</h2>
                <p className="mt-2 text-sm leading-6 text-tertiary">
                    If a selected file was already imported and has changed in Google Drive, choose whether to overwrite the existing copy
                    or save a new copy. Unchanged files are skipped automatically.
                </p>

                <div className="mt-5 space-y-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary p-4">
                        <input checked={resolution === "overwrite"} onChange={() => setResolution("overwrite")} type="radio" />
                        <div>
                            <div className="text-sm font-semibold text-primary">Overwrite existing file</div>
                            <div className="mt-1 text-[13px] text-tertiary">Replace the current bytes and keep the same file entry.</div>
                        </div>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary p-4">
                        <input checked={resolution === "copy"} onChange={() => setResolution("copy")} type="radio" />
                        <div>
                            <div className="text-sm font-semibold text-primary">Save a copy</div>
                            <div className="mt-1 text-[13px] text-tertiary">Keep the current version and import the new file as a separate copy.</div>
                        </div>
                    </label>
                </div>

                <div className="mt-6 flex gap-3">
                    <Button fullWidth onClick={onClose}>
                        Cancel
                    </Button>
                    <Button fullWidth variant="primary" onClick={() => onContinue(resolution)}>
                        Continue
                    </Button>
                </div>
            </div>
        </ModalFrame>
    );
}

export function DeleteDialog({
    file,
    onClose,
    onConfirm,
    deleting = false,
}: {
    file: FileRecord | null;
    onClose: () => void;
    onConfirm: (file: FileRecord) => void;
    deleting?: boolean;
}) {
    return (
        <ModalFrame open={Boolean(file)} onClose={onClose} widthClassName="max-w-[460px]">
            <div className="px-6 py-6">
                <div className="flex size-12 items-center justify-center rounded-full border-[8px] border-utility-red-100 bg-utility-red-50">
                    <Trash2 size={22} className="text-error-primary" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-primary">Delete "{file?.name}"?</h2>
                <p className="mt-2 text-sm leading-6 text-tertiary">
                    This removes the file from your <strong className="font-semibold text-secondary">Data Room only</strong>. The original stays safe in Google Drive. This action cannot be undone.
                </p>
                <div className="mt-6 flex gap-3">
                    <Button fullWidth onClick={onClose} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button fullWidth variant="destructive" disabled={deleting} onClick={() => file && onConfirm(file)}>
                        {deleting ? "Deleting..." : "Delete file"}
                    </Button>
                </div>
            </div>
        </ModalFrame>
    );
}

export function PreviewDrawer({
    file,
    onClose,
    onDelete,
}: {
    file: FileRecord | null;
    onClose: () => void;
    onDelete: (file: FileRecord) => void;
}) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const urlRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        // Revoke any prior object URL.
        if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
        }
        setBlobUrl(null);
        setError(null);

        if (file && file.previewable) {
            setLoading(true);
            fetchFileBlobUrl(file.id)
                .then((url) => {
                    if (cancelled) {
                        URL.revokeObjectURL(url);
                        return;
                    }
                    urlRef.current = url;
                    setBlobUrl(url);
                })
                .catch(() => setError("Could not load preview."))
                .finally(() => !cancelled && setLoading(false));
        }

        return () => {
            cancelled = true;
        };
    }, [file]);

    useEffect(() => {
        return () => {
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        };
    }, []);

    const documents = useMemo(() => {
        if (!file || !blobUrl) return [];
        return [{ uri: blobUrl, fileType: fileTypeFor(file.name, file.kind) }];
    }, [file, blobUrl]);

    const download = async () => {
        if (!file) return;
        const url = blobUrl ?? (await fetchFileBlobUrl(file.id));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };

    return (
        <Drawer open={Boolean(file)} onClose={onClose}>
            {file ? (
                <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between border-b border-secondary px-5 py-[18px]">
                        <div className="flex min-w-0 gap-3">
                            <FileIcon kind={file.kind} />
                            <div className="min-w-0">
                                <div className="truncate text-[15px] font-semibold text-primary">{file.name}</div>
                                <div className="mt-1 text-xs text-tertiary">
                                    {file.typeLabel} - {file.sizeLabel} - <span className="text-brand-secondary">{file.source === "drive" ? "Drive" : "Upload"}</span> - {file.dateAdded}
                                </div>
                                {file.sourceOwner ? (
                                    <div className="mt-1 text-xs text-tertiary">
                                        {file.sourceOwner} - {file.sourceModifiedAt} -{" "}
                                        <a className="font-medium text-brand-secondary" href={file.sourceWebLink} target="_blank" rel="noreferrer">
                                            Open in Drive
                                        </a>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="cursor-pointer rounded-lg p-2 text-tertiary transition hover:bg-secondary hover:text-secondary">
                            x
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden bg-tertiary p-6">
                        {file.previewable ? (
                            loading ? (
                                <div className="flex h-full items-center justify-center">
                                    <div className="size-7 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
                                </div>
                            ) : error ? (
                                <div className="flex h-full items-center justify-center rounded-md bg-primary p-8 text-center text-sm text-tertiary">
                                    {error}
                                </div>
                            ) : documents.length > 0 ? (
                                <div className="doc-viewer h-full overflow-hidden rounded-md">
                                    <DocViewer
                                        key={file.id}
                                        documents={documents}
                                        pluginRenderers={DocViewerRenderers}
                                        config={{
                                            header: { disableHeader: true, disableFileName: true },
                                            noRenderer: {
                                                overrideComponent: () => (
                                                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-tertiary">
                                                        Preview is unavailable for this file type. Download the file to review it.
                                                    </div>
                                                ),
                                            },
                                        }}
                                    />
                                </div>
                            ) : null
                        ) : (
                            <div className="flex h-full items-center justify-center rounded-md bg-primary p-8 text-center">
                                <div>
                                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-primary">
                                        <AlertCircle size={22} className="text-brand-secondary" />
                                    </div>
                                    <div className="text-sm font-semibold text-primary">Preview not available</div>
                                    <div className="mt-2 text-sm leading-6 text-tertiary">
                                        HTML, SVG, ZIP, and other risky or unsupported file types are download-only in this UI.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2.5 border-t border-secondary px-5 py-4">
                        <Button fullWidth iconLeading={<Download size={16} />} onClick={download}>
                            Download
                        </Button>
                        <Button
                            variant="secondary"
                            className="border-utility-red-200 text-error-primary hover:border-utility-red-300 hover:bg-utility-red-50"
                            iconLeading={<Trash2 size={16} />}
                            onClick={() => onDelete(file)}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            ) : null}
        </Drawer>
    );
}
