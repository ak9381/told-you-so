# Stage 2: Login for five people, database, usage cap
**Time:** 4:05 to 4:30 PM IST (plan.md prompt 3)

## Say this
Read plan.md section 3 for details if anything is unclear. This app is only for five invited people, including one test login for the judges, so let's lock it down first. Use Supabase Auth with email and password, with no sign up page, using supabase-js over HTTP with the publishable and secret keys. After login, only allow emails that are in the allowed emails secret, which can have at most five entries; if someone else logs in, show a friendly message saying this demo is limited to five invited users. Protect every page except login and the reminder and digest endpoints, which use the cron secret instead.
Then create the database as a migration I can paste into the Supabase SQL editor. I need projects, meetings with a project, a number inside that project and a title, utterances with speaker and time, decisions with project, meeting number, topic, exact quote, speaker, time, status, a superseded by link and an embedding using pgvector, actions with owner, due date, status and a reminder lead time in minutes, objections with a verdict, agent trace steps, an outbox for reminders and digests, a Notion log, people with name and email, and a usage table.
The usage table is there because Gemini 3.5 Flash Lite on the free tier only gives us fifteen requests a minute and five hundred a day. So every Gemini call must go through one helper that allows at most sixty calls per user per day, and at most one live check every fifteen seconds per user. When a limit is hit, show a friendly banner saying the daily AI limit is reached and that it's showing cached results.

## Verify
- The build passes.
- Log in with an allowed test user and reach the home page; a non-allowed email sees the limited message.
- The migration file exists and lists every table above.
- Write a small test that calls the usage helper sixty one times for one user and confirms the last call is refused.

## Commit and push when green
