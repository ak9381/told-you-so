import React from "react";

/** White rounded card with a soft shadow — the core surface of the new theme. */
export function Card({
  className = "",
  hover = false,
  children,
}: {
  className?: string;
  hover?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-[#E7E5E0] card-soft ${
        hover ? "card-hover" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Big serif page title with optional right-side controls. */
export function PageTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-[#1A1715]">
        {children}
      </h1>
      {aside ? <div className="flex items-center gap-3">{aside}</div> : null}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#1A1715] mb-5">
      {children}
    </h2>
  );
}

/** Rounded pill, e.g. "60 AI calls left" or a segmented toggle item. */
export function Pill({
  children,
  active = false,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-white text-[#1A1715] shadow-sm" : "text-[#6B6560] hover:text-[#1A1715]"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Small uppercase label chip (DECISION, CONNECTED, a topic key, etc.). */
export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "green" | "dark";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[#F1F0EC] text-[#6B6560]",
    accent: "bg-[#FBE9E7] text-[#C0392B]",
    green: "bg-[#E6F3EC] text-[#1C7A4A]",
    dark: "bg-[#2B2B33] text-white",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`bg-[#1C1C1E] text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-[#333338] disabled:opacity-50 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`bg-white text-[#1A1715] border border-[#E0DED8] rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-[#F1F0EC] disabled:opacity-50 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
