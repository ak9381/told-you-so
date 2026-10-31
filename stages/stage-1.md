# Stage 1: New project, look and feel, secrets
**Time:** 3:45 to 4:05 PM IST (plan.md prompts 1 and 2)

## Say this
Read plan.md section 3 and section 2 for details if anything is unclear. We're starting a brand new project called Told You So. It's the meeting agent that argues back: it remembers what a team decided, and it objects, with the exact quote, when someone contradicts it later. I want it to be a Next.js app with TypeScript and Tailwind, deployed on Cloudflare Workers using the OpenNext adapter and wrangler, so please start from the OpenNext Cloudflare starter and use today's compatibility date. Keep every secret in a dot dev vars file, add that file to gitignore, and make an example file that lists the names only: the Gemini key, the Supabase URL with its publishable and secret keys, the Notion token and database ID, the Resend key, the cron secret, the allowed emails and the daily Gemini cap. Never put a real key in the code.
Now the look, because judges hate generic AI screens. Make it feel like a courtroom ledger or an old newspaper: only two colours, warm paper and stamp red, near black ink for text, one serif font called Fraunces for headings and one mono font for quotes. Put that in one design tokens file, and add a masthead that says Told You So with the line, the meeting agent that argues back.
It's done when the app runs locally, the home page shows the masthead in that style, and git has no secrets in it.

## Verify
- Run the build and confirm it passes with no errors.
- Start it locally and load the home page; confirm the masthead and both fonts render.
- Confirm the dev vars file is ignored by git and the example file has names only.
- Run a quick search of the repo for anything that looks like an API key and confirm there is none.

## Commit and push when green
