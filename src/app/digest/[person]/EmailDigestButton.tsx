"use client";

import { useState } from "react";

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
      <button
        onClick={send}
        disabled={busy}
        className="bg-[#C0392B] text-[#F4EFE6] font-mono text-xs uppercase tracking-wider px-5 py-2.5 hover:bg-[#962D22] disabled:opacity-50"
      >
        Email this digest
      </button>
      {msg && <span className="font-mono text-xs text-[#78716C]">{msg}</span>}
    </div>
  );
}
