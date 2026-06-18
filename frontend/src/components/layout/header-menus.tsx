import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Moon, Settings } from "lucide-react";
import { Toggle } from "@/components/base/toggle/toggle";
import { useAuth } from "@/lib/auth/auth-context";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";

function useDismissibleMenu() {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    return { open, setOpen, rootRef };
}

function MenuPanel({ children }: { children: ReactNode }) {
    return (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[300px] overflow-hidden rounded-xl border border-secondary bg-primary shadow-xl">
            {children}
        </div>
    );
}

function MenuItem({
    children,
    onClick,
    to,
    destructive = false,
}: {
    children: ReactNode;
    onClick?: () => void;
    to?: string;
    destructive?: boolean;
}) {
    const className = cx(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-2.5 py-[9px] text-left text-sm font-medium transition",
        destructive ? "text-error-primary hover:bg-error-primary" : "text-secondary hover:bg-primary_hover hover:text-secondary_hover",
    );

    if (to) {
        return (
            <Link to={to} className={className} onClick={onClick}>
                {children}
            </Link>
        );
    }

    return (
        <button type="button" className={className} onClick={onClick}>
            {children}
        </button>
    );
}

function MenuDivider() {
    return <div className="mx-1 my-1.5 h-px bg-secondary" />;
}

function DarkModeToggle() {
    const { resolvedTheme, setTheme } = useTheme();

    return (
        <div className="flex items-center justify-between gap-3 rounded-[7px] px-2.5 py-[9px]">
            <div className="flex items-center gap-2.5 text-sm font-medium text-secondary">
                <Moon size={18} className="text-fg-quaternary" strokeWidth={1.8} />
                Dark mode
            </div>
            <Toggle
                slim
                size="sm"
                aria-label="Dark mode"
                isSelected={resolvedTheme === "dark"}
                onChange={(selected) => setTheme(selected ? "dark" : "light")}
            />
        </div>
    );
}

export function UserMenu({
    userName,
    userInitials,
    userEmail,
}: {
    userName: string;
    userInitials: string;
    userEmail: string;
}) {
    const { open, setOpen, rootRef } = useDismissibleMenu();
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        setOpen(false);
        await logout();
        navigate("/login", { replace: true });
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label="Open account menu"
                onClick={() => setOpen((value) => !value)}
                className={cx(
                    "flex size-9 cursor-pointer items-center justify-center rounded-full border text-[13px] font-semibold transition",
                    open
                        ? "border-brand-solid bg-brand-primary text-brand-secondary shadow-[0_0_0_4px_var(--color-bg-brand-primary)]"
                        : "border-utility-brand-200 bg-brand-primary text-brand-secondary hover:border-brand-solid hover:bg-brand-primary_alt",
                )}
            >
                {userInitials}
            </button>

            {open ? (
                <MenuPanel>
                    <div className="flex items-center gap-[11px] border-b border-secondary p-3.5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-utility-brand-200 bg-brand-primary text-[13px] font-semibold text-brand-secondary">
                            {userInitials}
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-primary">{userName}</div>
                            <div className="truncate text-[13px] text-tertiary">{userEmail}</div>
                        </div>
                    </div>
                    <div className="p-1.5">
                        <DarkModeToggle />
                        <MenuDivider />
                        <MenuItem to="/settings" onClick={() => setOpen(false)}>
                            <Settings size={18} className="text-fg-quaternary" strokeWidth={1.8} />
                            Account settings
                        </MenuItem>
                        <MenuDivider />
                        <MenuItem destructive onClick={handleLogout}>
                            <LogOut size={18} strokeWidth={1.8} />
                            Log out
                        </MenuItem>
                    </div>
                </MenuPanel>
            ) : null}
        </div>
    );
}
