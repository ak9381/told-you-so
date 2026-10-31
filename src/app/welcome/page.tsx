import type { Metadata } from "next";
import WelcomeClient from "./WelcomeClient";

export const metadata: Metadata = {
  title: "Told You So — the meeting agent that argues back",
  description:
    "Told You So remembers what your team decided — across calls, Google Meet, Zoom and WhatsApp — and objects, with the exact quote, when someone contradicts it. Decision logs failed because writing them is a chore. This one writes itself from your voice and chats.",
  keywords: [
    "meeting agent",
    "decision log",
    "conflict detection",
    "meeting notes AI",
    "WhatsApp decisions",
    "architecture decision records",
    "Wispr Flow",
  ],
  openGraph: {
    title: "Told You So — the meeting agent that argues back",
    description:
      "Remembers what your team decided across calls and WhatsApp, and objects — with receipts — when someone drifts.",
    type: "website",
  },
};

export default function WelcomePage() {
  return <WelcomeClient />;
}
