# Stage 5: Memory from the real kickoff, and an eval page
**Time:** 5:15 to 5:40 PM IST (plan.md prompts 14 and 15)

## Say this
Read plan.md section 2 and the prompts 14 and 15 in section 7 for details if anything is unclear. The memory for the demo is the real kickoff call of this hackathon. Write a seed script that loads the kickoff transcript as meeting one of a project called Hackathon submission, titled Hackathon submission number one, with speaker two as Sakshi. Pre-load its decisions, each with the exact quote and timestamp: team size at most two, submission by 11:59 PM IST today, LinkedIn posts by the first of November, no old projects, pick one of the five statements, deploy with test credentials, a two to three minute video, and Wispr is mandatory. Also add a second project called Client website with three meetings, where meeting three today has the client saying the video can be five minutes, about their promo video. Add people Harsh, the client and me, Akash. Make it safe to run twice. Don't seed the WhatsApp chat.
Then build an eval page before the agent, so we can measure it honestly. Eleven labelled snippets to start: three real contradictions, two refinements that must not be flagged, five normal ones including two from WhatsApp, and one from the Client website project that must not be flagged. The refinement rule is: a narrower deadline or a more specific value is a refinement, not a contradiction. Add three messy speech cases from a Wispr debrief: one with a self correction, Harsh, no wait, I take the video by Tuesday, where the owner must be Akash; one with fillers and a digression about the coffee machine that must produce no task; and one where Friday ish, actually Thursday, must give Thursday. That makes fourteen cases. Show precision and recall, which path ran, and the failures.

## Verify
- The build passes and the seed script runs twice without duplicates.
- The decision timeline shows Hackathon submission number one with quotes.
- Run the eval page and print its precision, recall and failures.
- Confirm the refinement and the cross project snippet are not flagged.
- Confirm all three messy speech cases pass: Akash, no coffee task, and Thursday.

## Commit and push when green
