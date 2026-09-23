"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Compass, Loader2, Lock, Mail, User } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { CoverArt } from "@/components/covers";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@wayfare.app");
  const [password, setPassword] = useState("wanderlust");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden lg:block">
        <CoverArt theme="sakura" emoji="🧭" size="lg" className="absolute inset-0 h-full w-full rounded-none" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <Compass size={18} />
            </span>
            <span className="text-lg font-semibold tracking-tight">Wayfare</span>
          </Link>
          <div className="max-w-md">
            <h1 className="font-display text-[44px] leading-[1.1] tracking-tight">
              Your whole trip,<br />
              <em>one beautiful system.</em>
            </h1>
            <p className="mt-4 text-white/75 leading-relaxed">
              Itinerary, budget, maps, reservations and an AI concierge that actually does things —
              from “build my trip” to “move dinner to 8 PM”.
            </p>
            <div className="mt-8 flex gap-6 text-sm text-white/60">
              <span>🗺️ Geographic planning</span>
              <span>💰 Live budgets</span>
              <span>🤖 Tool-using AI</span>
            </div>
          </div>
          <p className="text-xs text-white/40">Wayfare AI Travel OS · Demo build</p>
        </div>
      </div>

      {/* form panel */}
      <div className="flex items-center justify-center bg-bg px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-accent to-sky text-white shadow-md">
              <Compass size={22} />
            </span>
            <h1 className="mt-4 font-display text-3xl">Wayfare</h1>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">
            {mode === "login"
              ? "Sign in to your travel operating system."
              : "Set up takes about ten seconds."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <Field label="Name">
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Traveler"
                    className="pl-9"
                    autoComplete="name"
                  />
                </div>
              </Field>
            )}
            <Field label="Email">
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
            </Field>
            <Field label="Password" hint={mode === "register" ? "At least 8 characters" : undefined}>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
            </Field>

            {error && (
              <p role="alert" className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-[13px] text-danger">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-[13px] text-ink-3">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button onClick={() => setMode("register")} className="font-medium text-accent hover:underline">
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have one?{" "}
                <button onClick={() => setMode("login")} className="font-medium text-accent hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>

          <div className="mt-6 rounded-xl border border-line bg-surface p-3.5 text-[12.5px] text-ink-2">
            <span className="font-semibold text-ink">Demo account</span> — prefilled for you:
            <br />
            <code className="mt-0.5 block font-mono text-accent">demo@wayfare.app · wanderlust</code>
          </div>
        </div>
      </div>
    </div>
  );
}
