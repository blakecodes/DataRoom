import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { cx } from "@/utils/cx";

type Variant = "primary" | "secondary" | "destructive" | "ghost" | "google";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    iconLeading?: ReactNode;
    iconTrailing?: ReactNode;
    fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
    primary:
        "border-brand-solid bg-brand-solid text-white shadow-xs hover:bg-brand-solid_hover active:bg-brand-solid_hover",
    secondary:
        "border-primary bg-primary text-secondary shadow-xs hover:border-secondary hover:bg-primary_hover active:bg-secondary",
    destructive:
        "border-error-solid bg-error-solid text-white shadow-xs hover:bg-error-solid_hover active:bg-error-solid_hover",
    ghost: "border-transparent bg-transparent text-brand-secondary hover:bg-brand-primary active:bg-brand-primary_alt",
    google: "border-primary bg-primary text-secondary shadow-xs hover:border-secondary hover:bg-primary_hover active:bg-secondary",
};

export function Button({
    variant = "secondary",
    iconLeading,
    iconTrailing,
    className,
    children,
    fullWidth,
    type = "button",
    ...props
}: PropsWithChildren<ButtonProps>) {
    return (
        <button
            type={type}
            className={cx(
                "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-60",
                fullWidth && "w-full",
                variants[variant],
                className,
            )}
            {...props}
        >
            {iconLeading}
            {children}
            {iconTrailing}
        </button>
    );
}

export function GoogleMark({ size = 18 }: { size?: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1C6.2 6.9 8.9 4.8 12 4.8Z" />
        </svg>
    );
}
