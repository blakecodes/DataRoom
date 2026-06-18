import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "@/utils/cx";

export const inputClassName =
    "w-full rounded-lg border border-primary bg-primary px-3 py-2.5 text-sm text-primary shadow-xs outline-none transition placeholder:text-placeholder focus:border-brand-solid focus:shadow-[0_0_0_4px_var(--color-bg-brand-primary)] disabled:cursor-not-allowed disabled:bg-secondary disabled:text-tertiary";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
    return <input className={cx(inputClassName, className)} {...props} />;
}

export function LabeledInput({
    label,
    hint,
    trailing,
    id,
    className,
    ...props
}: InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    hint?: string;
    trailing?: ReactNode;
}) {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-secondary">
                <label htmlFor={inputId}>{label}</label>
                {trailing}
            </div>
            <Input id={inputId} className={className} {...props} />
            {hint ? <p className="mt-[7px] text-xs text-tertiary">{hint}</p> : null}
        </div>
    );
}
