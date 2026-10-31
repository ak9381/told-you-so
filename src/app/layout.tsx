import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Told You So — The Meeting Agent That Argues Back",
  description:
    "Remembers what the team decided, and objects with the exact quote when someone contradicts it later.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${jetbrainsMono.variable} bg-[#F4EFE6] text-[#1C1917] min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
