# Stage 7: Live meeting mode on Google Meet
**Time:** 6:15 to 6:40 PM IST, with a Meet test with friends at about 6:30 (plan.md prompt 10b and section 5c)

## Say this
Read plan.md section 2 and section 5c for details if anything is unclear. I want the app to object during a real meeting, not only afterwards. I'll run a Google Meet in one Chrome window with speakers on and no headphones, and a live page in another tab, so the Mac mic hears everyone. Make a page at slash live with the same project picker and automatic meeting name. Use the browser's built in speech recognition in Chrome, continuous with interim results, English India. Show interim text in grey and final lines with a timer, labelled speaker question mark, with a click to tag speaker control on each line, remembering the last name I picked. This is the browser listening, not Wispr, so it doesn't touch my Wispr count.
Every fifteen to twenty seconds, debounced and one request at a time, send only the new lines to a live check route. Skip chunks with no decision like words without calling Gemini, because we only get fifteen requests a minute. Otherwise make one Gemini call that extracts decisions and compares them with the same project's memory. Contradictions pop a red objection card live with the earlier quote, speaker, meeting and timestamp. Refinements get a small grey chip.
Add a play demo clip button that feeds the meeting two script through the same path, for when the mic fails. End meeting saves the transcript and runs the normal extraction into the tray, and an import Meet transcript button replaces speaker question mark with real names.
The Import Meet transcript button takes the pasted transcript from Google Meet, saves it on the same meeting as its own source with source type meet transcript, labelled Meet transcript in the UI, and fills in the speaker names on the live lines by matching the text and timing. Keep the live lines as the live source, so both sources sit on one meeting.

## Verify
- The build passes and the live page loads on the deployed URL.
- Press play demo clip and confirm two objections, one grey refinement chip and one new decision.
- Confirm live check is never called more than once every fifteen seconds.
- End the meeting and confirm the Harsh action lands in the tray.
- Import a Meet transcript and confirm speaker question mark lines now show real names, and the source shows as Meet transcript with source_type meet_transcript.

## Commit and push when green

## Launch from a link (added 4:40 PM)
Spoken script: "On the Live page, add a Meeting link box and a Launch button. Accept only Google Meet links like meet.google.com/abc-defg-hij, and Zoom links on any zoom.us subdomain with /j/ followed by the meeting id. Anything else shows: Only Google Meet and Zoom links are supported for now. For Zoom, rewrite the link to the browser join link, zoom.us/wc/join/ followed by the id, keeping the pwd parameter, so it stays in Chrome. When I press Launch, open the meeting in a popup window on the left half of the screen, resize our window to the right half if allowed, and start live listening in the same click. Show a hint: Sign in if asked, join the call, and we'll start listening. Save the link on the meeting record. No server calls to Zoom or Google, and no Playwright."

Validation:
- [ ] Meet link opens a popup and listening starts in one click.
- [ ] Zoom /j/ link opens the /wc/join/ browser version with the password kept.
- [ ] A random URL shows the supported-links error.
- [ ] Signed-out user sees the Meet or Zoom sign-in in the popup and can still join.
