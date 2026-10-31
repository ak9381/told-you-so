# Stage 8: Tracker, reminders, outbox and weekly digest, then freeze
**Time:** 6:40 to 7:00 PM IST, core frozen at 7:00 (plan.md prompts 11, 12 and 13)

## Say this
Read plan.md section 2 and section 3 for details if anything is unclear. These are must builds four, five and six. First a ledger page where every confirmed action is a card with owner, due date, status, the source quote and a link to the meeting, with one tap status changes. Put trackers behind a small create task adapter, with Notion as the only one for now: on confirm, add a page to the Notion database called Told You So Tasks with title, owner, due, status, source quote, meeting and objection link. It's best effort, so if Notion fails, still save to the ledger and record the result in a Notion log I can see.
Reminders: each action has a lead time, twenty four hours by default and two minutes for demo tasks, shown on its card. A run reminders function emails the owner when now is past the due time minus the lead time, only once. Resend without a domain can only send to my own account email, so every demo email goes to me with the person's name in the subject. Add a custom worker with a scheduled handler and two cron triggers: every minute for reminders, and thirty three on Mondays, written with the letters MON, for the weekly digest, which is nine AM IST.
The digest page per person shows what they own, what changed this week and open objections, with a short Gemini summary. Every reminder and digest goes into an outbox page with scheduled time, sent time, channel and status. Add send now buttons too.

## Verify
- The build passes and the deploy succeeds with both cron triggers listed.
- Confirm one action and check the Notion log shows filed, with a link.
- Create a task due in three minutes and confirm the outbox flips from scheduled to sent and the email arrives.
- Press send digest now for Harsh and confirm an outbox row and an email.

## Commit and push when green
