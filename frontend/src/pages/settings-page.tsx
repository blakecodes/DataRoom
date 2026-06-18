import type { LucideIcon } from "lucide-react";
import { FolderOpen, Lock, RotateCw, User } from "lucide-react";
import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, initials as toInitials } from "@/lib/auth/auth-context";
import { useChangePassword, useDisconnectGoogle, useUpdateProfile } from "@/lib/hooks";
import { getGoogleConsentUrl } from "@/lib/api/google";
import { ApiError } from "@/lib/api/client";

type SettingsSection = "profile" | "password" | "integrations";

const NAV_ITEMS: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "password", label: "Password", icon: Lock },
    { id: "integrations", label: "Integrations", icon: FolderOpen },
];

export function SettingsPage() {
    const { user, driveStatus, driveAccountEmail, refreshMe } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const updateProfileMutation = useUpdateProfile();
    const changePasswordMutation = useChangePassword();
    const disconnectMutation = useDisconnectGoogle();

    const displayName = user?.displayName || user?.email || "Account";
    const accountEmail = user?.email ?? "";

    const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
    const [fullName, setFullName] = useState(displayName);
    const [email, setEmail] = useState(accountEmail);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [profileMsg, setProfileMsg] = useState<string | null>(null);
    const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [driveMsg, setDriveMsg] = useState<string | null>(null);

    // Sync local fields when the profile loads/changes.
    useEffect(() => {
        setFullName(displayName);
        setEmail(accountEmail);
    }, [displayName, accountEmail]);

    // Handle the OAuth callback redirect (?drive=connected | error).
    useEffect(() => {
        const drive = searchParams.get("drive");
        if (!drive) return;
        if (drive === "connected") {
            refreshMe().catch(() => undefined);
            setDriveMsg("Google Drive connected.");
        } else if (drive === "error") {
            const reason = searchParams.get("reason");
            if (reason === "drive_permission_required") {
                setDriveMsg(
                    "Google connected, but Drive access wasn't granted. Reconnect and allow access to your Drive files (check the Drive permission).",
                );
            } else {
                setDriveMsg("Google connection was cancelled or failed. Try again.");
            }
        }
        searchParams.delete("drive");
        searchParams.delete("reason");
        setSearchParams(searchParams, { replace: true });
    }, [searchParams, setSearchParams, refreshMe]);

    const onSaveProfile = async () => {
        setProfileMsg(null);
        try {
            await updateProfileMutation.mutateAsync(fullName);
            await refreshMe();
            setProfileMsg("Saved.");
        } catch (err) {
            setProfileMsg(err instanceof ApiError ? err.message : "Could not save changes.");
        }
    };

    const onUpdatePassword = async () => {
        setPasswordMsg(null);
        if (newPassword.length < 8) {
            setPasswordMsg({ ok: false, text: "New password must be at least 8 characters." });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordMsg({ ok: false, text: "Passwords do not match." });
            return;
        }
        try {
            await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordMsg({ ok: true, text: "Password updated." });
        } catch (err) {
            setPasswordMsg({ ok: false, text: err instanceof ApiError ? err.message : "Could not update password." });
        }
    };

    const connectDrive = async () => {
        try {
            window.location.href = await getGoogleConsentUrl();
        } catch {
            setDriveMsg("Could not start Google connection.");
        }
    };

    const onDisconnect = async () => {
        try {
            await disconnectMutation.mutateAsync();
            await refreshMe();
            setDriveMsg("Google Drive disconnected.");
        } catch {
            setDriveMsg("Could not disconnect.");
        }
    };
    const sectionRefs = useRef<Record<SettingsSection, HTMLElement | null>>({
        profile: null,
        password: null,
        integrations: null,
    });
    const isScrollingRef = useRef(false);

    const scrollToSection = useCallback((id: SettingsSection) => {
        const el = sectionRefs.current[id];
        if (!el) return;

        isScrollingRef.current = true;
        setActiveSection(id);
        el.scrollIntoView({ behavior: "smooth", block: "start" });

        window.setTimeout(() => {
            isScrollingRef.current = false;
        }, 800);
    }, []);

    useEffect(() => {
        const updateActiveSection = () => {
            if (isScrollingRef.current) return;

            const offset = 120;
            let current: SettingsSection = NAV_ITEMS[0].id;

            for (const { id } of NAV_ITEMS) {
                const el = sectionRefs.current[id];
                if (el && el.getBoundingClientRect().top <= offset) {
                    current = id;
                }
            }

            setActiveSection(current);
        };

        updateActiveSection();
        window.addEventListener("scroll", updateActiveSection, { passive: true });
        window.addEventListener("resize", updateActiveSection);

        return () => {
            window.removeEventListener("scroll", updateActiveSection);
            window.removeEventListener("resize", updateActiveSection);
        };
    }, []);

    return (
        <main className="min-h-screen bg-secondary px-4 py-8 md:px-8">
            <AppShell activeTab="settings" driveStatus={driveStatus} userName={displayName} userInitials={toInitials(displayName)} userEmail={accountEmail}>
                <div className="flex flex-col lg:flex-row">
                    <aside className="w-full shrink-0 border-b border-secondary px-4 py-6 lg:w-[240px] lg:border-b-0 lg:border-r lg:px-4">
                        <div className="px-2 pb-[18px] text-[24px] font-semibold tracking-[-0.01em] text-primary">Settings</div>
                        <nav className="flex flex-col gap-0.5">
                            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                                <SubnavItem
                                    key={id}
                                    active={activeSection === id}
                                    label={label}
                                    icon={<Icon size={18} className={activeSection === id ? "text-brand-secondary" : "text-tertiary"} strokeWidth={1.8} />}
                                    onClick={() => scrollToSection(id)}
                                />
                            ))}
                        </nav>
                    </aside>

                    <section className="flex flex-1 flex-col gap-8 px-10 py-8 lg:max-w-[840px]">
                        <Section
                            ref={(el) => {
                                sectionRefs.current.profile = el;
                            }}
                            id="profile"
                            title="Personal info"
                            description="Update your name and contact details."
                            footer={
                                <>
                                    {profileMsg ? <span className="mr-auto self-center text-[13px] font-medium text-secondary">{profileMsg}</span> : null}
                                    <Button variant="secondary" className="px-[15px] py-[9px]" onClick={() => setFullName(displayName)}>
                                        Cancel
                                    </Button>
                                    <Button variant="primary" className="px-[15px] py-[9px]" onClick={onSaveProfile} disabled={updateProfileMutation.isPending}>
                                        {updateProfileMutation.isPending ? "Saving..." : "Save changes"}
                                    </Button>
                                </>
                            }
                        >
                            <div className="flex items-center gap-[18px] border-b border-secondary py-5">
                                <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-utility-brand-200 bg-brand-primary text-lg font-semibold text-brand-secondary">
                                    {toInitials(displayName)}
                                </div>
                                <div className="flex gap-2.5">
                                    <Button variant="secondary" className="px-[13px] py-2 text-[13px]">
                                        Upload photo
                                    </Button>
                                    <button
                                        type="button"
                                        className="cursor-pointer rounded-lg px-[13px] py-2 text-[13px] font-semibold text-tertiary transition hover:bg-secondary hover:text-secondary"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                            <Row label="Full name">
                                <Input
                                    id="full-name"
                                    type="text"
                                    name="fullName"
                                    autoComplete="name"
                                    value={fullName}
                                    onChange={(event) => setFullName(event.target.value)}
                                    className="max-w-[380px]"
                                />
                            </Row>
                            <Row label="Email address" hint="Used to sign in." bordered={false}>
                                <div className="flex max-w-[380px] items-center gap-2.5">
                                    <Input
                                        id="email"
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        value={email}
                                        readOnly
                                        disabled
                                        className="min-w-0 flex-1"
                                    />
                                    <Badge variant="success" className="shrink-0 px-[9px] py-1 text-xs">
                                        Verified
                                    </Badge>
                                </div>
                            </Row>
                        </Section>

                        <Section
                            ref={(el) => {
                                sectionRefs.current.password = el;
                            }}
                            id="password"
                            title="Password"
                            description="Choose a strong password you don't use elsewhere."
                            footer={
                                <>
                                    {passwordMsg ? (
                                        <span className={`mr-auto self-center text-[13px] font-medium ${passwordMsg.ok ? "text-utility-green-700" : "text-utility-red-700"}`}>
                                            {passwordMsg.text}
                                        </span>
                                    ) : null}
                                    <Button
                                        variant="secondary"
                                        className="px-[15px] py-[9px]"
                                        onClick={() => {
                                            setCurrentPassword("");
                                            setNewPassword("");
                                            setConfirmPassword("");
                                            setPasswordMsg(null);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button variant="primary" className="px-[15px] py-[9px]" onClick={onUpdatePassword} disabled={changePasswordMutation.isPending}>
                                        {changePasswordMutation.isPending ? "Updating..." : "Update password"}
                                    </Button>
                                </>
                            }
                        >
                            <Row label="Current password">
                                <Input
                                    id="current-password"
                                    type="password"
                                    name="currentPassword"
                                    autoComplete="current-password"
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.target.value)}
                                    className="max-w-[380px]"
                                />
                            </Row>
                            <Row label="New password" alignTop>
                                <div className="max-w-[380px]">
                                    <Input
                                        id="new-password"
                                        type="password"
                                        name="newPassword"
                                        autoComplete="new-password"
                                        placeholder="Enter new password"
                                        value={newPassword}
                                        onChange={(event) => setNewPassword(event.target.value)}
                                    />
                                    <div className="mt-[7px] text-xs text-tertiary">Must be at least 8 characters.</div>
                                </div>
                            </Row>
                            <Row label="Confirm new password" bordered={false}>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    name="confirmPassword"
                                    autoComplete="new-password"
                                    placeholder="Re-enter new password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    className="max-w-[380px]"
                                />
                            </Row>
                        </Section>

                        <Section
                            ref={(el) => {
                                sectionRefs.current.integrations = el;
                            }}
                            id="integrations"
                            title="Connected accounts"
                            description="Manage the services you import documents from."
                        >
                            {driveMsg ? (
                                <div className="mt-[18px] rounded-lg border border-utility-brand-200 bg-brand-primary px-3.5 py-2.5 text-[13px] font-medium text-brand-secondary">
                                    {driveMsg}
                                </div>
                            ) : null}
                            <div className="mt-[18px] flex flex-col gap-4 rounded-xl border border-secondary p-[18px] md:flex-row md:items-center">
                                <GoogleMarkLarge />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="text-[15px] font-semibold text-primary">Google Drive</div>
                                        {driveStatus === "connected" ? (
                                            <Badge variant="connected">Connected</Badge>
                                        ) : driveStatus === "expired" ? (
                                            <Badge variant="error">Expired</Badge>
                                        ) : (
                                            <Badge variant="upload">Not connected</Badge>
                                        )}
                                    </div>
                                    <div className="mt-[3px] text-[13px] text-tertiary">
                                        {driveStatus === "connected"
                                            ? `Read-only access · ${driveAccountEmail ?? accountEmail}`
                                            : "Connect to import documents from Google Drive (read-only)."}
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-2.5">
                                    {driveStatus === "connected" ? (
                                        <>
                                            <Button
                                                variant="secondary"
                                                className="px-[13px] py-2 text-[13px]"
                                                iconLeading={<RotateCw size={15} className="text-secondary" strokeWidth={1.9} />}
                                                onClick={connectDrive}
                                            >
                                                Reconnect
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                className="border-utility-red-200 px-[13px] py-2 text-[13px] text-error-primary hover:border-utility-red-300 hover:bg-utility-red-50"
                                                onClick={onDisconnect}
                                                disabled={disconnectMutation.isPending}
                                            >
                                                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                                            </Button>
                                        </>
                                    ) : (
                                        <Button variant="primary" className="px-[13px] py-2 text-[13px]" onClick={connectDrive}>
                                            Connect
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Section>
                    </section>
                </div>
            </AppShell>
        </main>
    );
}

const Section = forwardRef<
    HTMLElement,
    {
        id: string;
        title: string;
        description: string;
        children: ReactNode;
        footer?: ReactNode;
    }
>(function Section({ id, title, description, children, footer }, ref) {
    return (
        <section id={id} ref={ref} className="scroll-mt-8">
            <div className="border-b border-secondary pb-[18px]">
                <div className="text-[17px] font-semibold text-primary">{title}</div>
                <div className="mt-[3px] text-[13px] text-tertiary">{description}</div>
            </div>
            <div>{children}</div>
            {footer ? <div className="flex justify-end gap-2.5 border-t border-secondary pt-[18px]">{footer}</div> : null}
        </section>
    );
});

function Row({
    label,
    hint,
    children,
    bordered = true,
    alignTop = false,
}: {
    label: string;
    hint?: string;
    children: ReactNode;
    bordered?: boolean;
    alignTop?: boolean;
}) {
    return (
        <div
            className={`flex gap-6 py-[18px] ${alignTop ? "items-start" : "items-center"} ${bordered ? "border-b border-secondary" : ""}`}
        >
            <div className="w-[200px] shrink-0">
                <div className="text-sm font-medium text-secondary">{label}</div>
                {hint ? <div className="mt-0.5 text-[13px] text-tertiary">{hint}</div> : null}
            </div>
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

function GoogleMarkLarge() {
    return (
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" className="shrink-0">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1C6.2 6.9 8.9 4.8 12 4.8Z" />
        </svg>
    );
}

function SubnavItem({
    icon,
    label,
    active = false,
    onClick,
}: {
    icon: ReactNode;
    label: string;
    active?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-left text-sm transition ${
                active ? "bg-secondary font-semibold text-brand-secondary" : "font-medium text-secondary hover:bg-secondary hover:text-secondary"
            }`}
        >
            {icon}
            {label}
        </button>
    );
}
