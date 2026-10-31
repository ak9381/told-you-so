import { NextResponse } from "next/server";

// Public liveness probe. Reports which integrations are configured (booleans
// only — never values).
export const dynamic = "force-dynamic";

export async function GET() {
  const has = (k: string) => Boolean(process.env[k]);
  return NextResponse.json({
    ok: true,
    service: "told-you-so",
    time: new Date().toISOString(),
    configured: {
      supabase: has("SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY"),
      gemini: has("GEMINI_API_KEY"),
      notion: has("NOTION_API_KEY") || has("NOTION_TOKEN"),
      resend: has("RESEND_API_KEY"),
      cron: has("CRON_SECRET"),
    },
  });
}
