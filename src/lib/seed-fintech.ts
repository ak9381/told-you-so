import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Seed the "Fintech recon dashboard" demo project (Northwind Payments, DEMO
// DATA) without touching the existing projects. Safe to run twice. Owned by the
// Akash user (the app reads via the service role, so it is visible to all
// invited users regardless of RLS owner).

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const p = path.resolve(process.cwd(), ".dev.vars");
    if (fs.existsSync(p)) {
      fs.readFileSync(p, "utf8")
        .split("\n")
        .forEach((line) => {
          const t = line.trim();
          if (t && !t.startsWith("#") && t.includes("=")) {
            const i = t.indexOf("=");
            const k = t.slice(0, i).trim();
            if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
          }
        });
    }
  } catch {}
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const OWNER_ID = "f7280404-dd83-46f6-8959-aaaa0e86ab4e"; // Akash

async function ensurePerson(name: string, email: string) {
  const { data } = await supabase.from("people").select("id").eq("email", email).maybeSingle();
  if (!data) await supabase.from("people").insert({ name, email });
}

async function seed() {
  console.log("🏦 Seeding Fintech recon dashboard…");
  await ensurePerson("Ankit", "akash+ankit@gmail.com");
  await ensurePerson("Meera", "akash+meera@gmail.com");

  // Project
  let projId: string;
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("name", "Fintech recon dashboard")
    .maybeSingle();
  if (existing) {
    projId = existing.id;
  } else {
    const { data, error } = await supabase
      .from("projects")
      .insert({ name: "Fintech recon dashboard", tracker: "notion", user_id: OWNER_ID })
      .select("id")
      .single();
    if (error) throw error;
    projId = data.id;
  }

  const meetings: {
    seq: number;
    title: string;
    date: string;
    source_type: string;
    decisions: { topic: string; exact_quote: string; speaker: string; said_at: string }[];
    actions?: { title: string; owner: string; due_date: string; status: string; source_quote: string }[];
  }[] = [
    {
      seq: 1,
      title: "Fintech recon #1 · Architecture kickoff · 24 Oct 2026",
      date: "2026-10-24T05:30:00Z",
      source_type: "debrief",
      decisions: [
        {
          topic: "ledger_database",
          exact_quote:
            "We're going with Postgres for the ledger, not Mongo. Money movement needs ACID transactions, we can't risk eventual consistency here.",
          speaker: "Akash",
          said_at: "00:42",
        },
      ],
    },
    {
      seq: 2,
      title: "Fintech recon #2 · Real-time sync · 27 Oct 2026",
      date: "2026-10-27T10:30:00Z",
      source_type: "meet_transcript",
      decisions: [
        {
          topic: "settlement_updates_sync",
          exact_quote: "No, we'll use webhooks for settlement updates. Polling will kill us at scale.",
          speaker: "Akash",
          said_at: "03:25",
        },
      ],
      actions: [
        {
          title: "Write webhook retry spec",
          owner: "Akash",
          due_date: "2026-10-30T12:00:00Z",
          status: "done",
          source_quote: "we'll use webhooks for settlement updates",
        },
      ],
    },
    {
      seq: 3,
      title: "Fintech recon #3 · Auth · 29 Oct 2026",
      date: "2026-10-29T06:30:00Z",
      source_type: "debrief",
      decisions: [
        {
          topic: "auth_provider",
          exact_quote: "Let's go with Clerk for auth to save time. Custom JWT is a rabbit hole, we need to ship.",
          speaker: "Akash",
          said_at: "01:05",
        },
      ],
    },
  ];

  for (const m of meetings) {
    let meetingId: string;
    const { data: em } = await supabase
      .from("meetings")
      .select("id")
      .eq("project_id", projId)
      .eq("seq", m.seq)
      .maybeSingle();
    if (em) {
      meetingId = em.id;
    } else {
      const { data, error } = await supabase
        .from("meetings")
        .insert({
          project_id: projId,
          user_id: OWNER_ID,
          seq: m.seq,
          title: m.title,
          source_type: m.source_type,
          created_at: m.date,
        })
        .select("id")
        .single();
      if (error) throw error;
      meetingId = data.id;
      console.log(`  created ${m.title}`);
    }

    for (const d of m.decisions) {
      const { data: ed } = await supabase
        .from("decisions")
        .select("id")
        .eq("project_id", projId)
        .eq("exact_quote", d.exact_quote)
        .maybeSingle();
      if (!ed) {
        await supabase.from("decisions").insert({
          project_id: projId,
          meeting_id: meetingId,
          meeting_seq: m.seq,
          topic: d.topic,
          exact_quote: d.exact_quote,
          speaker: d.speaker,
          said_at: d.said_at,
          status: "active",
          created_at: m.date,
        });
        console.log(`    decision [${d.topic}]`);
      }
    }

    for (const a of m.actions ?? []) {
      const { data: ea } = await supabase
        .from("actions")
        .select("id")
        .eq("project_id", projId)
        .eq("title", a.title)
        .maybeSingle();
      if (!ea) {
        await supabase.from("actions").insert({
          project_id: projId,
          meeting_id: meetingId,
          title: a.title,
          owner: a.owner,
          due_date: a.due_date,
          status: a.status,
          source_quote: a.source_quote,
          reminder_lead_min: 1440,
        });
      }
    }
  }

  console.log("✅ Fintech seed complete.");
}

seed().catch((e) => {
  console.error("Fintech seed error:", e);
  process.exit(1);
});
