import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";

function passwordStrength(password: string): number {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    if (password.length >= 12) score += 1;
    return score;
}

export function SignupPage() {
    const navigate = useNavigate();
    const { signup } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const strength = useMemo(() => passwordStrength(password), [password]);

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        setSubmitting(true);
        try {
            await signup(email, password, name);
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
                <section className="flex w-full max-w-[520px] flex-col justify-center px-14 py-11">
                    <BrandMark />
                    <h1 className="mt-8 text-[26px] font-semibold tracking-[-0.01em] text-primary">Create your account</h1>
                    <p className="mt-1.5 text-sm text-tertiary">Set up your account, then connect Google Drive.</p>

                    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                        <LabeledInput
                            label="Full name"
                            type="text"
                            name="name"
                            autoComplete="name"
                            placeholder="Enter your full name"
                            required
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                        <LabeledInput
                            label="Work email"
                            type="email"
                            name="email"
                            autoComplete="email"
                            placeholder="Enter your work email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                        <div>
                            <LabeledInput
                                label="Password"
                                type="password"
                                name="password"
                                autoComplete="new-password"
                                placeholder="Create a password"
                                required
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                            <div className="mt-2.5 flex gap-1.5">
                                {[0, 1, 2, 3].map((i) => (
                                    <StrengthBar key={i} active={i < strength} />
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-tertiary">At least 8 characters; add a number & symbol for a stronger password.</p>
                        </div>
                        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-5 text-secondary">
                            <input
                                type="checkbox"
                                name="terms"
                                required
                                className="mt-0.5 size-[18px] rounded-[5px] border-primary text-brand-secondary accent-brand-solid"
                            />
                            <span>
                                I agree to the <span className="cursor-pointer font-semibold text-brand-secondary transition hover:text-brand-secondary hover:underline">Terms</span> and{" "}
                                <span className="cursor-pointer font-semibold text-brand-secondary transition hover:text-brand-secondary hover:underline">Privacy Policy</span>
                            </span>
                        </label>
                        {error ? (
                            <div className="rounded-lg border border-utility-red-200 bg-utility-red-50 px-3.5 py-2.5 text-[13px] font-medium text-utility-red-700">
                                {error}
                            </div>
                        ) : null}
                        <Button fullWidth variant="primary" type="submit" disabled={submitting}>
                            {submitting ? "Creating account..." : "Create account"}
                        </Button>
                    </form>

                    <p className="mt-5 text-center text-sm text-tertiary">
                        Already have an account?{" "}
                        <Link to="/login" className="font-semibold text-brand-secondary transition hover:text-brand-secondary hover:underline">
                            Sign in
                        </Link>
                    </p>
                </section>

                <aside className="hidden flex-1 flex-col justify-center bg-[#2D31A6] bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.14),transparent_42%)] px-12 py-14 text-white lg:flex">
                    <div className="mb-7 text-[13px] font-semibold tracking-[0.06em] text-[#C7D7FE]">GET STARTED IN TWO STEPS</div>
                    <div className="space-y-0">
                        <Step number="1" active title="Create your account" description="Set a name, email and password to secure your Data Room." />
                        <Step number="2" title="Connect Google Drive" description="Authorize read-only access and import files in one click." />
                    </div>
                </aside>
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

function StrengthBar({ active = false }: { active?: boolean }) {
    return <div className={`h-1.5 flex-1 rounded ${active ? "bg-utility-green-500" : "bg-secondary"}`} />;
}

function Step({
    number,
    title,
    description,
    active = false,
}: {
    number: string;
    title: string;
    description: string;
    active?: boolean;
}) {
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
                <div
                    className={`flex size-9 items-center justify-center rounded-full text-[15px] font-bold ${
                        active ? "bg-primary text-[#2D31A6]" : "border border-white/40 bg-primary/15 text-white"
                    }`}
                >
                    {number}
                </div>
                {number === "1" ? <div className="my-1.5 h-12 w-0.5 bg-primary/25" /> : null}
            </div>
            <div className={number === "1" ? "pb-8" : ""}>
                <div className="text-base font-semibold">{title}</div>
                <div className="mt-1 text-sm leading-6 text-[#E0E7FF]">{description}</div>
            </div>
        </div>
    );
}
