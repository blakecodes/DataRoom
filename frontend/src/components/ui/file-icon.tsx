import type { FileKind } from "@/types";

const accentByKind: Record<FileKind, string> = {
    pdf: "#D92D20",
    xlsx: "#079455",
    pptx: "#E04F16",
    docx: "#1570EF",
    png: "#DD2590",
    zip: "#475467",
    generic: "#667085",
};

const labelByKind: Record<FileKind, string> = {
    pdf: "PDF",
    xlsx: "XLS",
    pptx: "PPT",
    docx: "DOC",
    png: "IMG",
    zip: "ZIP",
    generic: "FILE",
};

export function FileIcon({ kind, compact = false }: { kind: FileKind; compact?: boolean }) {
    return (
        <div
            className={`relative flex shrink-0 items-end justify-center rounded-[5px] border-[1.5px] border-primary bg-primary ${
                compact ? "h-8 w-[26px] pb-1" : "h-[42px] w-[34px] pb-1.5"
            }`}
        >
            {!compact && (
                <div className="absolute -right-[1px] -top-[1px] h-0 w-0 rounded-tr-[5px] border-l-[10px] border-l-transparent border-t-[10px] border-t-secondary" />
            )}
            <span
                className="rounded-[3px] px-1 py-0.5 text-[8px] font-bold tracking-[0.03em] text-white"
                style={{ backgroundColor: accentByKind[kind] }}
            >
                {labelByKind[kind]}
            </span>
        </div>
    );
}
