import type { FileKind } from "@/types";

const EXT_KIND: Record<string, FileKind> = {
    pdf: "pdf",
    xlsx: "xlsx",
    xls: "xlsx",
    csv: "xlsx",
    pptx: "pptx",
    ppt: "pptx",
    docx: "docx",
    doc: "docx",
    png: "png",
    jpg: "png",
    jpeg: "png",
    gif: "png",
    webp: "png",
    zip: "zip",
};

export function extOf(name: string): string {
    if (!name.includes(".")) return "";
    return name.split(".").pop()!.toLowerCase();
}

export function kindFromName(name: string): FileKind {
    return EXT_KIND[extOf(name)] ?? "generic";
}

const KIND_EXT: Record<FileKind, string> = {
    pdf: "pdf",
    xlsx: "xlsx",
    pptx: "pptx",
    docx: "docx",
    png: "png",
    zip: "zip",
    generic: "",
};

/** Best-effort file extension for DocViewer when previewing a blob: URL. */
export function fileTypeFor(name: string, kind: FileKind): string {
    return extOf(name) || KIND_EXT[kind] || "";
}
