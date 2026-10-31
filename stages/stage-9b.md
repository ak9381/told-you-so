# Stage 9b: Connect Wispr Notetaker (stretch)
**Time:** after the 7:00 PM IST freeze, inside the 7:30 to 10:10 PM hardening window. Only start once the core demo passes. Stop at 9:30 if it isn't working, and leave the flag off.

## Say this
Read plan.md and stage 9 if anything is unclear. This is a stretch goal behind a feature flag called WISPR_ENABLED. If it's off or anything fails, nothing else breaks, and paste import stays the fallback.
I want a Connect Wispr button on the settings page, so meetings from the Wispr Flow Notetaker come in on their own with no copy and paste. Wispr has an MCP server at api.wisprflow.ai slash connect slash mcp. It speaks streamable HTTP and returns 401 without a bearer token. The auth server is mcp-auth.wisprflow.com, with oauth2 slash authorize, oauth2 slash token, and oauth2 slash register. Dynamic client registration is open, so register our app once with token endpoint auth method none and save the client id in Supabase. Use PKCE with S256, and scopes openid and offline access so we get a refresh token. The redirect goes to api slash wispr slash callback on our Worker. Store the access and refresh tokens per user in a Supabase table, server side only, never sent to the browser. The user's Wispr login must be Google sign in, not email and password, so say that next to the button.
We don't know the tool names yet. So step one after sign in is to call tools list and log the result, then pick the tools for listing meetings and reading a transcript. It's read only: transcripts, summaries, notes, action items and attendees.
Then reuse the every minute cron, no new cron trigger, and run the Wispr pull only every fifth minute. Refresh the token if needed, list recent meetings, skip meeting ids we already imported, and import each new transcript into the user's default project. Run the normal extraction and conflict check, and show it in the UI with the source label Wispr Notetaker. Keep each run under the 50 subrequest limit, so cap it at a few meetings per run. Add a Disconnect button that deletes the tokens.

Step zero is a Supabase migration that creates a wispr connections table with user id, the encrypted access token, the encrypted refresh token, expires at, client id, last synced at, and a list of imported meeting ids. Turn row level security on with no client policies.

## Verify
- The migration creates wispr_connections (user_id, encrypted access and refresh tokens, expires_at, client_id, last_synced_at, imported_meeting_ids) and RLS is on.
- With WISPR_ENABLED off, the settings page has no Wispr button and everything else works.
- With it on, Connect Wispr signs in with Google and comes back to settings showing Connected.
- The tools list output is in the Worker logs, and the tool names we picked are written in the README.
- A short test Notetaker meeting shows up auto imported, labelled Wispr Notetaker, within 5 minutes, with its decisions and any objections.
- The next cron run doesn't import the same meeting again.
- Disconnect removes the tokens and the pulls stop.
- Paste import still works.

## Commit and push when green

## Multi-user rules (added 4:25 PM)
- Each user connects their own Wispr account; tokens are keyed to their Supabase user id. Nobody sees another user's meetings.
- Tokens live in a `wispr_connections` table with RLS on and no client policies, so only the server (secret key) can read it. Never send tokens to the browser. If time allows, encrypt them with AES-GCM using a `WISPR_TOKEN_KEY` Cloudflare secret.
- Only a signed-in, allowlisted user can start Connect Wispr. Check the session in `/api/wispr/connect` and `/api/wispr/callback`, and verify the OAuth `state`.
- Disconnect deletes that user's row immediately.
- Judge login: seed one demo meeting labelled source "Wispr Notetaker" so judges see the auto-import result without their own Wispr account. Keep the Connect Wispr button visible so they can try it with their own account.

Validation additions:
- [ ] User A connects; user B sees none of A's meetings.
- [ ] Browser network tab never shows a Wispr token.
- [ ] Callback with a wrong state is rejected.
- [ ] Judge account shows the seeded Wispr Notetaker meeting.
