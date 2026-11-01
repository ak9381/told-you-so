export interface PersonRow {
  id: string;
  name: string;
  email: string | null;
  project_id: string | null;
}

/** Same name (case/space-insensitive) or same email already on the team? */
export function findDuplicate(
  team: PersonRow[],
  name: string,
  email: string | null
): { field: "name" | "email"; person: PersonRow } | null {
  const n = name.trim().replace(/\s+/g, " ").toLowerCase();
  const byName = team.find((p) => p.name.trim().replace(/\s+/g, " ").toLowerCase() === n);
  if (byName) return { field: "name", person: byName };
  const e = (email || "").trim().toLowerCase();
  if (e) {
    const byEmail = team.find((p) => (p.email || "").trim().toLowerCase() === e);
    if (byEmail) return { field: "email", person: byEmail };
  }
  return null;
}
