/**
 * Design Tokens for Told You So
 * Courtroom ledger / old newspaper aesthetic.
 * Strict palette: Warm paper, stamp red, and near-black ink.
 */
export const tokens = {
  colors: {
    paper: "#F4EFE6",
    paperLight: "#FAF7F2",
    paperDark: "#E8E1D5",
    paperBorder: "#DDD3C1",
    ink: "#1C1917",
    inkMuted: "#44403C",
    inkFaint: "#78716C",
    stampRed: "#C0392B",
    stampRedFaint: "#FADBD8",
    stampRedDark: "#962D22",
  },
  fonts: {
    heading: "var(--font-fraunces), serif",
    mono: "var(--font-jetbrains-mono), monospace",
  },
} as const;

export type DesignTokens = typeof tokens;

