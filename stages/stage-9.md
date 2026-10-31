# Stage 9: Hardening, README and the final deploy
**Time:** 7:30 to 10:10 PM IST, last deploy by 10:10 so the crons are live before recording at 10:30 (plan.md prompts 19 and 20, sections 4 and 6)

## Say this
Read plan.md section 4 and section 6 for details if anything is unclear. The core is frozen, so no new features now, only making it solid for the judges. Walk through the whole demo on the live URL with me, in this order: the kickoff memory, the Google Meet live call or the demo clip, the WhatsApp drift, my Wispr debrief, confirm, the Notion log, the three minute reminder landing in the outbox, a digest, and the eval page. Fix anything broken. Then add sensible empty and loading states, like checking the record, keeping the newspaper feel, but don't redesign anything.
Make sure the cached responses cover every demo input, so a rate limit can't break the video. Check that the judge test login works and only five emails are allowed.
Then write a README: what Told You So does, the seven must builds mapped to features, the architecture on Cloudflare Workers, how the agent loop and its fallback work, the live meeting mode and the note that it uses the browser's speech recognition, not Wispr, the usage limits, how to run it, and a section on how I built the whole thing by voice with Wispr Flow. Then do the final deploy.

## Verify
- The build passes and the final deploy succeeds before 10:10 PM IST.
- Run the full demo flow on the live URL and list any failures, which should be none.
- Log in with the judge test login on the live URL.
- Confirm the README covers all seven must builds.

## Commit and push when green
