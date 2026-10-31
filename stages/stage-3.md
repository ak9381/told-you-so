# Stage 3: Wispr voice debrief first, then chats and transcripts
**Time:** 4:30 to 5:00 PM IST (plan.md prompts 4, 5 and 6)

## Say this
Read plan.md section 2 and rules.md line 28 for details if anything is unclear. The rules say the main input must be natural speech through Wispr Flow, and the agent must turn messy speech into clean structured output. So the first thing anyone sees on the home page is a big box called Dictate with Wispr, with a hint saying hold Fn and just talk. Above it, a project picker, and the meeting gets an automatic name like Hackathon submission number two with the date and time.
People don't talk cleanly. They say um and like, they wander off topic, and they correct themselves. The extraction call to Gemini, with a strict JSON schema, must drop fillers, ignore digressions, and always keep the last correction. For example, Harsh, no wait, I take the video, by Tuesday, means the owner is Akash, since I is me and the deadline is next Tuesday. Every decision and action has an owner, a real date, the exact quote, the speaker and the time, and anything whose quote isn't in the text is dropped.
After I speak, show two columns side by side: what you said, with fillers greyed and corrected words struck through, and what we understood, as clean cards. Below that is the confirmation tray, and nothing is saved until I tick and confirm.
A paste tab also takes meeting transcripts, WhatsApp exports in both phone formats, and Slack or Google Chat lines, with the sender as speaker.

## Verify
- The build passes and the home page shows the Dictate with Wispr box first.
- Run extraction on the Harsh, no wait, I take the video sentence and confirm the owner is Akash and the date is Tuesday.
- Confirm the split view strikes through Harsh and greys the fillers.
- Run the parser on the kickoff sample and the WhatsApp export and print speakers and times.
- Confirm nothing is written to the database before confirm.

## Commit and push when green
