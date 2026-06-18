import type { ReactNode } from "react";
import { Eye, MoreHorizontal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FileIcon } from "@/components/ui/file-icon";
import type { FileRecord } from "@/types";
import { cx } from "@/utils/cx";

interface FileTableProps {
    files: FileRecord[];
    selectedIds: string[];
    view: "list" | "grid";
    onToggleSelect: (id: string) => void;
    onPreview: (file: FileRecord) => void;
    onDelete: (file: FileRecord) => void;
}

export function FileTable({ files, selectedIds, view, onToggleSelect, onPreview, onDelete }: FileTableProps) {
    if (view === "grid") {
        return (
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
                {files.map((file) => (
                    <article
                        key={file.id}
                        className="rounded-2xl border border-secondary bg-primary p-4 shadow-sm transition hover:border-utility-brand-200 hover:shadow-md"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <FileIcon kind={file.kind} />
                                <div>
                                    <div className="max-w-[170px] truncate text-sm font-medium text-primary">{file.name}</div>
                                    <div className="mt-1 text-[13px] text-tertiary">{file.description}</div>
                                </div>
                            </div>
                            <button type="button" className="cursor-pointer rounded-lg p-2 text-quaternary transition hover:bg-secondary hover:text-tertiary">
                                <MoreHorizontal size={18} />
                            </button>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <Badge variant={file.source === "drive" ? "drive" : "upload"}>
                                {file.source === "drive" ? "Drive" : "Upload"}
                            </Badge>
                            <span className="text-xs text-tertiary">{file.sizeLabel}</span>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-secondary pt-4">
                            <button
                                type="button"
                                onClick={() => onPreview(file)}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-secondary transition hover:bg-secondary"
                            >
                                <Eye size={16} /> Preview
                            </button>
                            <button
                                type="button"
                                onClick={() => onDelete(file)}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-error-primary transition hover:bg-utility-red-50"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        );
    }

    return (
        <div>
            <div className="grid grid-cols-[48px_1.5fr_130px_96px_100px_150px_92px] items-center border-y border-secondary bg-secondary px-6 text-xs font-medium text-tertiary">
                <div className="py-3" />
                <div>Name</div>
                <div>Source</div>
                <div>Type</div>
                <div>Size</div>
                <div>Date added</div>
                <div />
            </div>

            {files.map((file) => {
                const isSelected = selectedIds.includes(file.id);

                return (
                    <div
                        key={file.id}
                        className={cx(
                            "grid grid-cols-[48px_1.5fr_130px_96px_100px_150px_92px] items-center border-b border-secondary px-6 transition hover:bg-primary_alt",
                            isSelected && "bg-secondary",
                        )}
                    >
                        <div className="py-4">
                            <button
                                type="button"
                                onClick={() => onToggleSelect(file.id)}
                                className={cx(
                                    "flex size-[18px] cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] transition",
                                    isSelected
                                        ? "border-brand-solid bg-brand-solid hover:border-brand-solid_hover hover:bg-brand-solid_hover"
                                        : "border-primary bg-primary hover:border-secondary hover:bg-secondary",
                                )}
                                aria-label={`Select ${file.name}`}
                            >
                                {isSelected ? <span className="text-[10px] text-white">✓</span> : null}
                            </button>
                        </div>

                        <div className="flex min-w-0 items-center gap-3 py-3">
                            <FileIcon kind={file.kind} />
                            <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-primary">{file.name}</div>
                                <div className="text-[13px] text-tertiary">{file.description}</div>
                            </div>
                        </div>

                        <div>
                            <Badge variant={file.source === "drive" ? "drive" : "upload"}>
                                {file.source === "drive" ? "Drive" : "Upload"}
                            </Badge>
                        </div>
                        <div className="text-sm text-secondary">{file.typeLabel}</div>
                        <div className="text-sm text-secondary">{file.sizeLabel}</div>
                        <div className="text-sm text-secondary">{file.dateAdded}</div>
                        <div className="flex justify-end gap-1">
                            <IconAction onClick={() => onPreview(file)} ariaLabel={`Preview ${file.name}`} icon={<Eye size={16} />} />
                            <IconAction
                                onClick={() => onDelete(file)}
                                ariaLabel={`Delete ${file.name}`}
                                icon={<Trash2 size={16} className="text-error-primary" />}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function IconAction({
    icon,
    onClick,
    ariaLabel,
}: {
    icon: ReactNode;
    onClick?: () => void;
    ariaLabel: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            className="flex size-8 cursor-pointer items-center justify-center rounded-[7px] border border-secondary bg-primary text-secondary transition hover:border-primary hover:bg-secondary"
        >
            {icon}
        </button>
    );
}
