import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("outbox")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ outbox: data ?? [] });
}
