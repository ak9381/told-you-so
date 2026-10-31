import { fetchWithRetry } from "@/lib/http";
// Tracker adapter: createTask(task) -> { url, id }. Notion is the only tracker
// for now; GitHub Issues could slot in behind the same interface later.

export interface TaskInput {
  title: string;
  owner: string;
  due?: string | null; // ISO date string or null
  status?: string;
  sourceQuote?: string;
  project?: string;
  decisionId?: string;
  meeting?: string;
  objectionLink?: string;
}

export interface TrackerResult {
  ok: boolean;
  url?: string;
  id?: string;
  error?: string;
}

const NOTION_VERSION = "2022-06-28";

// Matches the real "Told You So Tasks" database:
// Name (title), Owner (rich_text), Due (date), Status (select),
// Source quote (rich_text), Project (rich_text), Decision ID (rich_text).
async function createNotionTask(task: TaskInput): Promise<TrackerResult> {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID;
  if (!token || !dbId) return { ok: false, error: "Notion not configured" };

  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: (task.title || "Task").slice(0, 200) } }] },
    Owner: { rich_text: [{ text: { content: task.owner || "" } }] },
    Status: { select: { name: task.status || "open" } },
  };
  if (task.sourceQuote)
    properties["Source quote"] = { rich_text: [{ text: { content: task.sourceQuote.slice(0, 1800) } }] };
  if (task.project) properties["Project"] = { rich_text: [{ text: { content: task.project } }] };
  if (task.decisionId) properties["Decision ID"] = { rich_text: [{ text: { content: task.decisionId } }] };
  if (task.meeting) properties["Meeting"] = { rich_text: [{ text: { content: task.meeting.slice(0, 200) } }] };
  if (task.objectionLink) properties["Objection link"] = { url: task.objectionLink };
  if (task.due) properties["Due"] = { date: { start: task.due } };

  try {
    const res = await fetchWithRetry("https://api.notion.com/v1/pages", {
      method: "POST",
      // bind fetch to globalThis avoids Workers' "Illegal invocation"
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ parent: { database_id: dbId }, properties }),
    }, { timeoutMs: 15_000, retries: 0, label: "notion-create" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.message || `HTTP ${res.status}` };
    return { ok: true, id: data.id, url: data.url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Find a page already filed for this task (the "Decision ID" column holds our action id). */
async function findNotionTask(key: string): Promise<TrackerResult | null> {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID;
  if (!token || !dbId || !key) return null;
  try {
    const res = await fetchWithRetry(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
      body: JSON.stringify({ filter: { property: "Decision ID", rich_text: { equals: key } }, page_size: 1 }),
    }, { timeoutMs: 10_000, retries: 1, label: "notion-query" });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const page = data?.results?.[0];
    return page?.id ? { ok: true, id: page.id, url: page.url } : null;
  } catch {
    return null; // lookup is an optimisation; creation still proceeds
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The adapter entry point (Notion for now). B6: idempotent with retry — before
 * each create attempt we look for a page already filed for this task, so a
 * retry after a timed-out-but-succeeded create never duplicates it.
 */
export async function createTask(task: TaskInput, attempts = 3): Promise<TrackerResult> {
  let last: TrackerResult = { ok: false, error: "not attempted" };
  for (let i = 0; i < attempts; i++) {
    if (task.decisionId) {
      const existing = await findNotionTask(task.decisionId);
      if (existing) return existing;
    }
    last = await createNotionTask(task);
    if (last.ok || last.error === "Notion not configured") return last;
    if (i < attempts - 1) await sleep(500 * 2 ** i);
  }
  return last;
}

// Our statuses (open/done/blocked) -> the Notion "Status" select option names.
const STATUS_TO_NOTION: Record<string, string> = {
  open: "open",
  done: "Done",
  blocked: "Blocked",
};

/** Push a status change to an existing Notion page (real-time sync from the ledger). */
export async function updateNotionTaskStatus(pageId: string, status: string): Promise<TrackerResult> {
  return patchNotionPage(pageId, { Status: { select: { name: STATUS_TO_NOTION[status] || status } } });
}

/** B5: push an owner reassignment to the Notion page's Owner (rich_text). */
export async function updateNotionTaskOwner(pageId: string, owner: string): Promise<TrackerResult> {
  return patchNotionPage(pageId, { Owner: { rich_text: [{ text: { content: owner.slice(0, 120) } }] } });
}

async function patchNotionPage(pageId: string, properties: Record<string, unknown>): Promise<TrackerResult> {
  const token = process.env.NOTION_TOKEN;
  if (!token) return { ok: false, error: "Notion not configured" };
  try {
    const res = await fetchWithRetry(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    }, { timeoutMs: 15_000, retries: 1, label: "notion-update" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.message || `HTTP ${res.status}` };
    return { ok: true, id: data.id, url: data.url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
