import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// Team members (reused across projects). Used to assign task owners and route
// reminder emails.
export async function GET() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("people")
    .select("id, name, email")
    .order("created_at", { ascending: true });
  return NextResponse.json({ people: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { name, email } = await request.json();
  const clean = (name || "").toString().trim();
  if (!clean) return NextResponse.json({ error: "A name is required" }, { status: 400 });
  const supabase = createServerClient();

  // Avoid duplicates by name — update the email if the person already exists.
  const { data: existing } = await supabase
    .from("people")
    .select("id")
    .eq("name", clean)
    .maybeSingle();
  const cleanEmail = (email || "").toString().trim() || null;

  if (existing) {
    const { data } = await supabase
      .from("people")
      .update({ email: cleanEmail })
      .eq("id", existing.id)
      .select("id, name, email")
      .single();
    return NextResponse.json({ person: data });
  }

  const { data, error } = await supabase
    .from("people")
    .insert({ name: clean.slice(0, 80), email: cleanEmail })
    .select("id, name, email")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ person: data });
}
