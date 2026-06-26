import type { PropsWithChildren } from "react";
import { cx } from "@/utils/cx";

type BadgeVariant = "drive" | "upload" | "success" | "connected" | "error" | "warning" | "processing" | "neutral";

const variants: Record<BadgeVariant, string> = {
    drive: "border-utility-brand-200 bg-utility-brand-50 text-utility-brand-700",
    upload: "border-secondary bg-secondary text-secondary",
    success: "border-utility-green-200 bg-utility-green-50 text-utility-green-700",
    connected: "border-utility-green-200 bg-utility-green-50 text-utility-green-700",
    error: "border-utility-red-200 bg-utility-red-50 text-utility-red-700",
    warning: "border-utility-yellow-200 bg-utility-yellow-50 text-utility-yellow-700",
    processing: "border-utility-brand-200 bg-utility-brand-50 text-utility-brand-700",
    neutral: "border-secondary bg-secondary text-tertiary",
};

export function Badge({
    children,
    variant,
    className,
}: PropsWithChildren<{ variant: BadgeVariant; className?: string }>) {
    return (
        <span
            className={cx(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                variants[variant],
                className,
            )}
        >
            {variant === "drive" && <span className="size-1.5 rounded-full bg-brand-solid" />}
            {variant === "upload" && <span className="size-1.5 rounded-full bg-fg-quaternary" />}
            {variant === "connected" && <span className="size-1.5 rounded-full bg-utility-green-500" />}
            {variant === "neutral" && <span className="size-1.5 rounded-full bg-fg-quaternary" />}
            {variant === "processing" && (
                <span className="size-2 animate-spin rounded-full border-2 border-utility-brand-200 border-t-brand-solid" />
            )}
            {children}
        </span>
    );
}
