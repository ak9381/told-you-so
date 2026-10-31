// Client-side cache and deduplication for project lookups.
// Prevents duplicate concurrent requests from AppShell and page components.

let projectsPromise: Promise<{ projects: { id: string; name: string }[] }> | null = null;

export function fetchProjectsClient(): Promise<{ projects: { id: string; name: string }[] }> {
  if (!projectsPromise) {
    projectsPromise = fetch("/api/projects")
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`projects fetch failed with status ${r.status}`);
        }
        return r.json();
      })
      .catch((err) => {
        projectsPromise = null; // allow retry on failure
        throw err;
      });
  }
  return projectsPromise;
}

export function invalidateProjectsCache() {
  projectsPromise = null;
}
