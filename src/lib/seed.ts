import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .dev.vars if process.env is missing values
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const devVarsPath = path.resolve(process.cwd(), ".dev.vars");
    if (fs.existsSync(devVarsPath)) {
      const content = fs.readFileSync(devVarsPath, "utf8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const eq = trimmed.indexOf("=");
          const k = trimmed.slice(0, eq).trim();
          const v = trimmed.slice(eq + 1).trim();
          if (!process.env[k]) process.env[k] = v;
        }
      });
    }
  } catch (e) {
    console.warn("Could not read .dev.vars:", e);
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const KICKOFF_DECISIONS = [
  {
    topic: "team-size",
    exact_quote: "team size is maximum 2 people",
    speaker: "Sakshi",
    said_at: "00:42",
    summary: "Team size is strictly capped at maximum 2 members.",
  },
  {
    topic: "deadline",
    exact_quote: "Submission deadline is tonight, 11:59 PM IST strictly",
    speaker: "Sakshi",
    said_at: "01:45",
    summary: "Submission deadline is 31 Oct 2026 at 11:59 PM IST strictly.",
  },
  {
    topic: "deadline",
    exact_quote: "LinkedIn posts must be published by 1 November 11:59 PM IST",
    speaker: "Sakshi",
    said_at: "02:30",
    summary: "LinkedIn posts and video links must be submitted by 1 November 11:59 PM IST.",
  },
  {
    topic: "scope",
    exact_quote: "No old projects. Everything must be built brand new today",
    speaker: "Sakshi",
    said_at: "01:15",
    summary: "No prior code or old projects allowed; must be built brand new during the hackathon.",
  },
  {
    topic: "scope",
    exact_quote: "you must pick one of the five problem statements",
    speaker: "Sakshi",
    said_at: "03:10",
    summary: "Project must solve one of the five official problem statements.",
  },
  {
    topic: "submission",
    exact_quote: "The project must be deployed with test credentials provided in the form",
    speaker: "Sakshi",
    said_at: "02:10",
    summary: "Working deployed URL and working test credentials are mandatory for submission.",
  },
  {
    topic: "submission",
    exact_quote: "demo video must be 2 to 3 minutes with voiceover",
    speaker: "Sakshi",
    said_at: "03:45",
    summary: "Demo video length must be between 2 and 3 minutes with audible voiceover.",
  },
  {
    topic: "tooling",
    exact_quote: "Wispr Flow use is mandatory and carries 20 percent of the score",
    speaker: "Sakshi",
    said_at: "04:15",
    summary: "Using Wispr Flow for prompt generation/speech input is mandatory and weighted at 20%.",
  },
];

async function seed() {
  console.log("🌱 Starting idempotent seed...");

  // 1. Seed People (Harsh, The Client, Akash)
  const people = [
    { name: "Akash", email: "akashkraju218@gmail.com" },
    { name: "Harsh", email: "akash+harsh@gmail.com" },
    { name: "Client", email: "akash+client@gmail.com" },
    { name: "Priya", email: "akash+priya@gmail.com" },
    { name: "Neerja", email: "akash+neerja@gmail.com" },
  ];

  for (const p of people) {
    const { data: existing } = await supabase
      .from("people")
      .select("id")
      .eq("email", p.email)
      .maybeSingle();

    if (!existing) {
      await supabase.from("people").insert(p);
      console.log(`  Created person: ${p.name} (${p.email})`);
    } else {
      console.log(`  Person exists: ${p.name}`);
    }
  }

  // 2. Project 1: Hackathon submission
  let hackathonProjId: string;
  const { data: existingHack } = await supabase
    .from("projects")
    .select("id")
    .eq("name", "Hackathon submission")
    .maybeSingle();

  if (!existingHack) {
    const { data: newProj, error } = await supabase
      .from("projects")
      .insert({ name: "Hackathon submission", tracker: "notion" })
      .select()
      .single();
    if (error) throw error;
    hackathonProjId = newProj.id;
    console.log("  Created project: Hackathon submission");
  } else {
    hackathonProjId = existingHack.id;
    console.log("  Project exists: Hackathon submission");
  }

  // Meeting 1: Hackathon submission #1
  let meeting1Id: string;
  const { data: existingM1 } = await supabase
    .from("meetings")
    .select("id")
    .eq("project_id", hackathonProjId)
    .eq("seq", 1)
    .maybeSingle();

  if (!existingM1) {
    const { data: newM1, error } = await supabase
      .from("meetings")
      .insert({
        project_id: hackathonProjId,
        seq: 1,
        title: "Hackathon submission #1",
        source_type: "transcript",
        raw_text: "Kickoff Call Transcript with Sakshi",
      })
      .select()
      .single();
    if (error) throw error;
    meeting1Id = newM1.id;
    console.log("  Created Meeting 1 for Hackathon submission");
  } else {
    meeting1Id = existingM1.id;
    console.log("  Meeting 1 exists for Hackathon submission");
  }

  // Pre-load decisions for Meeting 1
  for (const dec of KICKOFF_DECISIONS) {
    const { data: existingDec } = await supabase
      .from("decisions")
      .select("id")
      .eq("project_id", hackathonProjId)
      .eq("exact_quote", dec.exact_quote)
      .maybeSingle();

    if (!existingDec) {
      await supabase.from("decisions").insert({
        project_id: hackathonProjId,
        meeting_id: meeting1Id,
        meeting_seq: 1,
        topic: dec.topic,
        exact_quote: dec.exact_quote,
        speaker: dec.speaker,
        said_at: dec.said_at,
        status: "active",
      });
      console.log(`    Seeded kickoff memory: [${dec.topic}] ${dec.exact_quote}`);
    }
  }

  // 3. Project 2: Client website
  let clientProjId: string;
  const { data: existingClient } = await supabase
    .from("projects")
    .select("id")
    .eq("name", "Client website")
    .maybeSingle();

  if (!existingClient) {
    const { data: newProj, error } = await supabase
      .from("projects")
      .insert({ name: "Client website", tracker: "notion" })
      .select()
      .single();
    if (error) throw error;
    clientProjId = newProj.id;
    console.log("  Created project: Client website");
  } else {
    clientProjId = existingClient.id;
    console.log("  Project exists: Client website");
  }

  // Client website meetings: 1, 2 from last week, 3 today
  const clientMeetings = [
    { seq: 1, title: "Client website #1 · Discovery" },
    { seq: 2, title: "Client website #2 · Design Review" },
    { seq: 3, title: "Client website #3" },
  ];

  for (const cm of clientMeetings) {
    let cmId: string;
    const { data: existingCm } = await supabase
      .from("meetings")
      .select("id")
      .eq("project_id", clientProjId)
      .eq("seq", cm.seq)
      .maybeSingle();

    if (!existingCm) {
      const { data: newCm, error } = await supabase
        .from("meetings")
        .insert({
          project_id: clientProjId,
          seq: cm.seq,
          title: cm.title,
          source_type: "transcript",
        })
        .select()
        .single();
      if (error) throw error;
      cmId = newCm.id;
      console.log(`  Created Client Meeting #${cm.seq}`);
    } else {
      cmId = existingCm.id;
      console.log(`  Client Meeting #${cm.seq} exists`);
    }

    // On Meeting 3: client says promo video can be 5 minutes
    if (cm.seq === 3) {
      const clientQuote = "the video can be five minutes";
      const { data: existingClientDec } = await supabase
        .from("decisions")
        .select("id")
        .eq("project_id", clientProjId)
        .eq("exact_quote", clientQuote)
        .maybeSingle();

      if (!existingClientDec) {
        await supabase.from("decisions").insert({
          project_id: clientProjId,
          meeting_id: cmId,
          meeting_seq: 3,
          topic: "submission",
          exact_quote: clientQuote,
          speaker: "Client",
          said_at: "10:15",
          status: "active",
        });
        console.log(`    Seeded client website decision: "${clientQuote}"`);
      }
    }
  }

  console.log("✅ Seed completed successfully without duplicates!");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});

