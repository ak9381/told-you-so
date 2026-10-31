"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase-ssr";
import { useSearchParams, useRouter } from "next/navigation";

export default function LoginForm() {
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

  const inputClass =
    "w-full rounded-xl border border-[#E0DED8] bg-[#FBFAF8] px-3.5 py-2.5 text-sm text-[#1A1715] focus:outline-none focus:border-[#B9B6AE] focus:ring-2 focus:ring-[#ECEAE5]";

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-serif font-black tracking-tight text-[#1A1715] mb-1">
          Told You So
        </h1>
        <p className="text-sm font-serif italic text-[#C0392B]">
          the meeting agent that argues back.
        </p>
      </div>

      {notAllowed && (
        <div className="mb-5 rounded-xl border border-[#F0C9C3] bg-[#FBE9E7] p-4 text-center">
          <p className="text-sm text-[#C0392B] font-semibold">Access denied</p>
          <p className="text-sm text-[#6B6560] mt-1">This demo is limited to 5 invited users.</p>
        </div>
      )}

      <form
        onSubmit={handleLogin}
        className="bg-white rounded-2xl border border-[#E7E5E0] card-soft p-7"
      >
        <p className="text-xs uppercase tracking-wider text-[#9B9690] border-b border-[#EFEEEA] pb-3 mb-5">
          Sign in
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-[#F0C9C3] bg-[#FBE9E7] px-3 py-2 text-sm text-[#C0392B]">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs text-[#6B6560] mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs text-[#6B6560] mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full bg-[#1C1C1E] text-white rounded-xl py-3 text-sm font-medium hover:bg-[#333338] disabled:opacity-50 transition-colors"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>

        <p className="mt-4 text-center text-xs text-[#9B9690]">
          No sign-ups. Accounts created by invitation only.
        </p>
        <p className="mt-2 text-center text-xs">
          <a href="/welcome" className="text-[#C0392B] hover:underline">
            What is Told You So? →
          </a>
        </p>
      </form>
    </div>
  );
}
