"use client";

import { useState, Suspense } from "react";
import { createBrowserSupabase } from "@/lib/supabase-ssr";
import { useSearchParams, useRouter } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const notAllowed = searchParams.get("error") === "not_allowed";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserSupabase();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      if (!data.session) {
        setError("Login failed. Please try again.");
        setLoading(false);
        return;
      }

      // The SSR client sets the auth cookies; the middleware refreshes the
      // session on every request and enforces the 5-user allowlist.
      router.push("/");
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Masthead */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-serif font-black tracking-tight text-[#1C1917] mb-1">
          Told You So
        </h1>
        <p className="text-sm font-serif italic text-[#C0392B]">
          the meeting agent that argues back.
        </p>
      </div>

      {/* Not allowed banner */}
      {notAllowed && (
        <div className="mb-6 border-2 border-[#C0392B] bg-[#FADBD8] p-4 text-center">
          <p className="font-mono text-sm text-[#962D22] font-semibold uppercase tracking-wide">
            Access Denied
          </p>
          <p className="font-serif text-[#1C1917] mt-1">
            This demo is limited to 5 invited users.
          </p>
        </div>
      )}

      {/* Login form */}
      <form
        onSubmit={handleLogin}
        className="border border-[#DDD3C1] bg-[#FAF7F2] p-8 shadow-sm"
      >
        <div className="border-b border-[#DDD3C1] pb-3 mb-6">
          <span className="font-mono text-xs uppercase tracking-wider text-[#78716C]">
            Authorized Personnel Only
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 border border-[#C0392B] bg-[#FADBD8] font-mono text-sm text-[#962D22]">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block font-mono text-xs uppercase tracking-wider text-[#44403C] mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-[#DDD3C1] bg-[#F4EFE6] px-3 py-2 font-mono text-sm text-[#1C1917] focus:outline-none focus:border-[#C0392B] focus:ring-1 focus:ring-[#C0392B]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block font-mono text-xs uppercase tracking-wider text-[#44403C] mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[#DDD3C1] bg-[#F4EFE6] px-3 py-2 font-mono text-sm text-[#1C1917] focus:outline-none focus:border-[#C0392B] focus:ring-1 focus:ring-[#C0392B]"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full bg-[#1C1917] text-[#F4EFE6] font-mono text-sm uppercase tracking-wider py-3 hover:bg-[#44403C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Entering…" : "Enter the Courtroom"}
        </button>

        <p className="mt-4 text-center font-mono text-xs text-[#78716C]">
          No sign-ups. Accounts created by invitation only.
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F4EFE6] px-4">
      <Suspense fallback={<div className="font-mono text-xs text-[#78716C]">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
