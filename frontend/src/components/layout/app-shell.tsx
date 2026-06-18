import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/header-menus";
import type { DriveStatus } from "@/types";
import { cx } from "@/utils/cx";

interface AppShellProps {
    activeTab: "data-room" | "settings";
    driveStatus: DriveStatus;
    userName: string;
    userInitials: string;
    userEmail: string;
    rightActions?: ReactNode;
}

export function AppShell({
    activeTab,
    driveStatus,
    userName,
    userInitials,
    userEmail,
    rightActions,
    children,
}: PropsWithChildren<AppShellProps>) {
    const statusConfig =
        driveStatus === "connected"
            ? null
            : driveStatus === "expired"
              ? {
                    wrapper: "border-utility-red-200 bg-utility-red-50 text-utility-red-700",
                    dot: "bg-utility-red-500 shadow-[0_0_0_3px_var(--color-utility-red-100)]",
                    label: "Disconnected",
                }
              : {
                    wrapper: "border-utility-red-200 bg-utility-red-50 text-utility-red-700",
                    dot: "bg-utility-red-500",
                    label: "Drive not connected",
                };

    return (
        <div className="mx-auto w-full max-w-[1280px] overflow-hidden rounded-[14px] border border-secondary bg-primary app-shell-shadow">
            <header className="flex h-16 items-center justify-between border-b border-secondary px-6">
                <div className="flex items-center gap-7">
                    <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-brand-solid text-white">
                            <Shield size={18} strokeWidth={1.8} />
                        </div>
                        <div className="text-base font-semibold text-primary">Acme Data Room</div>
                    </div>
                    <nav className="flex items-center gap-1">
                        <Link
                            to="/app"
                            className={cx(
                                "rounded-lg px-3 py-2 text-sm font-medium transition",
                                activeTab === "data-room"
                                    ? "bg-brand-primary text-brand-secondary"
                                    : "text-secondary hover:bg-primary_hover hover:text-secondary_hover",
                            )}
                        >
                            Data Room
                        </Link>
                        <Link
                            to="/settings"
                            className={cx(
                                "rounded-lg px-3 py-2 text-sm font-medium transition",
                                activeTab === "settings"
                                    ? "bg-brand-primary text-brand-secondary"
                                    : "text-secondary hover:bg-primary_hover hover:text-secondary_hover",
                            )}
                        >
                            Settings
                        </Link>
                    </nav>
                </div>

                <div className="flex items-center gap-3">
                    {statusConfig ? (
                        <div className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium", statusConfig.wrapper)}>
                            <span className={cx("size-2 rounded-full", statusConfig.dot)} />
                            <span>{statusConfig.label}</span>
                        </div>
                    ) : null}
                    {rightActions}
                    <UserMenu userName={userName} userInitials={userInitials} userEmail={userEmail} />
                </div>
            </header>
            {children}
        </div>
    );
}

export function AppActions({
    showImport,
    onUpload,
    onImport,
}: {
    showImport: boolean;
    onUpload: () => void;
    onImport: () => void;
}) {
    return (
        <>
            <Button variant="secondary" onClick={onUpload}>
                Upload
            </Button>
            {showImport ? (
                <Button variant="primary" onClick={onImport}>
                    Import from Drive
                </Button>
            ) : null}
        </>
    );
}
