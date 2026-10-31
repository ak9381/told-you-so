#!/usr/bin/env bash
# Deploy Told You So to Cloudflare Workers and push Worker secrets from .dev.vars.
# Run this yourself:  bash scripts/deploy.sh
# (Claude Code's deploy guardrail blocks production deploys, so a human runs it.)
set -eu
cd "$(dirname "$0")/.."

echo "==> Deploying to Cloudflare Workers (OpenNext worker is already built)..."
npx wrangler deploy

echo "==> Setting Worker secrets from .dev.vars (values never printed)..."
set -a; . ./.dev.vars; set +a
for NAME in \
  GEMINI_API_KEY GEMINI_DAILY_CAP \
  SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY \
  ALLOWED_EMAILS CRON_SECRET \
  NOTION_TOKEN NOTION_DATABASE_ID \
  RESEND_API_KEY RESEND_OWNER_EMAIL RESEND_FROM; do
  v="${!NAME:-}"
  if [ -n "$v" ]; then
    printf '%s' "$v" | npx wrangler secret put "$NAME" >/dev/null && echo "  set $NAME"
  fi
done

echo "==> Done. The live https://told-you-so.<subdomain>.workers.dev URL is in the 'wrangler deploy' output above."
