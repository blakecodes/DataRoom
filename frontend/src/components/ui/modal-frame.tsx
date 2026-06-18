import type { PropsWithChildren, ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "@/utils/cx";

interface ModalFrameProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    headerIcon?: ReactNode;
    footer?: ReactNode;
    widthClassName?: string;
    panelClassName?: string;
}

export function ModalFrame({
    open,
    onClose,
    title,
    description,
    headerIcon,
    footer,
    widthClassName = "max-w-2xl",
    panelClassName,
    children,
}: PropsWithChildren<ModalFrameProps>) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/45 px-4 py-8 backdrop-blur-sm">
            <div className={cx("w-full rounded-2xl border border-primary bg-primary modal-shadow", widthClassName, panelClassName)}>
                {(title || description) && (
                    <div className="flex items-start justify-between border-b border-secondary px-6 py-5">
                        <div className="flex gap-3">
                            {headerIcon}
                            <div>
                                {title ? <h2 className="text-[17px] font-semibold text-primary">{title}</h2> : null}
                                {description ? <p className="mt-1 text-sm text-tertiary">{description}</p> : null}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-tertiary transition hover:bg-primary_hover hover:text-secondary"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}
                {children}
                {footer ? <div className="border-t border-secondary bg-primary_alt px-6 py-4">{footer}</div> : null}
            </div>
        </div>
    );
}

export function Drawer({
    open,
    onClose,
    children,
}: PropsWithChildren<{ open: boolean; onClose: () => void }>) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-overlay/35 backdrop-blur-sm">
            <button type="button" className="flex-1 cursor-default" onClick={onClose} aria-label="Close preview" />
            <div className="h-full w-full max-w-[460px] border-l border-secondary bg-primary shadow-2xl">{children}</div>
        </div>
    );
}
