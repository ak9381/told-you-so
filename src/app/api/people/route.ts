import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireUser, readJson, jsonError } from "@/lib/api-guard";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Team members (reused across projects). Used to assign task owners and route
// reminder emails.
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const supabase = createServerClient();
  const { data } = await supabase
    .from("people")
    .select("id, name, email")
    .order("created_at", { ascending: true });
  return NextResponse.json({ people: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const parsed = await readJson(request, 10_000);
  if (parsed.error) return parsed.error;
  const { name, email } = parsed.body as Record<string, unknown>;
  const clean = (typeof name === "string" ? name : "").trim().slice(0, 80);
  if (!clean) return NextResponse.json({ error: "A name is required" }, { status: 400 });
  const supabase = createServerClient();

  // Avoid duplicates by name — update the email if the person already exists.
  const { data: existing } = await supabase
    .from("people")
    .select("id")
    .eq("name", clean)
    .maybeSingle();
  const cleanEmail = (typeof email === "string" ? email : "").trim().slice(0, 254) || null;
  if (cleanEmail && !EMAIL_RE.test(cleanEmail)) return jsonError("That email address doesn't look right.", 400);

  if (existing) {
    const { data, error } = await supabase
      .from("people")
      .update({ email: cleanEmail })
      .eq("id", existing.id)
      .select("id, name, email")
      .single();
    if (error) return jsonError("Could not update this person.", 500);
    return NextResponse.json({ person: data });
  }

  const { data, error } = await supabase
    .from("people")
    .insert({ name: clean.slice(0, 80), email: cleanEmail })
    .select("id, name, email")
    .single();
  if (error) {
    console.error("people insert failed:", error.message);
    return jsonError("Could not add this person.", 500);
  }
  return NextResponse.json({ person: data });
}
