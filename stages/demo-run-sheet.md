# Recording run-sheet: "Told You So" demo (~2:30)

Adapted from `stage-9d-video-plan.md` (§6 script, §3 setup, §5 WhatsApp text) to match the CURRENT deployed app. Live: https://told-you-so.told-you-so.workers.dev

---

## 0. Pre-record checklist (one line)
Chrome full screen (zoom ~115%) · logged in on the deployed URL · **Fintech recon dashboard** project selected on the Debrief home · the fintech WhatsApp text copied to clipboard ready to paste · Wispr Flow running (Fn to dictate) · notifications off (Focus) · Loom = **Screen only + mic**.

Record in 3 short takes and splice: (1) hook + Wispr, (2) history + WhatsApp + objections, (3) Keep old → Confirm → Notion/Outbox → eval + close.

---

## 1. Run-sheet (Time | On screen | You say)

| Time | On screen (exact clicks / path) | You say (voiceover) |
|---|---|---|
| 0:00–0:15 | Black title card: "Oct 24: we picked Postgres." then flash the line "Why are we on Postgres? Let's switch to Mongo." | "I'm a senior engineer. Every time someone new joins, we re-argue decisions we already settled. Last week we picked Postgres for a payments ledger. Today a new architect wants Mongo — and nobody can find where we decided it." |
| 0:15–0:27 | **Debrief** home. Left sidebar visible: logo **TOLD YOU SO**, Projects list, user + Log out at the bottom. Serif project title + the **"60 AI calls / day"** pill. | "So I built Told You So. It remembers what your team decided — across calls, WhatsApp and voice notes — and it objects, with the receipt, when someone contradicts it." |
| 0:27–0:55 | On the **Bento** home (2×2: Dictate with Wispr · Upload Files · Connect Calendar "Coming soon" · Live Meeting), cursor on **Dictate with Wispr**. Hold **Fn**, Wispr Flow bar visible, dictate the messy line (§3). Processing → the **split view** appears: light **"What you said"** card (self-corrections struck through) beside the dark **"What we understood"** card (actions + decisions with a topic chip). | "The headline input is just me talking, through Wispr Flow — I ramble the way I really do after a call. On the left, my self-corrections are struck through. On the right, what it understood: I own the report, not Meera; Thursday, not Friday; and it dropped the coffee machine. Nothing's saved until I confirm." |
| 0:55–1:12 | Scroll the Fintech recon dashboard history: the three prior decisions — Postgres (Oct 24, ACID), webhooks over polling (Oct 27), Clerk for auth (Oct 29), each with quote + timestamp. | "This project already has three meetings of memory: Postgres for the ledger on the 24th, webhooks over polling on the 27th, Clerk for auth on the 29th. Each one keeps the exact quote and the time." |
| 1:12–1:42 | **Paste transcript** tab → paste Ankit's WhatsApp text (§2), chat labelled "Northwind recon (DEMO DATA)" → process. Two polite **"Heads up"** cards appear — header **Heads up**, **"100% sure"** badge, "On Oct 24 you decided ledger database, and this now conflicts — here's the receipt:" with Then/Now quotes. The Clerk line shows as a refinement, **not** flagged. | "Now Ankit joins — Ankit is demo data, I built this solo. In WhatsApp he says: switch the ledger to Mongo, and just poll. Two Heads-up cards: on the 24th you decided Postgres, 'we can't risk eventual consistency'; on the 27th, webhooks, 'polling will kill us at scale.' And it does NOT flag his Clerk line — Google-login-only is a refinement, not a contradiction." |
| 1:42–2:02 | On each Heads up card click **Keep old** (verdict buttons: Overrule / Pivot / Keep old / Flag). Then **Confirm**. It files to **Notion** ("filed in Notion" on /ledger) and a reminder lands in **/outbox** (SENT status). | "I keep both old decisions — one click each — and confirm. The task files to Notion, and the reminder lands in the outbox. Reminder emails go to my own Resend inbox, by the way. I don't argue in the meeting; I show the quote and we move on." |
| 2:02–2:22 | Sidebar → **Eval** (/eval): 18 cases, **100% precision / 100% recall**. Hold on the numbers. Then say the architecture line over the eval page (or a one-line diagram card). | "Under the hood: Next.js on Cloudflare Workers, Supabase Postgres, Gemini 3.5 Flash Lite. I picked Flash Lite because it's fast and cheap enough to check a live call every few seconds and it does structured tool calls — it searches same-topic decisions first, then a separate strict step checks contradiction versus refinement. Eighteen labelled cases, including messy speech: a hundred percent precision and recall." |
| 2:22–2:30 | Live URL on screen: **told-you-so.told-you-so.workers.dev** | "It's live at told-you-so dot workers dot dev. Talking is how we think — so that's how it should remember. Thank you." |

Note on /live: the Live Meeting page uses **Chrome's Web Speech API, not Wispr** — if you demo it, say so. It also has **Play Demo Clip** and a box to **launch from a Google Meet / Zoom link**.

---

## 2. Paste this — Ankit's WhatsApp (DEMO DATA), chat "Northwind recon"
```
[31/10/26, 11:05 am] Ankit (Architect, demo): Hi all. Quick thought, why are we on Postgres? Mongo is faster for dashboards, let's switch the ledger to Mongo.
[31/10/26, 11:06 am] Ankit (Architect, demo): Also let's just do polling every 30 sec for settlement status, webhooks are overkill for MVP.
[31/10/26, 11:12 am] Ankit (Architect, demo): Clerk is fine, let's keep Clerk but only Google login for now.
```
Expected: Heads up on 11:05 (vs Oct 24 Postgres/ACID) and 11:06 (vs Oct 27 webhooks). 11:12 = refinement, NOT flagged.

## 3. Dictate this — messy Wispr debrief (hold Fn)
> "Okay so after the client call, um, Meera owns the — no wait, I own the reconciliation report, by Friday-ish, actually Thursday. And the coffee machine is broken again."

Expected: "Meera owns" and "Friday" struck through; action = Akash owns reconciliation report, due Thursday; coffee machine dropped.

---

## 4. If something fails
If a live call to Gemini stalls or hits the cap: go to **/live → Play Demo Clip** (the fintech meeting-4 clip runs the same check path), or just lean on **/eval** and the already-rendered history — the **cached/eval pages never hit Gemini**, so they always load. Redo only the broken take.

---

## 5. Live 2-laptop Google Meet test (optional "real call" segment)

**How the app hears:** `/live` uses Chrome's **Web Speech API** on the **system microphone** only — it does NOT tap Meet's audio. It transcribes whatever the mic physically picks up in the room.

**Laptop A — runs the app + is the presenter**
- OS microphone **ON** (menu-bar/hardware mic unmuted). This is the only hard requirement — if the OS mic is off, the app goes deaf.
- **Speakers ON, no headphones** — that's how A's mic catches the other person's voice (coming out of the speaker) plus your own voice directly.
- Muting yourself **inside Google Meet** is fine and does NOT stop the app — Meet-mute only stops Meet from transmitting your voice; the app reads the OS mic independently. (So there is nothing to "support" in the app; don't bother muting.)
- Open `/live`, click **Start listening**, grant mic permission once.

**Laptop B — the second participant (your other account)**
- Join the same Meet. Speak the three fintech lines clearly, one at a time, pausing ~3s between each so each line gets its own check:
  1. "Why are we on Postgres? Mongo is faster, let's switch the ledger to Mongo."  → expect a **Heads up** vs Oct 24 Postgres/ACID.
  2. "And let's just poll every 30 seconds for settlement status, webhooks are overkill."  → expect a **Heads up** vs Oct 27 webhooks.
  3. "Let's keep Clerk, but Google login only for now."  → **no flag** (refinement).

**Echo warning:** if both laptops are in the **same room** with speakers on, you'll get feedback. Cleanest = **two separate rooms** (A hears B only through Meet → speaker → mic). If you must share a room, lean on **Play Demo Clip** instead of the open mics.

**Safety net:** if speech recognition drops words or the room is noisy, hit **Play Demo Clip** on `/live` — it runs the identical check path and always produces the two objections.
