import { log } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { flags } from "@/lib/flags";
import { requireUser, readJson } from "@/lib/api-guard";

// Returns the projects that belong to the logged-in user (with real UUIDs) so the
// UI can scope meetings correctly. Scoped per-user so the dropdown only shows
// "your" projects. No user → 401 (requireUser); never a fallback to all projects.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const supabase = createServerClient();
    const userId = auth.user.id;

    const query = supabase
      .from("projects")
      .select("id, name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    let projects = data ?? [];
    // #2: the fintech demo project is hidden unless FLAG_FINTECH is on.
    if (!flags.fintech) {
      projects = projects.filter((p) => p.name !== "Fintech recon dashboard");
    }
    return NextResponse.json({ projects });
  } catch (e) {
    log.error("projects fetch error:", e);
    return NextResponse.json({ projects: [] }, { status: 500 });
  }
}

// Create a new project owned by the logged-in user.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const parsed = await readJson(request, 10_000);
    if (parsed.error) return parsed.error;
    const name = parsed.body.name;
    const clean = (typeof name === "string" ? name : "").trim();
    if (!clean) return NextResponse.json({ error: "A project name is required" }, { status: 400 });

    const supabase = createServerClient();
    const userId = auth.user.id;

    const { data, error } = await supabase
      .from("projects")
      .insert({ name: clean.slice(0, 120), user_id: userId })
      .select("id, name")
      .single();
    if (error) throw error;
    return NextResponse.json({ project: data });
  } catch (e) {
    log.error("project create error:", e);
    return NextResponse.json({ error: "Could not create the project" }, { status: 500 });
  }
}
