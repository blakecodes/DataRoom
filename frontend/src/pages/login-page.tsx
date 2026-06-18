import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";

export function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await login(email, password);
            navigate("/app");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-secondary px-6 py-10">
            <div className="mx-auto flex min-h-[640px] max-w-[1080px] overflow-hidden rounded-[14px] border border-secondary bg-primary app-shell-shadow">
                <section className="flex w-full max-w-[520px] flex-col justify-center px-14 py-12">
                    <BrandMark />
                    <h1 className="mt-10 text-[26px] font-semibold tracking-[-0.01em] text-primary">Welcome back</h1>
                    <p className="mt-1.5 text-sm text-tertiary">Sign in to access your secure Data Room.</p>

                    <form className="mt-8 space-y-4" onSubmit={onSubmit}>
                        <LabeledInput
                            label="Email"
                            type="email"
                            name="email"
                            autoComplete="email"
                            placeholder="Enter your email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                        <LabeledInput
                            label="Password"
                            type="password"
                            name="password"
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-secondary">
                            <input
                                type="checkbox"
                                name="remember"
                                defaultChecked
                                className="size-[18px] rounded-[5px] border-primary text-brand-solid accent-brand-solid"
                            />
                            Remember me for 30 days
                        </label>
                        {error ? (
                            <div className="rounded-lg border border-utility-red-200 bg-utility-red-50 px-3.5 py-2.5 text-[13px] font-medium text-utility-red-700">
                                {error}
                            </div>
                        ) : null}
                        <Button fullWidth variant="primary" type="submit" disabled={submitting}>
                            {submitting ? "Signing in..." : "Sign in"}
                        </Button>
                    </form>

                    <p className="mt-7 text-center text-sm text-tertiary">
                        Don't have an account?{" "}
                        <Link to="/signup" className="font-semibold text-brand-secondary transition hover:text-brand-secondary_hover hover:underline">
                            Create one
                        </Link>
                    </p>
                </section>

                <AuthAside
                    title="A secure home for every deal document."
                    items={[
                        "Encrypted at rest & in transit",
                        "Read-only Google Drive access",
                        "Full audit trail on every file",
                    ]}
                />
            </div>
        </main>
    );
}

function BrandMark() {
    return (
        <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-solid text-white">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l8 3v6c0 5-3.4 8.2-8 9.5C7.4 19.2 4 16 4 11V5l8-3Z" />
                </svg>
            </div>
            <div className="text-base font-semibold text-primary">Acme Data Room</div>
        </div>
    );
}

function AuthAside({ title, items }: { title: string; items: string[] }) {
    return (
        <aside className="hidden flex-1 flex-col justify-center bg-[#2D31A6] bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.14),transparent_42%)] px-12 py-14 text-white lg:flex">
            <div className="mb-7 flex size-12 items-center justify-center rounded-xl bg-white/15">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l8 3v6c0 5-3.4 8.2-8 9.5C7.4 19.2 4 16 4 11V5l8-3Z" />
                    <path d="m9 12 2 2 4-4" />
                </svg>
            </div>
            <h2 className="max-w-sm text-2xl font-semibold leading-8 tracking-[-0.01em]">{title}</h2>
            <div className="mt-7 space-y-3.5">
                {items.map((item) => (
                    <div key={item} className="flex items-center gap-3 text-sm text-[#E0E7FF]">
                        <Check size={18} className="text-[#C7D7FE]" />
                        {item}
                    </div>
                ))}
            </div>
        </aside>
    );
}

