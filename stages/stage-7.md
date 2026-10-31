# Stage 7: Live meeting mode on Google Meet
**Time:** 6:15 to 6:40 PM IST, with a Meet test with friends at about 6:30 (plan.md prompt 10b and section 5c)

## Say this
Read plan.md section 2 and section 5c for details if anything is unclear. I want the app to object during a real meeting, not only afterwards. I'll run a Google Meet in one Chrome window with speakers on and no headphones, and a live page in another tab, so the Mac mic hears everyone. Make a page at slash live with the same project picker and automatic meeting name. Use the browser's built in speech recognition in Chrome, continuous with interim results, English India. Show interim text in grey and final lines with a timer, labelled speaker question mark, with a click to tag speaker control on each line, remembering the last name I picked. This is the browser listening, not Wispr, so it doesn't touch my Wispr count.
Every fifteen to twenty seconds, debounced and one request at a time, send only the new lines to a live check route. Skip chunks with no decision like words without calling Gemini, because we only get fifteen requests a minute. Otherwise make one Gemini call that extracts decisions and compares them with the same project's memory. Contradictions pop a red objection card live with the earlier quote, speaker, meeting and timestamp. Refinements get a small grey chip.
Add a play demo clip button that feeds the meeting two script through the same path, for when the mic fails. End meeting saves the transcript and runs the normal extraction into the tray, and an import Meet transcript button replaces speaker question mark with real names.

## Verify
- The build passes and the live page loads on the deployed URL.
- Press play demo clip and confirm two objections, one grey refinement chip and one new decision.
- Confirm live check is never called more than once every fifteen seconds.
- End the meeting and confirm the Priya action lands in the tray.

## Commit and push when green
