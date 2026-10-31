# Prod-ready pass (branch prod-ready)
Goal: make Told You So production- and product-ready without breaking what works. main + tag `submitted-2026-10-31` = what judges see; do NOT touch main, do NOT deploy, do NOT run wrangler deploy/secret put, do NOT create accounts or handle passwords.

1. Audit: run build, lint, typecheck, /eval; read every API route, middleware, migrations. List every bug in stages/prod-ready-log.md (severity, file, repro).
2. Fix in order: security (auth on every API route, RLS on every table incl. verdict_logs/tasks, input validation + size limits, rate limits, no secrets client-side, CSRF/open redirects), data bugs, error handling (no silent failures, user-friendly errors), UX bugs (loading/empty states, mobile layout, accessibility).
3. Product gaps: demo-response caching (stage-9d §4.5), retries/timeouts on Gemini/Notion/Resend, health check route, structured logging.
4. One fix per commit, run build + /eval after each; revert anything that regresses. Keep 18/18 eval.
5. Push the prod-ready branch to origin (not main). End with a summary in prod-ready-log.md: fixed, still open, what Akash must do manually (deploy, Resend domain, etc.).
