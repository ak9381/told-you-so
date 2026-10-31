import { createServerClient } from "@/lib/supabase";
import { log } from "@/lib/log";

export type ActivityKind =
  | "ingested"
  | "decision_saved"
  | "objection_raised"
  | "verdict"
  | "task_created"
  | "task_status"
  | "task_reassigned"
  | "task_removed"
  | "notion_filed"
  | "notion_failed"
  | "reminder_sent"
  | "project_created"
  | "member_added";

export interface LogActivityParams {
  userId?: string | null;
  projectId?: string | null;
  kind: ActivityKind;
  summary: string;
  data?: Record<string, unknown> | null;
}

/**
 * Records an event in the unified activity_log table (GROKBOT-REVIEW F1).
 * Fails open (logs a warning) if the table does not yet exist or insert fails,
 * ensuring outside actions are never blocked.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("activity_log").insert({
      user_id: params.userId || null,
      project_id: params.projectId || null,
      kind: params.kind,
      summary: params.summary,
      data: params.data || null,
    });
    if (error) {
      log.warn("activity_log write skipped/failed:", error.message);
    }
  } catch (err) {
    log.warn("activity_log unexpected error:", err);
  }
}
