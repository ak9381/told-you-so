# Stage 6: The agent that objects, with receipts
**Time:** 5:40 to 6:15 PM IST (plan.md prompts 8, 9 and 10)

## Say this
Read plan.md section 2 for details if anything is unclear. This is the heart of must build three. Use Gemini function calling with four tools and a hard limit of five steps. Search memory looks for earlier active decisions in the same project only, with the same topic, newest first, ignoring superseded ones, widening from fourteen days to ninety to all time, and then falling back to embedding similarity. Verify conflict is a separate strict check of whether the new decision really contradicts the old one or just refines it, using the refinement rule. Ask clarifying question is for when the owner or date is unclear, and I can answer by voice. Queue action only adds things to the tray.
Save every step to the agent trace, and show it in a reasoning trail panel so judges can see the agent think. If anything errors or times out, fall back to a fixed path, extract, look up, classify, and label which path ran. If Gemini returns a rate limit error, serve cached responses for the demo inputs and label them cached.
When something contradicts, show a big red objection stamp card: then versus now, the earlier quote, who said it, which meeting and when, and the new quote. Four verdicts: overrule, pivot, keep old and flag, by tap or by voice. The Wispr debrief box stays the first thing on the home page, and the agent runs on what I dictate there too. Below it, add a decision timeline by topic, with superseded decisions struck through and stamped.

## Verify
- The build passes.
- Paste the demo WhatsApp export and confirm objections on the team of three, the deadline, old projects, no deploy and Wispr optional, but not on submit by midnight.
- Dictate a messy debrief that contradicts the kickoff and confirm an objection appears with the cleaned version.
- Confirm the reasoning trail shows each tool step.
- Re-run the eval page and print the agent versus fallback rate.

## Commit and push when green
