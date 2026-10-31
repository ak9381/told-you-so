# Stage 4: First live deploy on Cloudflare
**Time:** 5:00 to 5:15 PM IST (plan.md prompt 7)

## Say this
Read plan.md section 3 for details if anything is unclear. Let's get this online early, because the rules say judges must be able to use a deployed version, and I'd rather find deploy problems now than at eleven at night. Build the app with OpenNext and deploy it to Cloudflare Workers with wrangler. Set every secret with wrangler secret put, reading the values from my dot dev vars file, and never put them in the wrangler config or in git. Tell me which secret names you set, but don't print the values.
Keep in mind the free plan limits: ten milliseconds of CPU per request, fifty outgoing calls per request, and five cron triggers per account. Waiting on Gemini or Supabase doesn't count as CPU, so that's fine, but keep the dependencies light. For Notion, pass fetch bound to the global object so it works on Workers.
If this deploy fights us for more than twenty minutes, stop and tell me, and we'll deploy the same repo to Vercel instead.
It's done when I can open the workers dot dev URL, log in with an allowed user, and see the main screen.

## Verify
- The OpenNext build passes and wrangler deploy succeeds.
- List the Worker's secrets by name and confirm all of them are there.
- Fetch the live login page and confirm it returns successfully.
- Log in on the live URL with a test user and load the main screen.

## Commit and push when green
