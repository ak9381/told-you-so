import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Log in — Told You So",
  description: "Sign in to Told You So — the meeting agent that argues back.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7F6F3] px-4">
      <Suspense fallback={<div className="text-xs text-[#9B9690]">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
