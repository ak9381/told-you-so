"use client";

/**
 * Friendly banner shown when the daily Gemini usage limit is hit.
 */
export default function LimitBanner({
  reason,
}: {
  reason: "daily_limit" | "live_check_cooldown";
}) {
  const message =
    reason === "daily_limit"
      ? "Daily AI limit reached — showing cached results."
      : "Please wait a few seconds before the next live check.";

  return (
    <div className="border-2 border-[#C0392B] bg-[#FADBD8] px-4 py-3 text-center mb-4">
      <p className="font-mono text-sm text-[#962D22] font-semibold uppercase tracking-wide">
        ⚠ {message}
      </p>
    </div>
  );
}

