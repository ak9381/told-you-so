"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui";

export default function EmailDigestButton({ person }: { person: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setMsg("Sending…");
    try {
      const r = await fetch("/api/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "digest-one", person }),
      });
      const d = await r.json();
      setMsg(d.ok ? "Digest emailed — check the Outbox." : `Failed: ${d.error || "send error"}`);
    } catch {
      setMsg("Failed to reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-sm text-[#9B9690]">{msg}</span>}
      <PrimaryButton onClick={send} disabled={busy}>
        Email this digest
      </PrimaryButton>
    </div>
  );
}
