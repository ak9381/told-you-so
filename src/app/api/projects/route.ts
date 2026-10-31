import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getRequestUser } from "@/lib/supabase-ssr";
import { flags } from "@/lib/flags";

// Returns the projects that belong to the logged-in user (with real UUIDs) so the
// UI can scope meetings correctly. Scoped per-user so the dropdown only shows
// "your" projects; falls back to all if the user can't be resolved (never break
// the sidebar).
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const userId = (await getRequestUser(request))?.id ?? null;

    let query = supabase.from("projects").select("id, name").order("created_at", { ascending: true });
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;
    let projects = data ?? [];
    // #2: the fintech demo project is hidden unless FLAG_FINTECH is on.
    if (!flags.fintech) {
      projects = projects.filter((p) => p.name !== "Fintech recon dashboard");
    }
    return NextResponse.json({ projects });
  } catch (e) {
    console.error("projects fetch error:", e);
    return NextResponse.json({ projects: [] }, { status: 500 });
  }
}

// Create a new project owned by the logged-in user.
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    const clean = (name || "").toString().trim();
    if (!clean) return NextResponse.json({ error: "A project name is required" }, { status: 400 });

    const supabase = createServerClient();
    const userId = (await getRequestUser(request))?.id ?? null;
    if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { data, error } = await supabase
      .from("projects")
      .insert({ name: clean.slice(0, 120), user_id: userId })
      .select("id, name")
      .single();
    if (error) throw error;
    return NextResponse.json({ project: data });
  } catch (e) {
    console.error("project create error:", e);
    return NextResponse.json({ error: "Could not create the project" }, { status: 500 });
  }
}
