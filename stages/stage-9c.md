# Stage 9c (stretch, only if 9b is done or skipped by 9:00 PM): Meet overlay extension

Spoken script: "Build a tiny Chrome extension, manifest v3, in a folder called extension. On meet.google.com pages it shows a small red dot in the corner. It polls our app's /api/live/objections endpoint every 5 seconds using the signed-in session, and when there's a new objection the dot pulses and a card slides in with the quote, the old decision and its meeting. Clicking the card opens it in Told You So. It never listens itself; our app still does the listening. Keep it under 150 lines."

Validation:
- [ ] Load unpacked works and the dot shows on a Meet call.
- [ ] A new objection appears on Meet within 5 seconds.
- [ ] Signed out, the extension shows "Sign in to Told You So" instead.
- [ ] If not done by 9:30 PM, drop it and mention it in the video as what's next.
