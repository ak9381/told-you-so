import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// Returns the real projects (with real UUIDs) so the UI can scope meetings
// correctly. Without this the client used placeholder ids like "proj-hackathon"
// which are not valid UUIDs and broke meeting creation on confirm.
export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ projects: data ?? [] });
  } catch (e) {
    console.error("projects fetch error:", e);
    return NextResponse.json({ projects: [] }, { status: 500 });
  }
}
